import type { RecipeSummary } from "@yes-chief/shared"
import { listPresetRecipes } from "../seed/preset-recipes"

export const getPresetRecipeSummaries = (
  databaseUrl?: string
): RecipeSummary[] => listPresetRecipes(databaseUrl)
