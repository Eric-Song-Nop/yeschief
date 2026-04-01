import { describe, expect, it } from "bun:test"
import { buildApp } from "../src/app"
import { seedPresetRecipes } from "../src/seed/preset-recipes"
import { seedCommandableSession, seedRunningTimer } from "./session-fixtures"
import { withTestDatabase } from "./test-db"

const requestJson = async (
  app: ReturnType<typeof buildApp>,
  request: Request
) => {
  const response = await app.handle(request)

  return {
    response,
    body: (await response.json()) as any,
  }
}

const postCommand = (
  app: ReturnType<typeof buildApp>,
  sessionId: string,
  body: Record<string, unknown>
) =>
  requestJson(
    app,
    new Request(`http://localhost/sessions/${sessionId}/commands`, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    })
  )

describe("session command routes", () => {
  it("advance_step only moves forward before the final step", async () => {
    await withTestDatabase(async (databaseUrl) => {
      seedPresetRecipes(databaseUrl)
      const app = buildApp()
      const session = seedCommandableSession(databaseUrl)

      const advance = await postCommand(app, session.sessionId, {
        type: "advance_step",
      })

      expect(advance.response.status).toBe(200)
      expect(advance.body.result.commandType).toBe("advance_step")
      expect(advance.body.session.currentStepIndex).toBe(1)
      expect(advance.body.session.lastCommandResult.message).toContain(
        "Moved to step"
      )

      await postCommand(app, session.sessionId, { type: "advance_step" })

      const finalAdvance = await postCommand(app, session.sessionId, {
        type: "advance_step",
      })

      expect(finalAdvance.response.status).toBe(200)
      expect(finalAdvance.body.session.currentStepIndex).toBe(2)
      expect(finalAdvance.body.session.status).toBe("active")
      expect(finalAdvance.body.session.lastCommandResult.message).toContain(
        "already at the final step"
      )
    })
  })

  it("pause_session and resume_session enforce valid status transitions", async () => {
    await withTestDatabase(async (databaseUrl) => {
      seedPresetRecipes(databaseUrl)
      const app = buildApp()
      const session = seedCommandableSession(databaseUrl)

      const paused = await postCommand(app, session.sessionId, {
        type: "pause_session",
      })

      expect(paused.response.status).toBe(200)
      expect(paused.body.session.status).toBe("paused")
      expect(paused.body.session.lastCommandResult.commandType).toBe(
        "pause_session"
      )

      const resumed = await postCommand(app, session.sessionId, {
        type: "resume_session",
      })

      expect(resumed.response.status).toBe(200)
      expect(resumed.body.session.status).toBe("active")
      expect(resumed.body.session.lastCommandResult.commandType).toBe(
        "resume_session"
      )

      const invalidResume = await postCommand(app, session.sessionId, {
        type: "resume_session",
      })

      expect(invalidResume.response.status).toBe(409)
      expect(invalidResume.body.message).toContain("paused")
    })
  })

  it("end_session completes the session and cancels running timers", async () => {
    await withTestDatabase(async (databaseUrl) => {
      seedPresetRecipes(databaseUrl)
      const app = buildApp()
      const session = seedCommandableSession(databaseUrl)

      seedRunningTimer({
        databaseUrl,
        session,
        label: "Sauce reduce",
        targetAt: new Date(Date.now() + 120_000).toISOString(),
        timerId: "timer-end-session",
      })

      const ended = await postCommand(app, session.sessionId, {
        type: "end_session",
      })

      expect(ended.response.status).toBe(200)
      expect(ended.body.session.status).toBe("completed")
      expect(ended.body.session.activeTimers).toEqual([])

      const timers = await requestJson(
        app,
        new Request(`http://localhost/sessions/${session.sessionId}/timers`)
      )

      expect(timers.response.status).toBe(200)
      expect(timers.body.timers).toHaveLength(1)
      expect(timers.body.timers[0].status).toBe("cancelled")
    })
  })
})
