import type {
  CreateSessionInput,
  CreateSessionResult,
  GetSessionResult,
  PresetRecipe,
  SessionSnapshot,
} from "@yes-chief/shared"
import { getDatabase } from "../persistence/db"
import { getPresetRecipeById, seedPresetRecipes } from "../seed/preset-recipes"

type SessionRow = {
  id: string
  recipeId: string
  status: string
  currentStepIndex: number
  snapshotJson: string
  createdAt: string
  updatedAt: string
}

const toSessionSnapshot = (snapshot: SessionSnapshot): SessionSnapshot =>
  snapshot

const buildSessionSnapshot = (recipe: PresetRecipe): SessionSnapshot => {
  const currentStep = recipe.steps[0]

  if (!currentStep) {
    throw new Error(
      `Preset recipe "${recipe.id}" must contain at least one step`
    )
  }

  const now = new Date().toISOString()

  return {
    sessionId: crypto.randomUUID(),
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    status: "active",
    currentStepIndex: 0,
    currentStep,
    totalSteps: recipe.steps.length,
    createdAt: now,
    updatedAt: now,
  }
}

export const createSession = (
  input: CreateSessionInput,
  databaseUrl?: string
): CreateSessionResult | null => {
  seedPresetRecipes(databaseUrl)

  const recipe = getPresetRecipeById(input.recipeId, databaseUrl)

  if (!recipe) {
    return null
  }

  const session = buildSessionSnapshot(recipe)
  const sqlite = getDatabase(databaseUrl)

  sqlite
    .prepare(`
      INSERT INTO sessions (
        "id",
        "recipeId",
        "status",
        "currentStepIndex",
        "snapshotJson",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ?1,
        ?2,
        ?3,
        ?4,
        ?5,
        ?6,
        ?7
      )
    `)
    .run(
      session.sessionId,
      session.recipeId,
      session.status,
      session.currentStepIndex,
      JSON.stringify(session),
      session.createdAt,
      session.updatedAt
    )

  return {
    session: toSessionSnapshot(session),
  }
}

export const getSessionById = (
  sessionId: string,
  databaseUrl?: string
): GetSessionResult | null => {
  const sqlite = getDatabase(databaseUrl)
  const row = sqlite
    .prepare(`
      SELECT
        "id",
        "recipeId",
        "status",
        "currentStepIndex",
        "snapshotJson",
        "createdAt",
        "updatedAt"
      FROM sessions
      WHERE "id" = ?1
      LIMIT 1
    `)
    .get(sessionId) as SessionRow | undefined

  if (!row) {
    return null
  }

  const session = JSON.parse(row.snapshotJson) as SessionSnapshot

  return {
    session: toSessionSnapshot(session),
  }
}
