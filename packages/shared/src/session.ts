import type { PresetRecipe, RecipeStep } from "./recipe"

export type SessionStatus = "active" | "paused" | "completed"

export type SessionTimerStatus = "running" | "cancelled" | "expired"

export type SessionTimer = {
  timerId: string
  label: string
  stepIndex: number
  durationSec: number
  startedAt: string
  targetAt: string
  status: SessionTimerStatus
  remainingSec?: number
}

export type SessionCommandType =
  | "advance_step"
  | "pause_session"
  | "resume_session"
  | "end_session"
  | "create_timer"
  | "cancel_timer"

export type SessionCommandRequest = {
  type: SessionCommandType
  durationSec?: number
  label?: string
  stepIndex?: number
  timerId?: string
}

export type SessionCommandResult = {
  commandType: SessionCommandType
  ok: boolean
  message: string
  sessionId: string
  timerId?: string | null
}

export type SessionSnapshot = {
  sessionId: string
  recipeId: string
  recipeTitle: string
  status: SessionStatus
  currentStepIndex: number
  currentStep: RecipeStep
  totalSteps: number
  recipeContext: PresetRecipe
  activeTimers: SessionTimer[]
  lastCommandResult: SessionCommandResult | null
  createdAt: string
  updatedAt: string
}

export type SessionCommandResponse = {
  session: SessionSnapshot
  result: SessionCommandResult
}

export type GetSessionTimersResult = {
  sessionId: string
  timers: SessionTimer[]
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

export type ConnectSessionResult = {
  sessionId: string
  roomName: string
  participantToken: string
  serverUrl: string
}
