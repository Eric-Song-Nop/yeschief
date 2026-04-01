import { describe, expect, it } from "bun:test"
import { getDatabase } from "../src/persistence/db"
import { seedPresetRecipes } from "../src/seed/preset-recipes"
import { createSession, getSessionById } from "../src/services/sessions"
import {
  buildPausedSessionSnapshotFixture,
  buildRecipeContextFixture,
} from "./session-fixtures"
import { withTestDatabase } from "./test-db"

describe("session context snapshot", () => {
  it("returns recipe grounding fields when creating a session", async () => {
    await withTestDatabase(async (databaseUrl) => {
      const sessionResult = createSession(
        {
          recipeId: "recipe-omelette",
        },
        databaseUrl
      )

      expect(sessionResult).not.toBeNull()

      if (!sessionResult) {
        throw new Error("Expected createSession to return a snapshot")
      }

      const session = sessionResult.session as typeof sessionResult.session & {
        recipeContext: ReturnType<typeof buildRecipeContextFixture>
        activeTimers: Array<{ label: string }>
      }

      expect(session.recipeContext.ingredients.length).toBeGreaterThan(0)
      expect(session.recipeContext.steps[0]?.heatLevel).toBe("off")
      expect(session.recipeContext.substitutions.length).toBeGreaterThan(0)
      expect(session.activeTimers).toEqual([])
    })
  })

  it("round-trips paused snapshots with timers and last command results", async () => {
    await withTestDatabase(async (databaseUrl) => {
      seedPresetRecipes(databaseUrl)

      const sqlite = getDatabase(databaseUrl)
      const snapshot = buildPausedSessionSnapshotFixture()

      sqlite
        .prepare(`
          INSERT INTO sessions (
            "id",
            "recipeId",
            "status",
            "currentStepIndex",
            "snapshotJson",
            "createdAt",
            "updatedAt"
          ) VALUES (
            ?1,
            ?2,
            ?3,
            ?4,
            ?5,
            ?6,
            ?7
          )
        `)
        .run(
          snapshot.sessionId,
          snapshot.recipeId,
          snapshot.status,
          snapshot.currentStepIndex,
          JSON.stringify(snapshot),
          snapshot.createdAt,
          snapshot.updatedAt
        )

      const sessionResult = getSessionById(snapshot.sessionId, databaseUrl)

      expect(sessionResult).not.toBeNull()

      if (!sessionResult) {
        throw new Error("Expected getSessionById to return a snapshot")
      }

      const session = sessionResult.session as typeof snapshot

      expect(session.status).toBe("paused")
      expect(session.activeTimers[0]?.label).toBe("Low heat cook")
      expect(session.lastCommandResult.message).toBe(
        "Paused while the pan stays warm."
      )
    })
  })
})
