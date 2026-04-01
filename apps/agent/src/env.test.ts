import { beforeEach, describe, expect, it } from "vitest"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadAgentEnv } from "./env"

const REQUIRED_KEYS = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
] as const

describe("loadAgentEnv", () => {
  beforeEach(() => {
    for (const key of REQUIRED_KEYS) {
      delete process.env[key]
    }
  })

  it("reports missing keys in strict mode", () => {
    expect(() =>
      loadAgentEnv({
        strict: true,
        sourcePath: join(tmpdir(), "yes-chief-missing-agent-env"),
      })
    ).toThrow(/LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET/)
  })
})
