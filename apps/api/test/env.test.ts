import { beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadApiEnv } from "../src/env"

const TEST_KEYS = [
  "DATABASE_URL",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
] as const

describe("loadApiEnv", () => {
  beforeEach(() => {
    for (const key of TEST_KEYS) {
      delete process.env[key]
      delete Bun.env[key]
    }
  })

  it("loads root env values into Bun.env", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "yes-chief-api-env-"))
    const envPath = join(tempDir, ".env")

    writeFileSync(
      envPath,
      [
        "DATABASE_URL=./apps/api/data/yes-chief.sqlite",
        "LIVEKIT_URL=wss://livekit.example.test",
        "LIVEKIT_API_KEY=test-api-key",
        "LIVEKIT_API_SECRET=test-api-secret",
      ].join("\n")
    )

    try {
      const diagnostics = loadApiEnv({
        sourcePath: envPath,
      })

      expect(diagnostics.loadedFromFile).toBe(true)
      expect(Bun.env.DATABASE_URL).toBe("./apps/api/data/yes-chief.sqlite")
      expect(Bun.env.LIVEKIT_URL).toBe("wss://livekit.example.test")
      expect(Bun.env.LIVEKIT_API_KEY).toBe("test-api-key")
      expect(Bun.env.LIVEKIT_API_SECRET).toBe("test-api-secret")
    } finally {
      rmSync(tempDir, {
        force: true,
        recursive: true,
      })
    }
  })
})
