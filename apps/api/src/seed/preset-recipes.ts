import type { PresetRecipe, RecipeSummary, RecipeStep } from "@yes-chief/shared"
import { getDatabase } from "../persistence/db"

type PresetRecipeSeed = Omit<PresetRecipe, "stepCount">

const presetRecipeSeeds = [
  {
    id: "recipe-omelette",
    slug: "simple-omelette",
    title: "Simple Omelette",
    ingredients: [
      {
        id: "egg",
        amount: "3",
        name: "large eggs",
        notes: "Room temperature eggs whisk more evenly.",
        preparation: "lightly beaten",
      },
      {
        id: "salt",
        amount: "1 pinch",
        name: "kosher salt",
      },
      {
        id: "butter",
        amount: "1 tbsp",
        name: "unsalted butter",
      },
    ],
    substitutions: [
      {
        ingredientId: "butter",
        reason:
          "Works if dairy is unavailable or the user wants a lighter finish.",
        substituteIngredientId: "olive-oil",
        substituteName: "olive oil",
      },
    ],
    equipment: ["mixing bowl", "fork or chopsticks", "10-inch nonstick pan"],
    steps: [
      {
        id: "step-1",
        title: "Beat the eggs",
        instruction:
          "Whisk the eggs with salt until the yolks and whites fully blend.",
        focus: "Build a smooth mixture without whipping in too much air.",
        tips: [
          "Stop whisking once the mixture looks evenly yellow.",
          "A fork keeps the eggs tender without foaming them up.",
        ],
        heatLevel: "off",
        donenessNotes: "The egg mixture should still pour easily.",
        ingredientIds: ["egg", "salt"],
        timerHintSec: 0,
      },
      {
        id: "step-2",
        title: "Cook gently",
        instruction:
          "Melt the butter, pour in the eggs, and stir slowly over low heat.",
        focus: "Set soft curds without browning the eggs.",
        tips: [
          "Pull the pan off the heat briefly if the eggs firm up too fast.",
          "Use a spatula to scrape the edges toward the center.",
        ],
        heatLevel: "low",
        donenessNotes:
          "The center should still look slightly glossy before folding.",
        ingredientIds: ["butter", "egg"],
        timerHintSec: 90,
      },
      {
        id: "step-3",
        title: "Fold and serve",
        instruction:
          "Fold the omelette into thirds, then slide it onto a warm plate.",
        focus: "Finish the omelette before it turns dry.",
        tips: [
          "Tilt the pan forward to help the fold.",
          "Serve immediately for the best texture.",
        ],
        heatLevel: "off",
        donenessNotes:
          "The omelette should stay pale, soft, and slightly creamy inside.",
        ingredientIds: ["egg"],
        timerHintSec: 0,
      },
    ],
  },
  {
    id: "recipe-garlic-rice",
    slug: "garlic-butter-rice",
    title: "Garlic Butter Rice",
    ingredients: [
      {
        id: "rice",
        amount: "1 cup",
        name: "jasmine rice",
        notes: "Rinse until the water turns mostly clear.",
      },
      {
        id: "garlic",
        amount: "3 cloves",
        name: "garlic",
        preparation: "minced",
      },
      {
        id: "butter",
        amount: "1 tbsp",
        name: "unsalted butter",
      },
      {
        id: "water",
        amount: "1 1/4 cups",
        name: "water",
      },
      {
        id: "salt",
        amount: "1/4 tsp",
        name: "salt",
      },
    ],
    substitutions: [
      {
        ingredientId: "butter",
        reason: "Keeps the rice fragrant when butter is unavailable.",
        substituteIngredientId: "neutral-oil",
        substituteName: "neutral oil",
      },
      {
        ingredientId: "jasmine-rice",
        reason:
          "Short-grain rice changes the texture, but basmati keeps a fluffy grain.",
        substituteIngredientId: "basmati-rice",
        substituteName: "basmati rice",
      },
    ],
    equipment: ["fine-mesh strainer", "small saucepan with lid", "fork"],
    steps: [
      {
        id: "step-1",
        title: "Rinse the rice",
        instruction:
          "Rinse the rice until the water runs mostly clear, then drain well.",
        focus: "Wash away excess starch so the grains stay fluffy.",
        tips: [
          "Swirl gently so the grains do not break.",
          "Drain thoroughly before the rice hits the butter.",
        ],
        heatLevel: "off",
        donenessNotes:
          "The grains should look clean and separate after rinsing.",
        ingredientIds: ["rice", "water"],
        timerHintSec: 0,
      },
      {
        id: "step-2",
        title: "Cook with butter",
        instruction:
          "Warm the butter, bloom the garlic for 30 seconds, then simmer the rice with water and salt.",
        focus: "Coat the grains with fat and keep the simmer gentle.",
        tips: [
          "Do not let the garlic brown or it will taste bitter.",
          "Once the lid is on, keep the heat low and avoid stirring.",
        ],
        heatLevel: "medium",
        donenessNotes: "The liquid should barely bubble once covered.",
        ingredientIds: ["butter", "garlic", "rice", "water", "salt"],
        timerHintSec: 900,
      },
      {
        id: "step-3",
        title: "Rest before serving",
        instruction:
          "Turn off the heat, rest the rice covered for 5 minutes, then fluff with a fork.",
        focus: "Let the steam finish the rice before serving.",
        tips: [
          "Keep the lid closed during the rest so trapped steam can finish the center.",
          "Fluff from the bottom up to avoid crushing the grains.",
        ],
        heatLevel: "off",
        donenessNotes:
          "The rice should look tender and separate easily with a fork.",
        ingredientIds: ["rice"],
        timerHintSec: 300,
      },
    ],
  },
] satisfies PresetRecipeSeed[]

const presetRecipeSeedById = new Map(
  presetRecipeSeeds.map((recipe) => [recipe.id, recipe])
)

const getTimestamp = () => new Date().toISOString()

const rowToPresetRecipe = (row: {
  id: string
  slug: string
  title: string
  stepsJson: string
}): PresetRecipe => {
  const seed = presetRecipeSeedById.get(row.id)
  const steps = JSON.parse(row.stepsJson) as RecipeStep[]

  return {
    equipment: seed?.equipment ?? [],
    id: row.id,
    ingredients: seed?.ingredients ?? [],
    slug: row.slug,
    stepCount: steps.length,
    steps,
    substitutions: seed?.substitutions ?? [],
    title: row.title,
  }
}

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
