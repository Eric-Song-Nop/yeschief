import type { CreateSessionResult, RecipeSummary } from "@yes-chief/shared"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

type ApiError = {
  message?: string
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
