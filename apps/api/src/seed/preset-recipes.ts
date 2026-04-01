import type { PresetRecipe, RecipeSummary } from "@yes-chief/shared"
import { getDatabase } from "../persistence/db"

type PresetRecipeSeed = Omit<PresetRecipe, "stepCount">

const presetRecipeSeeds = [
  {
    id: "recipe-omelette",
    slug: "simple-omelette",
    title: "Simple Omelette",
    steps: [
      {
        id: "step-1",
        title: "Beat the eggs",
        instruction: "Whisk the eggs with a pinch of salt until fully blended.",
      },
      {
        id: "step-2",
        title: "Cook gently",
        instruction: "Pour into a warm pan and cook slowly until just set.",
      },
      {
        id: "step-3",
        title: "Fold and serve",
        instruction: "Fold the omelette, plate it, and serve immediately.",
      },
    ],
  },
  {
    id: "recipe-garlic-rice",
    slug: "garlic-butter-rice",
    title: "Garlic Butter Rice",
    steps: [
      {
        id: "step-1",
        title: "Rinse the rice",
        instruction: "Rinse the rice until the water runs mostly clear.",
      },
      {
        id: "step-2",
        title: "Cook with butter",
        instruction:
          "Simmer the rice with butter, garlic, and water until tender.",
      },
      {
        id: "step-3",
        title: "Rest before serving",
        instruction:
          "Let the rice rest for a few minutes, then fluff and serve.",
      },
    ],
  },
] satisfies PresetRecipeSeed[]

const getTimestamp = () => new Date().toISOString()

const rowToPresetRecipe = (row: {
  id: string
  slug: string
  title: string
  stepsJson: string
}): PresetRecipe => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  stepCount: JSON.parse(row.stepsJson).length,
  steps: JSON.parse(row.stepsJson) as PresetRecipe["steps"],
})

export const seedPresetRecipes = (databaseUrl?: string) => {
  const sqlite = getDatabase(databaseUrl)

  sqlite.exec("BEGIN")

  try {
    const statement = sqlite.prepare(`
      INSERT INTO preset_recipes (
        "id",
        "slug",
        "title",
        "stepsJson",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ?1,
        ?2,
        ?3,
        ?4,
        ?5,
        ?5
      )
      ON CONFLICT("slug") DO UPDATE SET
        "title" = excluded."title",
        "stepsJson" = excluded."stepsJson",
        "updatedAt" = excluded."updatedAt"
    `)

    for (const recipe of presetRecipeSeeds) {
      const now = getTimestamp()

      statement.run(
        recipe.id,
        recipe.slug,
        recipe.title,
        JSON.stringify(recipe.steps),
        now
      )
    }

    sqlite.exec("COMMIT")
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  }

  return presetRecipeSeeds
}

export const listPresetRecipes = (databaseUrl?: string): RecipeSummary[] => {
  seedPresetRecipes(databaseUrl)

  const sqlite = getDatabase(databaseUrl)
  const rows = sqlite
    .prepare(`
      SELECT
        "id",
        "slug",
        "title",
        "stepsJson"
      FROM preset_recipes
      ORDER BY "slug" ASC
    `)
    .all() as Array<{
    id: string
    slug: string
    title: string
    stepsJson: string
  }>

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    stepCount: JSON.parse(row.stepsJson).length,
  }))
}

export const getPresetRecipeById = (
  recipeId: string,
  databaseUrl?: string
): PresetRecipe | null => {
  seedPresetRecipes(databaseUrl)

  const sqlite = getDatabase(databaseUrl)
  const row = sqlite
    .prepare(`
      SELECT
        "id",
        "slug",
        "title",
        "stepsJson"
      FROM preset_recipes
      WHERE "id" = ?1
      LIMIT 1
    `)
    .get(recipeId) as
    | {
        id: string
        slug: string
        title: string
        stepsJson: string
      }
    | undefined

  return row ? rowToPresetRecipe(row) : null
}
