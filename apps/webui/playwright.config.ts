import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "@playwright/test"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadRootEnv = () => {
  const envPath = path.resolve(currentDir, "../../.env")

  if (!existsSync(envPath)) {
    return {}
  }

  return readFileSync(envPath, "utf8")
    .split(/\r?\n/u)
    .reduce<Record<string, string>>((env, line) => {
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
}

const findInstalledChromiumExecutable = () => {
  const cacheDir = path.join(process.env.HOME ?? "", ".cache/ms-playwright")

  if (!existsSync(cacheDir)) {
    return undefined
  }

  const chromiumDirectories = readdirSync(cacheDir)
    .filter((entry) => entry.startsWith("chromium-"))
    .sort()
    .reverse()

  for (const directory of chromiumDirectories) {
    const executablePath = path.join(
      cacheDir,
      directory,
      "chrome-linux64",
      "chrome"
    )

    if (existsSync(executablePath)) {
      return executablePath
    }
  }

  return undefined
}

const rootEnv = loadRootEnv()

for (const [key, value] of Object.entries(rootEnv)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}

const missingLiveKitEnv = [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
].filter((key) => !process.env[key] || process.env[key]?.trim().length === 0)

process.env.PLAYWRIGHT_MISSING_LIVEKIT_ENV = missingLiveKitEnv.join(",")

const chromiumExecutablePath = findInstalledChromiumExecutable()

const webServerEnv = Object.entries(process.env).reduce<Record<string, string>>(
  (env, [key, value]) => {
    if (typeof value === "string") {
      env[key] = value
    }

    return env
  },
  {}
)

export default defineConfig({
  testDir: "./test",
  testMatch: /.*\.e2e\.ts/u,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
      ...(chromiumExecutablePath
        ? {
            executablePath: chromiumExecutablePath,
          }
        : {}),
    },
    permissions: ["microphone"],
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: 'bun run --cwd "../.." --filter api dev',
      env: {
        ...webServerEnv,
        PORT: "3300",
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:3300/health",
    },
    {
      command:
        'bun run --cwd "../.." --filter webui dev -- --host 127.0.0.1 --port 4173 --strictPort',
      env: {
        ...webServerEnv,
        VITE_API_BASE_URL: "http://127.0.0.1:3300",
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:4173",
    },
  ],
})
