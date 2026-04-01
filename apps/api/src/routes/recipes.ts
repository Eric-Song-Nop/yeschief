import { Elysia } from "elysia"
import { getPresetRecipeSummaries } from "../services/preset-recipes"

export const recipesRoutes = new Elysia({ name: "recipes-routes" }).get(
  "/recipes/presets",
  () => getPresetRecipeSummaries()
)
