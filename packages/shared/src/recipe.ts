export type RecipeHeatLevel = "off" | "low" | "medium" | "medium-high" | "high"

export type RecipeIngredient = {
  id: string
  name: string
  amount: string
  preparation?: string
  notes?: string
}

export type RecipeSubstitution = {
  ingredientId: string
  substituteIngredientId?: string
  substituteName: string
  reason: string
  notes?: string
}

export type RecipeStep = {
  id: string
  title: string
  instruction: string
  focus: string
  tips: string[]
  heatLevel: RecipeHeatLevel
  donenessNotes: string
  ingredientIds: string[]
  timerHintSec: number
}

export type RecipeSummary = {
  id: string
  slug: string
  title: string
  stepCount: number
}

export type PresetRecipe = RecipeSummary & {
  ingredients: RecipeIngredient[]
  substitutions: RecipeSubstitution[]
  equipment: string[]
  steps: RecipeStep[]
}
