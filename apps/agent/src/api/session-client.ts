import type {
  GetSessionResult,
  GetSessionTimersResult,
  SessionCommandRequest,
  SessionCommandResponse,
} from "@yes-chief/shared"

const DEFAULT_API_BASE_URL = "http://localhost:3000"

const buildError = async (response: Response) => {
  try {
    const payload = (await response.json()) as { message?: string }

    return new Error(
      payload.message ?? `API request failed with ${response.status}`
    )
  } catch {
    return new Error(`API request failed with ${response.status}`)
  }
}

export class SessionApiClient {
  readonly baseUrl: string

  constructor(
    baseUrl = process.env.YES_CHIEF_API_BASE_URL ?? DEFAULT_API_BASE_URL
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "")
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init)

    if (!response.ok) {
      throw await buildError(response)
    }

    return (await response.json()) as T
  }

  getSession(sessionId: string): Promise<GetSessionResult> {
    return this.requestJson<GetSessionResult>(`/sessions/${sessionId}`)
  }

  postCommand(
    sessionId: string,
    request: SessionCommandRequest
  ): Promise<SessionCommandResponse> {
    return this.requestJson<SessionCommandResponse>(
      `/sessions/${sessionId}/commands`,
      {
        body: JSON.stringify(request),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }
    )
  }

  getTimers(sessionId: string): Promise<GetSessionTimersResult> {
    return this.requestJson<GetSessionTimersResult>(
      `/sessions/${sessionId}/timers`
    )
  }
}

export type SessionApiClientLike = Pick<
  SessionApiClient,
  "getSession" | "postCommand" | "getTimers"
>
