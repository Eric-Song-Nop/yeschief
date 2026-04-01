import { describe, expect, it } from "bun:test"
import { buildApp } from "../src/app"
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
})
