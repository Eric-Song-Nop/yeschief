import { Elysia } from "elysia"
import type {
  ConnectSessionResult,
  CreateSessionInput,
  CreateSessionResult,
  DeleteSessionRoomResult,
  GetSessionResult,
  GetSessionTimersResult,
  SessionCommandRequest,
  SessionCommandResponse,
} from "@yes-chief/shared"
import { createSession, getSessionById } from "../services/sessions"
import { connectSession, deleteSessionRoom } from "../services/livekit-connect"
import { runSessionCommand } from "../services/session-commands"
import { listTimers } from "../services/timers"

const isServiceError = (
  error: unknown
): error is Error & {
  status: number
} =>
  error instanceof Error &&
  "status" in error &&
  typeof error.status === "number"

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
  .post("/sessions/:sessionId/connect", async ({ params, set }) => {
    const session = getSessionById(params.sessionId)

    if (!session) {
      set.status = 404

      return {
        message: "Session not found",
      }
    }

    try {
      const result = await connectSession(session.session.sessionId)

      return result satisfies ConnectSessionResult
    } catch (error) {
      if (isServiceError(error)) {
        set.status = error.status

        return {
          message: error.message,
        }
      }

      throw error
    }
  })
  .delete("/sessions/:sessionId/room", async ({ params, set }) => {
    const session = getSessionById(params.sessionId)

    if (!session) {
      set.status = 404

      return {
        message: "Session not found",
      }
    }

    try {
      const result = await deleteSessionRoom(session.session.sessionId)

      return result satisfies DeleteSessionRoomResult
    } catch (error) {
      if (isServiceError(error)) {
        set.status = error.status

        return {
          message: error.message,
        }
      }

      throw error
    }
  })
  .post("/sessions/:sessionId/commands", ({ body, params, set }) => {
    try {
      const request = body as SessionCommandRequest | null

      if (!request || typeof request.type !== "string") {
        set.status = 400

        return {
          message: "type is required",
        }
      }

      if (
        request.type === "create_timer" &&
        (typeof request.label !== "string" ||
          request.label.length === 0 ||
          typeof request.durationSec !== "number")
      ) {
        set.status = 400

        return {
          message: "create_timer requires label and durationSec",
        }
      }

      if (
        request.type === "cancel_timer" &&
        typeof request.timerId !== "string" &&
        typeof request.label !== "string"
      ) {
        set.status = 400

        return {
          message: "cancel_timer requires timerId or label",
        }
      }

      const result = runSessionCommand(
        {
          ...request,
          sessionId: params.sessionId,
        },
        Bun.env.DATABASE_URL
      )

      return result satisfies SessionCommandResponse
    } catch (error) {
      if (isServiceError(error)) {
        set.status = error.status

        return {
          message: error.message,
        }
      }

      throw error
    }
  })
  .get("/sessions/:sessionId/timers", ({ params, set }) => {
    const session = getSessionById(params.sessionId)

    if (!session) {
      set.status = 404

      return {
        message: "Session not found",
      }
    }

    try {
      const result = listTimers(params.sessionId, Bun.env.DATABASE_URL)

      return result satisfies GetSessionTimersResult
    } catch (error) {
      if (isServiceError(error)) {
        set.status = error.status

        return {
          message: error.message,
        }
      }

      throw error
    }
  })
