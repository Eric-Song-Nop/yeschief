import { describe, expect, it } from "vitest"
import { loadAgentEnv } from "./env"

describe("agent runtime smoke", () => {
  it("imports the entrypoint and resolves the root env path", async () => {
    const agentModule = await import("./main")
    const diagnostics = loadAgentEnv({ strict: false })
    const legacyEnvFile = [".env", "local"].join(".")

    expect(agentModule.default).toBeDefined()
    expect(diagnostics.sourcePath).toContain(".env")
    expect(diagnostics.sourcePath).not.toContain(legacyEnvFile)
  })
})
