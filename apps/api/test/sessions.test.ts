import { describe, expect, it } from "bun:test"
import type { CreateSessionResult, ListSessionsResult } from "@yes-chief/shared"
import { buildApp } from "../src/app"
import {
  getSessionById,
  persistSessionSnapshot,
} from "../src/services/sessions"
import { withTestDatabase } from "./test-db"

describe("recipe and session routes", () => {
  it("returns preset recipes and creates a session snapshot", async () => {
    await withTestDatabase(async () => {
      const app = buildApp()

      const recipesResponse = await app.handle(
        new Request("http://localhost/recipes/presets")
      )

      expect(recipesResponse.status).toBe(200)

      const recipes = (await recipesResponse.json()) as Array<{
        id: string
        slug: string
        title: string
        stepCount: number
      }>

      expect(recipes.length).toBeGreaterThan(0)

      const recipe = recipes[0]

      expect(recipe).toBeDefined()

      const createResponse = await app.handle(
        new Request("http://localhost/sessions", {
          body: JSON.stringify({ recipeId: recipe.id }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        })
      )

      expect(createResponse.status).toBe(201)

      const created = (await createResponse.json()) as {
        session: {
          sessionId: string
          recipeId: string
          recipeTitle: string
          status: string
          currentStepIndex: number
          currentStep: {
            id: string
            title: string
            instruction: string
          }
          totalSteps: number
          createdAt: string
          updatedAt: string
        }
      }

      expect(created.session.recipeId).toBe(recipe.id)
      expect(created.session.status).toBe("active")
      expect(created.session.currentStepIndex).toBe(0)
      expect(created.session.totalSteps).toBeGreaterThan(0)
      expect(created.session.currentStep.id).toBeDefined()

      const getResponse = await app.handle(
        new Request(`http://localhost/sessions/${created.session.sessionId}`)
      )

      expect(getResponse.status).toBe(200)

      const fetched = (await getResponse.json()) as {
        session: {
          sessionId: string
          recipeId: string
          currentStepIndex: number
          currentStep: {
            id: string
          }
        }
      }

      expect(fetched.session.sessionId).toBe(created.session.sessionId)
      expect(fetched.session.recipeId).toBe(recipe.id)
      expect(fetched.session.currentStepIndex).toBe(0)
      expect(fetched.session.currentStep.id).toBe(
        created.session.currentStep.id
      )
    })
  })

  it("returns 404 for unknown recipe and session ids", async () => {
    await withTestDatabase(async () => {
      const app = buildApp()

      const missingRecipeResponse = await app.handle(
        new Request("http://localhost/sessions", {
          body: JSON.stringify({ recipeId: "missing-recipe" }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        })
      )

      expect(missingRecipeResponse.status).toBe(404)

      const missingSessionResponse = await app.handle(
        new Request("http://localhost/sessions/missing-session")
      )

      expect(missingSessionResponse.status).toBe(404)
    })
  })

  it("lists sessions sorted by updatedAt with recovery card fields only", async () => {
    await withTestDatabase(async (databaseUrl) => {
      const app = buildApp()

      const firstCreateResponse = await app.handle(
        new Request("http://localhost/sessions", {
          body: JSON.stringify({ recipeId: "recipe-garlic-rice" }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        })
      )

      expect(firstCreateResponse.status).toBe(201)

      const firstCreated =
        (await firstCreateResponse.json()) as CreateSessionResult
      const secondCreateResponse = await app.handle(
        new Request("http://localhost/sessions", {
          body: JSON.stringify({ recipeId: "recipe-tomato-pasta" }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        })
      )

      expect(secondCreateResponse.status).toBe(201)

      const secondCreated =
        (await secondCreateResponse.json()) as CreateSessionResult
      const firstSession = getSessionById(
        firstCreated.session.sessionId,
        databaseUrl
      )
      const secondSession = getSessionById(
        secondCreated.session.sessionId,
        databaseUrl
      )

      expect(firstSession).not.toBeNull()
      expect(secondSession).not.toBeNull()

      persistSessionSnapshot(
        {
          ...firstSession!.session,
          currentStepIndex: 1,
          updatedAt: "2026-04-01T10:00:00.000Z",
        },
        databaseUrl
      )

      persistSessionSnapshot(
        {
          ...secondSession!.session,
          currentStepIndex: secondSession!.session.totalSteps - 1,
          status: "completed",
          summary: {
            cancelledTimerCount: 0,
            completedAt: "2026-04-01T11:00:00.000Z",
            completionMessage: "Dinner is ready.",
            expiredTimerCount: 1,
            finalStepIndex: secondSession!.session.totalSteps - 1,
            recipeTitle: secondSession!.session.recipeTitle,
            totalSteps: secondSession!.session.totalSteps,
          },
          updatedAt: "2026-04-01T11:00:00.000Z",
        },
        databaseUrl
      )

      const response = await app.handle(
        new Request("http://localhost/sessions")
      )

      expect(response.status).toBe(200)

      const listed = (await response.json()) as ListSessionsResult

      expect(listed.sessions).toHaveLength(2)
      expect(listed.sessions.map((session) => session.sessionId)).toEqual([
        secondCreated.session.sessionId,
        firstCreated.session.sessionId,
      ])
      expect(listed.sessions[0]).toEqual({
        currentStepIndex: secondCreated.session.totalSteps - 1,
        recipeTitle: secondCreated.session.recipeTitle,
        sessionId: secondCreated.session.sessionId,
        status: "completed",
        summary: {
          cancelledTimerCount: 0,
          completedAt: "2026-04-01T11:00:00.000Z",
          completionMessage: "Dinner is ready.",
          expiredTimerCount: 1,
          finalStepIndex: secondCreated.session.totalSteps - 1,
          recipeTitle: secondCreated.session.recipeTitle,
          totalSteps: secondCreated.session.totalSteps,
        },
        totalSteps: secondCreated.session.totalSteps,
        updatedAt: "2026-04-01T11:00:00.000Z",
      })
      expect(Object.keys(listed.sessions[0]).sort()).toEqual(
        [
          "currentStepIndex",
          "recipeTitle",
          "sessionId",
          "status",
          "summary",
          "totalSteps",
          "updatedAt",
        ].sort()
      )
      expect(listed.sessions[1].currentStepIndex).toBe(1)
      expect(listed.sessions[1].updatedAt).toBe("2026-04-01T10:00:00.000Z")
      expect(listed.sessions[1].summary).toBeNull()
    })
  })
})
