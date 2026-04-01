import type {
  CreateSessionInput,
  CreateSessionResult,
  GetSessionResult,
  PresetRecipe,
  SessionSnapshot,
} from "@yes-chief/shared"
import { getDatabase } from "../persistence/db"
import { getPresetRecipeById, seedPresetRecipes } from "../seed/preset-recipes"
import { listTimers } from "./timers"

type SessionRow = {
  id: string
  recipeId: string
  status: string
  currentStepIndex: number
  snapshotJson: string
  createdAt: string
  updatedAt: string
}

const buildFallbackRecipeContext = (
  snapshot: Pick<
    SessionSnapshot,
    "currentStep" | "recipeId" | "recipeTitle" | "totalSteps"
  >
): PresetRecipe => ({
  equipment: [],
  id: snapshot.recipeId,
  ingredients: [],
  slug: snapshot.recipeId,
  stepCount: snapshot.totalSteps,
  steps: [snapshot.currentStep],
  substitutions: [],
  title: snapshot.recipeTitle,
})

const toSessionSnapshot = (
  snapshot: SessionSnapshot,
  databaseUrl?: string
): SessionSnapshot => {
  const recipeContext =
    snapshot.recipeContext ??
    getPresetRecipeById(snapshot.recipeId, databaseUrl) ??
    buildFallbackRecipeContext(snapshot)

  const currentStep =
    recipeContext.steps[snapshot.currentStepIndex] ?? snapshot.currentStep

  const timers = listTimers(snapshot.sessionId, databaseUrl).timers
  const activeTimers =
    timers.length > 0
      ? timers.filter((timer) => timer.status === "running")
      : snapshot.activeTimers ?? []

  return {
    ...snapshot,
    activeTimers,
    currentStep,
    lastCommandResult: snapshot.lastCommandResult ?? null,
    recipeContext,
    totalSteps: recipeContext.steps.length,
  }
}

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
    recipeContext: recipe,
    activeTimers: [],
    lastCommandResult: null,
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
    session: toSessionSnapshot(session, databaseUrl),
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
    session: toSessionSnapshot(session, databaseUrl),
  }
}

export const persistSessionSnapshot = (
  session: SessionSnapshot,
  databaseUrl?: string
) => {
  const sqlite = getDatabase(databaseUrl)
  const hydratedSession = toSessionSnapshot(session, databaseUrl)

  sqlite
    .prepare(`
      UPDATE sessions
      SET
        "status" = ?2,
        "currentStepIndex" = ?3,
        "snapshotJson" = ?4,
        "updatedAt" = ?5
      WHERE "id" = ?1
    `)
    .run(
      hydratedSession.sessionId,
      hydratedSession.status,
      hydratedSession.currentStepIndex,
      JSON.stringify(hydratedSession),
      hydratedSession.updatedAt
    )

  return hydratedSession
}
