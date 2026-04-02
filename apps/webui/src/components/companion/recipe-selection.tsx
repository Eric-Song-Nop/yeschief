import type { RecipeSummary } from "@yes-chief/shared"
import { CheckCircle2, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type RecipeSelectionProps = {
  createError?: string
  isCreatingSession: boolean
  isLoadingRecipes: boolean
  onCreateSession: () => void
  onSelectRecipe: (recipeId: string) => void
  recipes: RecipeSummary[]
  recipesError?: string
  selectedRecipeId: string
}

export function RecipeSelection({
  createError = "",
  isCreatingSession,
  isLoadingRecipes,
  onCreateSession,
  onSelectRecipe,
  recipes,
  recipesError = "",
  selectedRecipeId,
}: RecipeSelectionProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-16 pt-12 md:pt-20">
      {/* Hero Header */}
      <div className="space-y-4">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
          Start New Session
        </div>
        <h1 className="text-balance text-6xl font-light leading-[1.1] tracking-tight text-foreground sm:text-7xl md:text-8xl">
          What would you like to cook?
        </h1>
        <p className="text-xl font-medium text-muted-foreground/60 md:text-2xl">
          Choose a recipe, or continue a previous session from below.
        </p>
      </div>

      <div className="space-y-12">
        {recipesError ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            {recipesError}
          </div>
        ) : null}

        <div
          aria-label="Select Recipe"
          className="grid gap-6 sm:grid-cols-2"
          role="radiogroup"
        >
          {isLoadingRecipes
            ? Array.from({ length: 4 }, (_, index) => (
                <div
                  className="rounded-[2.5rem] border border-border/40 bg-background/40 p-8"
                  key={`recipe-skeleton-${index}`}
                >
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="mt-6 h-4 w-1/4" />
                </div>
              ))
            : recipes.map((recipe) => {
                const isSelected = recipe.id === selectedRecipeId

                return (
                  <button
                    aria-checked={isSelected}
                    aria-label={`Select recipe ${recipe.title}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "group relative flex flex-col items-start rounded-[2.5rem] p-8 text-left transition-all duration-300 outline-none",
                      isSelected
                        ? "bg-primary/[0.04] ring-1 ring-primary/20"
                        : "bg-background/40 hover:bg-background/60 hover:ring-1 hover:ring-border/60"
                    )}
                    key={recipe.id}
                    onClick={() => onSelectRecipe(recipe.id)}
                    role="radio"
                    type="button"
                  >
                    <div className="flex w-full items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div
                          className={cn(
                            "font-medium transition-all duration-300",
                            isSelected
                              ? "text-3xl text-primary md:text-4xl"
                              : "text-2xl text-foreground md:text-3xl"
                          )}
                        >
                          {recipe.title}
                        </div>
                        <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/40">
                          {recipe.stepCount} steps
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="h-8 w-8 text-primary/60" />
                      ) : null}
                    </div>

                    {/* Subtle selection indicator */}
                    {isSelected && (
                      <div className="absolute -left-1 top-1/2 h-12 w-1 -translate-y-1/2 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
        </div>

        <div className="flex flex-col items-center gap-8 pt-8">
          <Button
            className={cn(
              "h-20 min-w-[280px] rounded-full px-12 text-xl font-medium transition-all active:scale-[0.98]",
              !selectedRecipeId && "opacity-50 grayscale"
            )}
            disabled={!selectedRecipeId || isCreatingSession || isLoadingRecipes}
            onClick={onCreateSession}
            size="lg"
          >
            {isCreatingSession ? (
              <>
                <LoaderCircle className="mr-3 h-6 w-6 animate-spin" />
                Preparing for you...
              </>
            ) : (
              "Start Cooking"
            )}
          </Button>

          {createError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-3 text-sm text-destructive">
              {createError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
