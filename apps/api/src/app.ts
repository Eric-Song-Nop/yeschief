import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"
import { healthRoutes } from "./routes/health"
import { recipesRoutes } from "./routes/recipes"
import { sessionsRoutes } from "./routes/sessions"

export const DEFAULT_CORS_ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
] as const

export const resolveCorsAllowedOrigins = (
  value = Bun.env.CORS_ALLOWED_ORIGINS ?? process.env.CORS_ALLOWED_ORIGINS
) => {
  const configuredOrigins =
    value
      ?.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0) ?? []

  return configuredOrigins.length > 0
    ? configuredOrigins
    : [...DEFAULT_CORS_ALLOWED_ORIGINS]
}

export const buildApp = () =>
  new Elysia()
    .use(
      cors({
        origin: resolveCorsAllowedOrigins(),
      })
    )
    .use(healthRoutes)
    .use(recipesRoutes)
    .use(sessionsRoutes)
