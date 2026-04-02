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
        title: "Gather ingredients",
        instruction:
          "Bring the eggs, salt, and butter to your cooking station. Set out a mixing bowl and fork.",
        focus: "Have everything ready before you start cooking.",
        tips: [
          "Room temperature eggs whisk more evenly.",
          "Use a 10-inch nonstick pan for best results.",
        ],
        heatLevel: "off",
        donenessNotes: "All ingredients are at hand and ready to use.",
        ingredientIds: ["egg", "salt", "butter"],
        timerHintSec: 0,
      },
      {
        id: "step-2",
        title: "Crack and whisk eggs",
        instruction:
          "Crack the eggs into a bowl, add a pinch of salt, and whisk until yolks and whites are fully blended.",
        focus: "Create a smooth mixture without whipping in too much air.",
        tips: [
          "Stop whisking once the mixture looks evenly yellow.",
          "A fork works better than a whisk to avoid foaming.",
        ],
        heatLevel: "off",
        donenessNotes: "The egg mixture should still pour easily.",
        ingredientIds: ["egg", "salt"],
        timerHintSec: 0,
      },
      {
        id: "step-3",
        title: "Heat pan and melt butter",
        instruction:
          "Place the pan over low heat and add the butter. Let it melt and coat the bottom evenly.",
        focus: "Warm the pan gently without browning the butter.",
        tips: [
          "Low heat prevents the butter from burning.",
          "Swirl the pan to coat the entire surface.",
        ],
        heatLevel: "low",
        donenessNotes: "Butter should be melted and slightly foamy, not browned.",
        ingredientIds: ["butter"],
        timerHintSec: 60,
      },
      {
        id: "step-4",
        title: "Pour eggs and cook slowly",
        instruction:
          "Pour in the egg mixture and let it set slightly, then gently stir with a spatula to create soft curds.",
        focus: "Form tender curds without browning the eggs.",
        tips: [
          "Pull the pan off the heat briefly if the eggs firm up too fast.",
          "Use a spatula to scrape the edges toward the center.",
        ],
        heatLevel: "low",
        donenessNotes:
          "The center should still look slightly glossy and underdone.",
        ingredientIds: ["egg"],
        timerHintSec: 90,
      },
      {
        id: "step-5",
        title: "Fold the omelette",
        instruction:
          "Tilt the pan forward and use your spatula to fold the omelette into thirds or in half.",
        focus: "Create a neat fold while the center is still slightly soft.",
        tips: [
          "Work quickly before the eggs set completely.",
          "A loose fold is fine—don't overthink it.",
        ],
        heatLevel: "off",
        donenessNotes: "The omelette should look folded but still soft inside.",
        ingredientIds: ["egg"],
        timerHintSec: 30,
      },
      {
        id: "step-6",
        title: "Transfer to plate",
        instruction:
          "Slide the folded omelette onto a warm plate and serve immediately.",
        focus: "Serve while hot and the center is still creamy.",
        tips: [
          "Use the pan's momentum to help slide it out.",
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
        title: "Gather and rinse rice",
        instruction:
          "Measure the rice and place it in a fine-mesh strainer. Rinse under cold water until the water runs mostly clear.",
        focus: "Remove excess starch so the grains stay fluffy and separate.",
        tips: [
          "Use your hand to gently swirl the rice—don't crush the grains.",
          "Rinse 2 to 3 times until water is no longer cloudy.",
        ],
        heatLevel: "off",
        donenessNotes:
          "The grains should look clean and the water should run clear.",
        ingredientIds: ["rice", "water"],
        timerHintSec: 0,
      },
      {
        id: "step-2",
        title: "Drain rice thoroughly",
        instruction:
          "Let the rice drain completely in the strainer, shaking off excess water.",
        focus: "Remove as much water as possible before cooking.",
        tips: [
          "Shake the strainer gently to release trapped water.",
          "Wet rice won't toast properly in the butter.",
        ],
        heatLevel: "off",
        donenessNotes: "Rice should be damp but not dripping.",
        ingredientIds: ["rice"],
        timerHintSec: 120,
      },
      {
        id: "step-3",
        title: "Melt butter",
        instruction:
          "Place a small saucepan over medium heat and add the butter. Let it melt completely.",
        focus: "Warm the butter without letting it brown.",
        tips: [
          "Medium heat gives you control—don't rush it.",
          "The butter should coat the bottom of the pan.",
        ],
        heatLevel: "medium",
        donenessNotes: "Butter should be fully melted and slightly foamy.",
        ingredientIds: ["butter"],
        timerHintSec: 60,
      },
      {
        id: "step-4",
        title: "Sauté garlic",
        instruction:
          "Add the minced garlic to the melted butter and cook for 30 seconds until fragrant.",
        focus: "Release the garlic aroma without burning it.",
        tips: [
          "Do not let the garlic brown or it will taste bitter.",
          "Stir constantly to prevent burning.",
        ],
        heatLevel: "medium",
        donenessNotes: "Garlic should smell fragrant but remain pale.",
        ingredientIds: ["garlic", "butter"],
        timerHintSec: 30,
      },
      {
        id: "step-5",
        title: "Toast rice",
        instruction:
          "Add the drained rice to the pan and stir to coat each grain with butter. Toast for 1 to 2 minutes.",
        focus: "Coat the grains with fat to add flavor and prevent sticking.",
        tips: [
          "Stir gently to avoid breaking the grains.",
          "The rice will look slightly translucent around the edges.",
        ],
        heatLevel: "medium",
        donenessNotes: "Rice should be coated and slightly fragrant.",
        ingredientIds: ["rice", "butter"],
        timerHintSec: 90,
      },
      {
        id: "step-6",
        title: "Add water and simmer",
        instruction:
          "Pour in the water and salt, stir once, then cover and reduce heat to low. Simmer for 15 minutes without lifting the lid.",
        focus: "Let the rice steam undisturbed to cook evenly.",
        tips: [
          "Resist the urge to peek—the steam is doing the work.",
          "Once the lid is on, keep the heat low and avoid stirring.",
        ],
        heatLevel: "low",
        donenessNotes: "The liquid should be fully absorbed.",
        ingredientIds: ["water", "salt", "rice"],
        timerHintSec: 900,
      },
      {
        id: "step-7",
        title: "Rest and fluff",
        instruction:
          "Turn off the heat and let the rice rest covered for 5 minutes. Then fluff with a fork and serve.",
        focus: "Let the steam finish cooking the center of the rice.",
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
