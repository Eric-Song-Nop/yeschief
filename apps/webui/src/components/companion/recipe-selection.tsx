import type { RecipeSummary } from "@yes-chief/shared"
import { CheckCircle2, LoaderCircle, Soup } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type RecipeSelectionProps = {
  canJoinVoice: boolean
  createError?: string
  isCreatingSession: boolean
  isJoiningVoice: boolean
  isLoadingRecipes: boolean
  onCreateSession: () => void
  onJoinVoice: () => void
  onSelectRecipe: (recipeId: string) => void
  recipes: RecipeSummary[]
  recipesError?: string
  selectedRecipeId: string
}

export function RecipeSelection({
  canJoinVoice,
  createError = "",
  isCreatingSession,
  isJoiningVoice,
  isLoadingRecipes,
  onCreateSession,
  onJoinVoice,
  onSelectRecipe,
  recipes,
  recipesError = "",
  selectedRecipeId,
}: RecipeSelectionProps) {
  return (
    <Card className="border-border/70 bg-card/96 shadow-lg shadow-primary/5">
      <CardHeader className="gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Soup className="size-3.5" />
          Discovery
        </div>
        <CardTitle className="text-2xl md:text-3xl">
          先选一道菜，再接通语音 tutor
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {recipesError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {recipesError}
          </div>
        ) : null}

        <div
          aria-label="选择菜谱"
          className="grid gap-3 md:grid-cols-2"
          role="radiogroup"
        >
          {isLoadingRecipes
            ? Array.from({ length: 4 }, (_, index) => (
                <div
                  className="rounded-3xl border border-border/70 bg-background/85 p-4"
                  key={`recipe-skeleton-${index}`}
                >
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-4 h-4 w-1/3" />
                  <Skeleton className="mt-2 h-4 w-full" />
                </div>
              ))
            : recipes.map((recipe) => {
                const isSelected = recipe.id === selectedRecipeId

                return (
                  <button
                    aria-checked={isSelected}
                    aria-label={`选择菜谱 ${recipe.title}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "rounded-3xl border p-4 text-left transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected
                        ? "border-primary/45 bg-primary/8 shadow-md shadow-primary/10"
                        : "border-border/70 bg-background/85 hover:border-primary/20 hover:bg-primary/[0.04]"
                    )}
                    key={recipe.id}
                    onClick={() => onSelectRecipe(recipe.id)}
                    role="radio"
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-medium">
                          {recipe.title}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          共 {recipe.stepCount} 步
                        </div>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                      ) : null}
                    </div>
                  </button>
                )
              })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            className="min-h-12 text-base"
            disabled={
              !selectedRecipeId ||
              isCreatingSession ||
              isLoadingRecipes ||
              isJoiningVoice
            }
            onClick={onCreateSession}
          >
            {isCreatingSession ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                正在开始
              </>
            ) : (
              "开始这道菜"
            )}
          </Button>
          <Button
            className="min-h-12 text-base"
            disabled={!canJoinVoice || isCreatingSession || isJoiningVoice}
            onClick={onJoinVoice}
            variant="secondary"
          >
            {isJoiningVoice ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                正在接通
              </>
            ) : (
              "接通语音指导"
            )}
          </Button>
        </div>

        {createError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {createError}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
