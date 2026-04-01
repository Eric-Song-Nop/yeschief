import type { RecipeStep } from "./recipe"

export type SessionStatus = "active" | "completed"

export type SessionSnapshot = {
  sessionId: string
  recipeId: string
  recipeTitle: string
  status: SessionStatus
  currentStepIndex: number
  currentStep: RecipeStep
  totalSteps: number
  createdAt: string
  updatedAt: string
}

export type CreateSessionInput = {
  recipeId: string
}

export type CreateSessionResult = {
  session: SessionSnapshot
}

export type GetSessionResult = {
  session: SessionSnapshot
}
