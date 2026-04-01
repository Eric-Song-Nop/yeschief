import type { CreateSessionResult, RecipeSummary } from "@yes-chief/shared"
import { useEffect, useState } from "react"
import { LoaderCircle, Soup } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createSession, listPresetRecipes } from "@/lib/api"

export function App() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [selectedRecipeId, setSelectedRecipeId] = useState("")
  const [sessionResult, setSessionResult] =
    useState<CreateSessionResult | null>(null)
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true)
  const [recipesError, setRecipesError] = useState("")
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [createError, setCreateError] = useState("")

  useEffect(() => {
    let cancelled = false

    const loadRecipes = async () => {
      setIsLoadingRecipes(true)
      setRecipesError("")

      try {
        const nextRecipes = await listPresetRecipes()

        if (cancelled) {
          return
        }

        setRecipes(nextRecipes)
        setSelectedRecipeId(
          (currentRecipeId) => currentRecipeId || nextRecipes[0]?.id || ""
        )
      } catch (error) {
        if (cancelled) {
          return
        }

        setRecipesError(
          error instanceof Error ? error.message : "加载 preset recipes 失败。"
        )
      } finally {
        if (!cancelled) {
          setIsLoadingRecipes(false)
        }
      }
    }

    void loadRecipes()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedRecipe =
    recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null

  const handleCreateSession = async () => {
    if (!selectedRecipeId) {
      setCreateError("请先选择一个 recipe。")
      return
    }

    setIsCreatingSession(true)
    setCreateError("")

    try {
      const result = await createSession(selectedRecipeId)
      setSessionResult(result)
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "创建 session 失败。"
      )
    } finally {
      setIsCreatingSession(false)
    }
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,oklch(0.99_0.02_95),transparent_45%),linear-gradient(180deg,oklch(0.99_0.01_95),oklch(0.97_0.01_95))] px-6 py-10 text-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Soup className="size-3.5" />
                Phase 1 Session Bootstrap
              </div>
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                  选择 preset recipe 并创建 cooking session
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  这个页面只验证 Session truth source 是否在 Web 层闭环。
                  当前范围仅包含 recipe 选择、session 创建和初始 step 展示。
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/60 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                API Base
              </div>
              <div className="mt-1 font-mono text-sm">
                {import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Preset Recipes
              </h2>
              {isLoadingRecipes ? (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  正在加载
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  共 {recipes.length} 个 recipe
                </div>
              )}
            </div>

            {recipesError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {recipesError}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              {recipes.map((recipe) => {
                const isSelected = recipe.id === selectedRecipeId

                return (
                  <button
                    key={recipe.id}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/70 bg-background/70 hover:border-primary/40 hover:bg-muted/60",
                    ].join(" ")}
                    onClick={() => setSelectedRecipeId(recipe.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{recipe.title}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {recipe.slug}
                        </div>
                      </div>
                      <div className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                        {recipe.stepCount} steps
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {!isLoadingRecipes && recipes.length === 0 && !recipesError ? (
              <div className="rounded-2xl border border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
                当前没有可用的 preset recipe。
              </div>
            ) : null}
          </div>
        </section>

        <aside className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Create Session
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              选择 recipe 后调用 API 创建 session，并展示返回的初始快照。
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-border/70 bg-muted/40 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              当前选择
            </div>
            {selectedRecipe ? (
              <div className="mt-3 space-y-2">
                <div className="text-lg font-medium">
                  {selectedRecipe.title}
                </div>
                <div className="text-sm text-muted-foreground">
                  recipeId:{" "}
                  <span className="font-mono text-foreground">
                    {selectedRecipe.id}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  stepCount: {selectedRecipe.stepCount}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">
                先从左侧列表选择一个 recipe。
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button
              className="min-w-40"
              disabled={
                !selectedRecipeId || isCreatingSession || isLoadingRecipes
              }
              onClick={() => void handleCreateSession()}
            >
              {isCreatingSession ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  正在创建
                </>
              ) : (
                "Create Session"
              )}
            </Button>
            <div className="text-sm text-muted-foreground">
              仅创建 session，不加入 LiveKit 房间。
            </div>
          </div>

          {createError ? (
            <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {createError}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Session Snapshot
            </div>
            {sessionResult ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    sessionId
                  </div>
                  <div className="mt-1 font-mono text-sm">
                    {sessionResult.session.sessionId}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      recipeTitle
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {sessionResult.session.recipeTitle}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      status
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {sessionResult.session.status}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    currentStep
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {sessionResult.session.currentStep.title}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {sessionResult.session.currentStep.instruction}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
                创建成功后，这里会显示 `sessionId`、`recipeTitle`、`status` 和
                `currentStep.title`。
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}

export default App
