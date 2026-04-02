import type {
  ConnectSessionResult,
  CreateSessionResult,
  GetSessionResult,
  GetSessionTimersResult,
  RecipeSummary,
  SessionTimer,
} from "@yes-chief/shared"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

type ApiError = {
  message?: string
}

export type CompanionTimer = {
  timerId: string
  label: string
  status: SessionTimer["status"]
  stepIndex: number
  remainingTimeLabel: string
}

const formatCountdownLabel = (seconds?: number) => {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "--:--"
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  return `${minutes}:${remainder.toString().padStart(2, "0")}`
}

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const error = (await response.json()) as ApiError

      if (typeof error.message === "string" && error.message.length > 0) {
        message = error.message
      }
    } catch {}

    throw new Error(message)
  }

  return (await response.json()) as T
}

export const listPresetRecipes = () =>
  requestJson<RecipeSummary[]>("/recipes/presets")

export const createSession = (recipeId: string) =>
  requestJson<CreateSessionResult>("/sessions", {
    body: JSON.stringify({ recipeId }),
    method: "POST",
  })

export const connectSession = (sessionId: string) =>
  requestJson<ConnectSessionResult>(`/sessions/${sessionId}/connect`, {
    method: "POST",
  })

export const getSession = (sessionId: string) =>
  requestJson<GetSessionResult>(`/sessions/${sessionId}`)

export const listSessionTimers = (sessionId: string) =>
  requestJson<GetSessionTimersResult>(`/sessions/${sessionId}/timers`)

export const toCompanionTimers = (timers: SessionTimer[]): CompanionTimer[] =>
  timers.map((timer) => ({
    timerId: timer.timerId,
    label: timer.label,
    status: timer.status,
    stepIndex: timer.stepIndex,
    remainingTimeLabel: formatCountdownLabel(timer.remainingSec),
  }))
