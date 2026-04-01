export type RecipeStep = {
  id: string
  title: string
  instruction: string
}

export type RecipeSummary = {
  id: string
  slug: string
  title: string
  stepCount: number
}

export type PresetRecipe = RecipeSummary & {
  steps: RecipeStep[]
}
