import { describe, expect, it } from "bun:test"
import type {
  CreateSessionResult,
  DeleteSessionRoomResult,
} from "@yes-chief/shared"
import { buildApp } from "../src/app"
import { setRoomServiceClientFactoryForTests } from "../src/services/livekit-connect"
import { withTestDatabase } from "./test-db"

const LIVEKIT_TEST_ENV = {
  LIVEKIT_API_KEY: "test-api-key",
  LIVEKIT_API_SECRET: "test-api-secret",
  LIVEKIT_URL: "wss://livekit.example.test",
} as const

const withLiveKitEnv = async <T>(callback: () => Promise<T>) => {
  const previous = {
    LIVEKIT_API_KEY: Bun.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: Bun.env.LIVEKIT_API_SECRET,
    LIVEKIT_URL: Bun.env.LIVEKIT_URL,
  }

  Object.assign(Bun.env, LIVEKIT_TEST_ENV)

  try {
    return await callback()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete Bun.env[key]
      } else {
        Bun.env[key] = value
      }
    }
  }
}

describe("session room cleanup route", () => {
  it("returns 404 for an unknown session", async () => {
    await withTestDatabase(async () => {
      const app = buildApp()
      const response = await app.handle(
        new Request("http://localhost/sessions/missing-session/room", {
          method: "DELETE",
        })
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        message: "Session not found",
      })
    })
  })

  it("deletes the existing session room and returns cleanup metadata", async () => {
    await withTestDatabase(async () => {
      await withLiveKitEnv(async () => {
        const app = buildApp()
        const listRoomsCalls: string[][] = []
        const deleteRoomCalls: string[] = []

        setRoomServiceClientFactoryForTests(() => ({
          async createRoom() {
            throw new Error("createRoom should not be called during cleanup")
          },
          async deleteRoom(roomName) {
            deleteRoomCalls.push(roomName)
          },
          async listRooms(names) {
            listRoomsCalls.push(names ?? [])

            return [
              {
                name: names?.[0] ?? "",
              },
            ]
          },
        }))

        try {
          const createResponse = await app.handle(
            new Request("http://localhost/sessions", {
              body: JSON.stringify({ recipeId: "recipe-garlic-rice" }),
              headers: {
                "content-type": "application/json",
              },
              method: "POST",
            })
          )

          expect(createResponse.status).toBe(201)

          const created = (await createResponse.json()) as CreateSessionResult
          const sessionId = created.session.sessionId
          const cleanupResponse = await app.handle(
            new Request(`http://localhost/sessions/${sessionId}/room`, {
              method: "DELETE",
            })
          )

          expect(cleanupResponse.status).toBe(200)

          const result =
            (await cleanupResponse.json()) as DeleteSessionRoomResult

          expect(listRoomsCalls).toEqual([[sessionId]])
          expect(deleteRoomCalls).toEqual([sessionId])
          expect(result).toEqual({
            cleanup: "deleted",
            roomName: sessionId,
            sessionId,
          })
        } finally {
          setRoomServiceClientFactoryForTests(null)
        }
      })
    })
  })
})
