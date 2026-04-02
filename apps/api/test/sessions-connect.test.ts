import { describe, expect, it } from "bun:test"
import type {
  ConnectSessionResult,
  CreateSessionResult,
} from "@yes-chief/shared"
import { buildApp } from "../src/app"
import {
  getSessionRoomBinding,
  upsertSessionRoomBinding,
} from "../src/services/session-room-binding"
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

const getJsonBody = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Record<string, unknown>> => {
  if (input instanceof Request) {
    return (await input.clone().json()) as Record<string, unknown>
  }

  if (typeof init?.body === "string") {
    return JSON.parse(init.body) as Record<string, unknown>
  }

  return {}
}

describe("session connect route", () => {
  it("returns connect info for an existing session", async () => {
    await withTestDatabase(async () => {
      await withLiveKitEnv(async () => {
        let currentRoomName: string | null = null

        await withMockedFetch(
          async (input, init) => {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url

            if (url.endsWith("/ListRooms")) {
              const body = await getJsonBody(input, init)
              const requestedNames = Array.isArray(body.names)
                ? (body.names as string[])
                : []
              const requestedRoom = requestedNames[0]

              return jsonResponse({
                rooms:
                  requestedRoom === currentRoomName && currentRoomName
                    ? [{ name: currentRoomName }]
                    : [],
              })
            }

            if (url.endsWith("/CreateRoom")) {
              const body = await getJsonBody(input, init)

              currentRoomName = String(body.name)

              return jsonResponse({
                name: currentRoomName,
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
          },
          async () => {
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
            expect(result.binding.sessionId).toBe(created.session.sessionId)
            expect(result.binding.roomName).toStartWith(
              `session-${created.session.sessionId.slice(0, 8)}-`
            )
            expect(result.binding.roomName).not.toBe(created.session.sessionId)
            expect(
              getSessionRoomBinding(created.session.sessionId)?.roomName
            ).toBe(result.binding.roomName)
            expect(result.participantToken.length).toBeGreaterThan(0)
            expect(result.serverUrl).toBe(LIVEKIT_TEST_ENV.LIVEKIT_URL)
          }
        )
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
        await withMockedFetch(
          async (input, init) => {
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
              const body = await getJsonBody(input, init)

              return jsonResponse({
                name: body.name,
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
          },
          async () => {
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
          }
        )
      })
    })
  })

  it("reuses existing room and dispatch on repeated connect requests", async () => {
    await withTestDatabase(async () => {
      await withLiveKitEnv(async () => {
        const calls = {
          createDispatch: 0,
          createRoom: 0,
          listDispatch: 0,
          listRooms: 0,
        }
        let dispatchExists = false
        let currentRoomName: string | null = null

        await withMockedFetch(
          async (input, init) => {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url

            if (url.endsWith("/ListRooms")) {
              calls.listRooms += 1
              const body = await getJsonBody(input, init)
              const requestedNames = Array.isArray(body.names)
                ? (body.names as string[])
                : []
              const requestedRoom = requestedNames[0]

              return jsonResponse({
                rooms:
                  requestedRoom === currentRoomName && currentRoomName
                    ? [{ name: currentRoomName }]
                    : [],
              })
            }

            if (url.endsWith("/CreateRoom")) {
              calls.createRoom += 1
              const body = await getJsonBody(input, init)

              currentRoomName = String(body.name)

              return jsonResponse({
                name: currentRoomName,
                sid: "RM_123",
              })
            }

            if (url.endsWith("/ListDispatch")) {
              calls.listDispatch += 1

              return jsonResponse({
                agentDispatches: dispatchExists
                  ? [
                      {
                        agentName: "agent",
                        id: "dispatch-1",
                        metadata: '{"sessionId":"session"}',
                        room: "room-name",
                      },
                    ]
                  : [],
              })
            }

            if (url.endsWith("/CreateDispatch")) {
              calls.createDispatch += 1
              dispatchExists = true

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
          },
          async () => {
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
            const firstConnectResponse = await app.handle(
              new Request(
                `http://localhost/sessions/${created.session.sessionId}/connect`,
                {
                  method: "POST",
                }
              )
            )
            const secondConnectResponse = await app.handle(
              new Request(
                `http://localhost/sessions/${created.session.sessionId}/connect`,
                {
                  method: "POST",
                }
              )
            )

            expect(firstConnectResponse.status).toBe(200)
            expect(secondConnectResponse.status).toBe(200)

            const firstResult =
              (await firstConnectResponse.json()) as ConnectSessionResult
            const secondResult =
              (await secondConnectResponse.json()) as ConnectSessionResult

            expect(firstResult.binding.roomName).toBe(
              secondResult.binding.roomName
            )
            expect(firstResult.binding.roomName).not.toBe(
              created.session.sessionId
            )
            expect(firstResult.participantToken).not.toBe(
              secondResult.participantToken
            )
            expect(calls.listRooms).toBe(3)
            expect(calls.listDispatch).toBe(2)
            expect(calls.createRoom).toBe(1)
            expect(calls.createDispatch).toBe(1)
          }
        )
      })
    })
  })

  it("adopts a legacy room binding when roomName matches the existing sessionId", async () => {
    await withTestDatabase(async () => {
      await withLiveKitEnv(async () => {
        const listRoomsCalls: string[][] = []
        let legacyRoomName: string | null = null

        await withMockedFetch(
          async (input, init) => {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url

            if (url.endsWith("/ListRooms")) {
              const body = await getJsonBody(input, init)
              const requestedNames = (body.names as string[] | undefined) ?? []

              listRoomsCalls.push(requestedNames)

              return jsonResponse({
                rooms:
                  requestedNames[0] === legacyRoomName && legacyRoomName
                    ? [{ name: legacyRoomName }]
                    : [],
              })
            }

            if (url.endsWith("/CreateRoom")) {
              return new Response(
                "CreateRoom should not be called for legacy adopt",
                {
                  status: 500,
                }
              )
            }

            if (url.endsWith("/ListDispatch")) {
              return jsonResponse({
                agentDispatches: [],
              })
            }

            if (url.endsWith("/CreateDispatch")) {
              return jsonResponse({
                agentName: "agent",
                id: "dispatch-legacy",
                metadata: '{"sessionId":"session"}',
                room: "legacy-room",
              })
            }

            return new Response("Unexpected fetch", {
              status: 500,
            })
          },
          async () => {
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
            legacyRoomName = created.session.sessionId
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

            expect(listRoomsCalls).toEqual([[created.session.sessionId]])
            expect(result.binding.roomName).toBe(created.session.sessionId)
            expect(result.binding.sessionId).toBe(created.session.sessionId)
            expect(
              getSessionRoomBinding(created.session.sessionId)?.roomName
            ).toBe(created.session.sessionId)
          }
        )
      })
    })
  })

  it("reuses the current binding on repeated connect without creating a second business session", async () => {
    await withTestDatabase(async () => {
      await withLiveKitEnv(async () => {
        const createRoomCalls: string[] = []
        const listRoomsCalls: string[][] = []
        const replacementRoomName = "replacement-room"

        await withMockedFetch(
          async (input, init) => {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url

            if (url.endsWith("/ListRooms")) {
              const body = await getJsonBody(input, init)
              const requestedNames = (body.names as string[] | undefined) ?? []

              listRoomsCalls.push(requestedNames)

              return jsonResponse({
                rooms:
                  requestedNames[0] === replacementRoomName
                    ? [{ name: replacementRoomName }]
                    : [],
              })
            }

            if (url.endsWith("/CreateRoom")) {
              const body = await getJsonBody(input, init)

              createRoomCalls.push(String(body.name))

              return jsonResponse({
                name: body.name,
                sid: "RM_replace",
              })
            }

            if (url.endsWith("/ListDispatch")) {
              return jsonResponse({
                agentDispatches: [
                  {
                    agentName: "agent",
                    id: "dispatch-1",
                    metadata: '{"sessionId":"session"}',
                    room: replacementRoomName,
                  },
                ],
              })
            }

            if (url.endsWith("/CreateDispatch")) {
              return new Response(
                "CreateDispatch should not be called when binding is reused",
                {
                  status: 500,
                }
              )
            }

            return new Response("Unexpected fetch", {
              status: 500,
            })
          },
          async () => {
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
            const sessionId = created.session.sessionId

            upsertSessionRoomBinding({
              roomName: replacementRoomName,
              sessionId,
            })

            const firstConnectResponse = await app.handle(
              new Request(`http://localhost/sessions/${sessionId}/connect`, {
                method: "POST",
              })
            )
            const secondConnectResponse = await app.handle(
              new Request(`http://localhost/sessions/${sessionId}/connect`, {
                method: "POST",
              })
            )

            expect(firstConnectResponse.status).toBe(200)
            expect(secondConnectResponse.status).toBe(200)

            const firstResult =
              (await firstConnectResponse.json()) as ConnectSessionResult
            const secondResult =
              (await secondConnectResponse.json()) as ConnectSessionResult

            expect(firstResult.sessionId).toBe(sessionId)
            expect(secondResult.sessionId).toBe(sessionId)
            expect(firstResult.binding.roomName).toBe(replacementRoomName)
            expect(secondResult.binding.roomName).toBe(replacementRoomName)
            expect(listRoomsCalls).toEqual([
              [replacementRoomName],
              [replacementRoomName],
            ])
            expect(createRoomCalls).toEqual([])
          }
        )
      })
    })
  })
})
