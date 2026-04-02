import { describe, expect, it, vi } from "vitest"
import { loadAgentEnv } from "./env"
import { registerGracefulShutdown } from "./main"

const ROOM_DISCONNECTED_EVENT = "disconnected" as const

const createFakeRoom = () => {
  const listeners = new Map<string, Set<() => void>>()

  return {
    emit(event: typeof ROOM_DISCONNECTED_EVENT) {
      for (const listener of listeners.get(event) ?? []) {
        listener()
      }
    },
    off(event: typeof ROOM_DISCONNECTED_EVENT, listener: () => void) {
      listeners.get(event)?.delete(listener)
    },
    on(event: typeof ROOM_DISCONNECTED_EVENT, listener: () => void) {
      const existing = listeners.get(event) ?? new Set<() => void>()
      existing.add(listener)
      listeners.set(event, existing)
    },
  }
}

describe("agent runtime smoke", () => {
  it("imports the entrypoint and resolves the root env path", async () => {
    const agentModule = await import("./main")
    const diagnostics = loadAgentEnv({ strict: false })
    const legacyEnvFile = [".env", "local"].join(".")

    expect(agentModule.default).toBeDefined()
    expect(diagnostics.sourcePath).toContain(".env")
    expect(diagnostics.sourcePath).not.toContain(legacyEnvFile)
  })

  it("gracefully tears down timer loop and session only once", async () => {
    const room = createFakeRoom()
    const shutdownCallbacks: Array<() => Promise<void>> = []
    const stopTimerReminderLoop = vi.fn()
    const closeSession = vi.fn().mockResolvedValue(undefined)
    const shutdown = vi.fn()

    const { teardown } = registerGracefulShutdown({
      ctx: {
        addShutdownCallback(callback) {
          shutdownCallbacks.push(callback)
        },
        room,
        shutdown,
      },
      session: {
        close: closeSession,
      },
      stopTimerReminderLoop,
    })

    expect(shutdownCallbacks).toHaveLength(1)

    room.emit(ROOM_DISCONNECTED_EVENT)
    room.emit(ROOM_DISCONNECTED_EVENT)

    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(shutdown).toHaveBeenCalledWith("room disconnected")

    await teardown()
    await shutdownCallbacks[0]!()
    await teardown()

    expect(stopTimerReminderLoop).toHaveBeenCalledTimes(1)
    expect(closeSession).toHaveBeenCalledTimes(1)
  })
})
