import { describe, expect, it } from "bun:test"
import type { ConnectSessionResult, CreateSessionResult } from "@yes-chief/shared"
import { buildApp } from "../src/app"
import { withTestDatabase } from "./test-db"

const LIVEKIT_TEST_ENV = {
  LIVEKIT_API_KEY: "test-api-key",
  LIVEKIT_API_SECRET: "test-api-secret",
  LIVEKIT_URL: "wss://livekit.example.test",
} as const

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  })

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

const withMockedFetch = async <T>(
  mockFetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>,
  callback: () => Promise<T>
) => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = mockFetch as typeof globalThis.fetch

  try {
    return await callback()
  } finally {
    globalThis.fetch = originalFetch
  }
}

describe("session connect route", () => {
  it("returns connect info for an existing session", async () => {
    await withTestDatabase(async () => {
      await withLiveKitEnv(async () => {
        await withMockedFetch(async (input) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url

          if (url.endsWith("/ListRooms")) {
            return jsonResponse({
              rooms: [],
            })
          }

          if (url.endsWith("/CreateRoom")) {
            return jsonResponse({
              name: "room-name",
              sid: "RM_123",
            })
          }

          if (url.endsWith("/ListDispatch")) {
            return jsonResponse({
              agentDispatches: [],
            })
          }

          if (url.endsWith("/CreateDispatch")) {
            return jsonResponse({
              agentName: "agent",
              id: "dispatch-1",
              metadata: '{"sessionId":"session"}',
              room: "room-name",
            })
          }

          return new Response("Unexpected fetch", {
            status: 500,
          })
        }, async () => {
          const app = buildApp()

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
          const connectResponse = await app.handle(
            new Request(
              `http://localhost/sessions/${created.session.sessionId}/connect`,
              {
                method: "POST",
              }
            )
          )

          expect(connectResponse.status).toBe(200)

          const result =
            (await connectResponse.json()) as ConnectSessionResult

          expect(result.sessionId).toBe(created.session.sessionId)
          expect(result.roomName).toBe(created.session.sessionId)
          expect(result.participantToken.length).toBeGreaterThan(0)
          expect(result.serverUrl).toBe(LIVEKIT_TEST_ENV.LIVEKIT_URL)
        })
      })
    })
  })

  it("returns 404 for an unknown session", async () => {
    await withTestDatabase(async () => {
      const app = buildApp()
      const response = await app.handle(
        new Request("http://localhost/sessions/missing-session/connect", {
          method: "POST",
        })
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        message: "Session not found",
      })
    })
  })

  it("returns a configuration error when LiveKit env is missing", async () => {
    await withTestDatabase(async () => {
      const app = buildApp()
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
      const previousEnv = {
        LIVEKIT_API_KEY: Bun.env.LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: Bun.env.LIVEKIT_API_SECRET,
        LIVEKIT_URL: Bun.env.LIVEKIT_URL,
      }

      delete Bun.env.LIVEKIT_API_KEY
      delete Bun.env.LIVEKIT_API_SECRET
      delete Bun.env.LIVEKIT_URL

      try {
        const connectResponse = await app.handle(
          new Request(
            `http://localhost/sessions/${created.session.sessionId}/connect`,
            {
              method: "POST",
            }
          )
        )

        expect(connectResponse.status).toBe(500)
        expect(await connectResponse.json()).toEqual({
          message:
            "LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET are required for session connect",
        })
      } finally {
        for (const [key, value] of Object.entries(previousEnv)) {
          if (value === undefined) {
            delete Bun.env[key]
          } else {
            Bun.env[key] = value
          }
        }
      }
    })
  })

  it("returns a dispatch failure when LiveKit rejects the connect flow", async () => {
    await withTestDatabase(async () => {
      await withLiveKitEnv(async () => {
        await withMockedFetch(async (input) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url

          if (url.endsWith("/ListRooms")) {
            return jsonResponse({
              rooms: [],
            })
          }

          if (url.endsWith("/CreateRoom")) {
            return jsonResponse({
              name: "room-name",
              sid: "RM_123",
            })
          }

          if (url.endsWith("/ListDispatch")) {
            return jsonResponse({
              agentDispatches: [],
            })
          }

          if (url.endsWith("/CreateDispatch")) {
            return jsonResponse(
              {
                code: "unavailable",
                msg: "dispatch unavailable",
              },
              503
            )
          }

          return new Response("Unexpected fetch", {
            status: 500,
          })
        }, async () => {
          const app = buildApp()
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
          const connectResponse = await app.handle(
            new Request(
              `http://localhost/sessions/${created.session.sessionId}/connect`,
              {
                method: "POST",
              }
            )
          )

          expect(connectResponse.status).toBe(502)
          expect(await connectResponse.json()).toEqual({
            message:
              "Failed to dispatch agent for session connect: dispatch unavailable",
          })
        })
      })
    })
  })
})
