import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "dotenv"

const REQUIRED_ENV_KEYS = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
] as const

type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number]

export interface AgentEnvDiagnostics {
  sourcePath: string
  loadedFromFile: boolean
  missing: RequiredEnvKey[]
  values: Partial<Record<RequiredEnvKey, string>>
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()

  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

function resolveAgentEnvPath(): string {
  const cwdCandidate = resolve(process.cwd(), "../../.env")
  if (existsSync(cwdCandidate)) {
    return cwdCandidate
  }

  const moduleCandidate = resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../../.env"
  )
  if (existsSync(moduleCandidate)) {
    return moduleCandidate
  }

  return cwdCandidate
}

export function loadAgentEnv({
  strict,
  sourcePath: explicitSourcePath,
}: {
  strict: boolean
  sourcePath?: string
}): AgentEnvDiagnostics {
  const sourcePath = explicitSourcePath ?? resolveAgentEnvPath()
  const loadedFromFile = existsSync(sourcePath)
  const fileValues = loadedFromFile
    ? parse(readFileSync(sourcePath, "utf8"))
    : {}
  const missing: RequiredEnvKey[] = []
  const values: Partial<Record<RequiredEnvKey, string>> = {}

  for (const key of REQUIRED_ENV_KEYS) {
    const value = normalizeEnvValue(fileValues[key] ?? process.env[key])

    if (value === undefined) {
      missing.push(key)
      continue
    }

    values[key] = value
    process.env[key] = value
  }

  if (strict && missing.length > 0) {
    throw new Error(
      `Missing required LiveKit env vars from root .env: ${missing.join(", ")}`
    )
  }

  return {
    sourcePath,
    loadedFromFile,
    missing,
    values,
  }
}
