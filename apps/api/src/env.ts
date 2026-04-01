import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export interface ApiEnvDiagnostics {
  sourcePath: string
  loadedFromFile: boolean
  values: Record<string, string>
}

const parseEnvFile = (contents: string) =>
  contents.split(/\r?\n/u).reduce<Record<string, string>>((env, line) => {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return env
    }

    const separatorIndex = trimmedLine.indexOf("=")

    if (separatorIndex === -1) {
      return env
    }

    const key = trimmedLine.slice(0, separatorIndex).trim()
    let value = trimmedLine.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    env[key] = value

    return env
  }, {})

const resolveApiEnvPath = () => {
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

export const loadApiEnv = ({
  sourcePath: explicitSourcePath,
}: {
  sourcePath?: string
} = {}): ApiEnvDiagnostics => {
  const sourcePath = explicitSourcePath ?? resolveApiEnvPath()
  const loadedFromFile = existsSync(sourcePath)
  const values = loadedFromFile
    ? parseEnvFile(readFileSync(sourcePath, "utf8"))
    : {}

  for (const [key, value] of Object.entries(values)) {
    if (!process.env[key]) {
      process.env[key] = value
    }

    if (!Bun.env[key]) {
      Bun.env[key] = value
    }
  }

  return {
    sourcePath,
    loadedFromFile,
    values,
  }
}
