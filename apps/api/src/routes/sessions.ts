import { Elysia } from "elysia"
import type {
  CreateSessionInput,
  CreateSessionResult,
  GetSessionResult,
} from "@yes-chief/shared"
import { createSession, getSessionById } from "../services/sessions"

export const sessionsRoutes = new Elysia({ name: "sessions-routes" })
  .post("/sessions", ({ body, set }) => {
    const input = body as CreateSessionInput | null

    if (
      !input ||
      typeof input.recipeId !== "string" ||
      input.recipeId.length === 0
    ) {
      set.status = 400

      return {
        message: "recipeId is required",
      }
    }

    const result = createSession(input)

    if (!result) {
      set.status = 404

      return {
        message: "Preset recipe not found",
      }
    }

    set.status = 201

    return result satisfies CreateSessionResult
  })
  .get("/sessions/:sessionId", ({ params, set }) => {
    const result = getSessionById(params.sessionId)

    if (!result) {
      set.status = 404

      return {
        message: "Session not found",
      }
    }

    return result satisfies GetSessionResult
  })
