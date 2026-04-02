import type { SessionSnapshot, SessionTimer } from "@yes-chief/shared"
import { getDatabase } from "../src/persistence/db"
import { createSession } from "../src/services/sessions"

export const buildRecipeContextFixture = () => ({
  equipment: ["10-inch nonstick pan", "mixing bowl", "rubber spatula"],
  id: "recipe-omelette",
  ingredients: [
    {
      id: "egg",
      amount: "3",
      name: "large eggs",
      notes: "room temperature for easier whisking",
      preparation: "lightly beaten",
    },
    {
      id: "butter",
      amount: "1 tbsp",
      name: "unsalted butter",
    },
  ],
  slug: "simple-omelette",
  stepCount: 3,
  steps: [
    {
      id: "step-1",
      title: "Beat the eggs",
      instruction: "Whisk until the yolks and whites are fully blended.",
      focus: "Build an even egg mixture without bubbles.",
      tips: [
        "Use a fork or chopsticks to avoid over-whisking.",
        "Stop once the mixture looks uniformly yellow.",
      ],
      heatLevel: "off",
      donenessNotes: "The eggs should still pour easily.",
      ingredientIds: ["egg"],
      timerHintSec: 0,
    },
    {
      id: "step-2",
      title: "Cook gently",
      instruction: "Melt the butter and cook the eggs over low heat.",
      focus: "Keep the curds soft and glossy.",
      tips: ["Stir slowly from the outside in."],
      heatLevel: "low",
      donenessNotes: "The center should be softly set before folding.",
      ingredientIds: ["egg", "butter"],
      timerHintSec: 90,
    },
    {
      id: "step-3",
      title: "Fold and serve",
      instruction: "Fold the omelette and slide it onto a warm plate.",
      focus: "Finish before the eggs brown.",
      tips: ["Tilt the pan to help the fold."],
      heatLevel: "off",
      donenessNotes: "The omelette should stay pale and tender.",
      ingredientIds: ["egg"],
      timerHintSec: 0,
    },
  ],
  substitutions: [
    {
      ingredientId: "butter",
      reason: "Reduce dairy or use what is already in the kitchen.",
      substituteIngredientId: "olive-oil",
      substituteName: "olive oil",
    },
  ],
  title: "Simple Omelette",
})

export const buildRunningTimerFixture = () => ({
  durationSec: 90,
  label: "Low heat cook",
  startedAt: "2026-04-01T09:00:00.000Z",
  status: "running",
  stepIndex: 1,
  targetAt: "2026-04-01T09:01:30.000Z",
  timerId: "timer-fixture-1",
})

export const buildPausedSessionSnapshotFixture = () => {
  const recipeContext = buildRecipeContextFixture()

  return {
    sessionId: "session-fixture-paused",
    recipeId: recipeContext.id,
    recipeTitle: recipeContext.title,
    status: "paused",
    currentStepIndex: 1,
    currentStep: recipeContext.steps[1],
    totalSteps: recipeContext.steps.length,
    recipeContext,
    activeTimers: [buildRunningTimerFixture()],
    lastCommandResult: {
      commandType: "pause_session",
      message: "Paused while the pan stays warm.",
      ok: true,
      sessionId: "session-fixture-paused",
    },
    summary: null,
    createdAt: "2026-04-01T08:59:00.000Z",
    updatedAt: "2026-04-01T09:00:00.000Z",
  }
}

export const seedCommandableSession = (databaseUrl?: string) => {
  const result = createSession(
    {
      recipeId: "recipe-omelette",
    },
    databaseUrl
  )

  if (!result) {
    throw new Error("Expected preset recipe session seed to succeed")
  }

  return result.session
}

type SeedRunningTimerInput = {
  databaseUrl?: string
  session: Pick<SessionSnapshot, "currentStepIndex" | "sessionId">
  durationSec?: number
  label?: string
  startedAt?: string
  status?: SessionTimer["status"]
  targetAt?: string
  timerId?: string
}

export const seedRunningTimer = ({
  databaseUrl,
  session,
  durationSec = 90,
  label = "Low heat cook",
  startedAt = "2026-04-01T09:00:00.000Z",
  status = "running",
  targetAt = "2026-04-01T09:01:30.000Z",
  timerId = "timer-fixture-1",
}: SeedRunningTimerInput) => {
  const sqlite = getDatabase(databaseUrl)
  const now = startedAt

  sqlite
    .prepare(`
      INSERT INTO timers (
        "id",
        "sessionId",
        "label",
        "stepIndex",
        "durationSec",
        "startedAt",
        "targetAt",
        "status",
        "createdAt",
        "updatedAt",
        "cancelledAt",
        "expiredAt"
      ) VALUES (
        ?1,
        ?2,
        ?3,
        ?4,
        ?5,
        ?6,
        ?7,
        ?8,
        ?9,
        ?10,
        ?11,
        ?12
      )
    `)
    .run(
      timerId,
      session.sessionId,
      label,
      session.currentStepIndex,
      durationSec,
      startedAt,
      targetAt,
      status,
      now,
      now,
      status === "cancelled" ? now : null,
      status === "expired" ? now : null
    )

  return {
    durationSec,
    label,
    startedAt,
    status,
    stepIndex: session.currentStepIndex,
    targetAt,
    timerId,
  } satisfies SessionTimer
}
