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

describe("timer routes", () => {
  it("create_timer requires label and durationSec", async () => {
    await withTestDatabase(async (databaseUrl) => {
      seedPresetRecipes(databaseUrl)
      const app = buildApp()
      const session = seedCommandableSession(databaseUrl)

      const missingLabel = await postCommand(app, session.sessionId, {
        type: "create_timer",
        durationSec: 90,
      })

      expect(missingLabel.response.status).toBe(400)
      expect(missingLabel.body.message).toContain("label")

      const missingDuration = await postCommand(app, session.sessionId, {
        type: "create_timer",
        label: "Rest the pan",
      })

      expect(missingDuration.response.status).toBe(400)
      expect(missingDuration.body.message).toContain("durationSec")
    })
  })

  it("lists timers with API-computed remainingSec and refreshes expired timers", async () => {
    await withTestDatabase(async (databaseUrl) => {
      seedPresetRecipes(databaseUrl)
      const app = buildApp()
      const session = seedCommandableSession(databaseUrl)

      seedRunningTimer({
        databaseUrl,
        session,
        label: "Fresh timer",
        targetAt: new Date(Date.now() + 90_000).toISOString(),
        timerId: "timer-running",
      })

      seedRunningTimer({
        databaseUrl,
        session,
        label: "Expired timer",
        startedAt: "2025-04-01T09:00:00.000Z",
        targetAt: "2025-04-01T09:01:00.000Z",
        timerId: "timer-expired",
      })

      const timers = await requestJson(
        app,
        new Request(`http://localhost/sessions/${session.sessionId}/timers`)
      )

      expect(timers.response.status).toBe(200)
      expect(timers.body.sessionId).toBe(session.sessionId)
      expect(timers.body.timers).toHaveLength(2)
      expect(timers.body.timers[0]).toHaveProperty("remainingSec")
      expect(timers.body.timers[0].remainingSec).toBeGreaterThanOrEqual(0)
      expect(
        timers.body.timers.find(
          (timer: any) => timer.timerId === "timer-expired"
        )?.status
      ).toBe("expired")
    })
  })

  it("cancel_timer works by timerId or unique label", async () => {
    await withTestDatabase(async (databaseUrl) => {
      seedPresetRecipes(databaseUrl)
      const app = buildApp()
      const session = seedCommandableSession(databaseUrl)

      const firstTimer = await postCommand(app, session.sessionId, {
        type: "create_timer",
        label: "Boil pasta",
        durationSec: 120,
      })

      expect(firstTimer.response.status).toBe(200)

      const byId = await postCommand(app, session.sessionId, {
        type: "cancel_timer",
        timerId: firstTimer.body.result.timerId,
      })

      expect(byId.response.status).toBe(200)
      expect(byId.body.result.commandType).toBe("cancel_timer")

      const secondTimer = await postCommand(app, session.sessionId, {
        type: "create_timer",
        label: "Rest steak",
        durationSec: 300,
      })

      expect(secondTimer.response.status).toBe(200)

      const byLabel = await postCommand(app, session.sessionId, {
        type: "cancel_timer",
        label: "Rest steak",
      })

      expect(byLabel.response.status).toBe(200)
      expect(byLabel.body.result.commandType).toBe("cancel_timer")
    })
  })
})
