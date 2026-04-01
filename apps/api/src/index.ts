import { buildApp } from "./app"
import { loadApiEnv } from "./env"

loadApiEnv()

const port = Number(Bun.env.PORT ?? "3000")

const app = buildApp().listen(port)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
