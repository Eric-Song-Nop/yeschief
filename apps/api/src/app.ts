import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"
import { healthRoutes } from "./routes/health"
import { recipesRoutes } from "./routes/recipes"
import { sessionsRoutes } from "./routes/sessions"

export const buildApp = () =>
  new Elysia()
    .use(
      cors({
        origin: [
          "http://localhost:4173",
          "http://localhost:5173",
          "http://127.0.0.1:4173",
          "http://127.0.0.1:5173",
        ],
      })
    )
    .use(healthRoutes)
    .use(recipesRoutes)
    .use(sessionsRoutes)
