import type {
  SessionCommandRequest,
  SessionCommandResponse,
  SessionCommandResult,
  SessionSnapshot,
} from "@yes-chief/shared"
import { getSessionById, persistSessionSnapshot } from "./sessions"
import {
  cancelRunningTimersForSession,
  cancelTimer,
  createTimer,
  listTimers,
} from "./timers"

const createServiceError = (status: number, message: string) =>
  Object.assign(new Error(message), { status })

const buildResult = (
  session: SessionSnapshot,
  commandType: SessionCommandRequest["type"],
  message: string,
  timerId?: string | null
): SessionCommandResult => ({
  commandType,
  ok: true,
  message,
  sessionId: session.sessionId,
  timerId: timerId ?? null,
})

const getRequiredSession = (sessionId: string, databaseUrl?: string) => {
  const result = getSessionById(sessionId, databaseUrl)

  if (!result) {
    throw createServiceError(404, "Session not found")
  }

  return result.session
}

const persistWithResult = (
  session: SessionSnapshot,
  result: SessionCommandResult,
  databaseUrl?: string
): SessionCommandResponse => {
  const updatedSession = persistSessionSnapshot(
    {
      ...session,
      lastCommandResult: result,
      updatedAt: new Date().toISOString(),
    },
    databaseUrl
  )

  return {
    session: updatedSession,
    result,
  }
}

export const runSessionCommand = (
  request: SessionCommandRequest & { sessionId: string },
  databaseUrl?: string
): SessionCommandResponse => {
  const session = getRequiredSession(request.sessionId, databaseUrl)

  switch (request.type) {
    case "advance_step": {
      if (session.status !== "active") {
        throw createServiceError(
          409,
          "advance_step is only allowed while the session is active"
        )
      }

      const isFinalStep =
        session.currentStepIndex >= session.recipeContext.steps.length - 1

      if (isFinalStep) {
        return persistWithResult(
          session,
          buildResult(
            session,
            request.type,
            "You are already at the final step."
          ),
          databaseUrl
        )
      }

      const nextStepIndex = session.currentStepIndex + 1
      const nextSession = {
        ...session,
        currentStepIndex: nextStepIndex,
        currentStep: session.recipeContext.steps[nextStepIndex]!,
      }

      return persistWithResult(
        nextSession,
        buildResult(
          nextSession,
          request.type,
          `Moved to step ${nextStepIndex + 1}.`
        ),
        databaseUrl
      )
    }

    case "pause_session": {
      if (session.status !== "active") {
        throw createServiceError(
          409,
          "pause_session is only allowed while the session is active"
        )
      }

      const nextSession = {
        ...session,
        status: "paused" as const,
      }

      return persistWithResult(
        nextSession,
        buildResult(nextSession, request.type, "Session paused."),
        databaseUrl
      )
    }

    case "resume_session": {
      if (session.status !== "paused") {
        throw createServiceError(
          409,
          "resume_session is only allowed from the paused state"
        )
      }

      const nextSession = {
        ...session,
        status: "active" as const,
      }

      return persistWithResult(
        nextSession,
        buildResult(nextSession, request.type, "Session resumed."),
        databaseUrl
      )
    }

    case "end_session": {
      if (session.status === "completed") {
        return {
          session,
          result: buildResult(
            session,
            request.type,
            "Session already completed."
          ),
        }
      }

      cancelRunningTimersForSession(session.sessionId, databaseUrl)
      const timers = listTimers(session.sessionId, databaseUrl).timers
      const completedAt = new Date().toISOString()

      const nextSession = {
        ...session,
        status: "completed" as const,
        activeTimers: [],
        summary: {
          recipeTitle: session.recipeTitle,
          completedAt,
          finalStepIndex: session.currentStepIndex,
          totalSteps: session.totalSteps,
          expiredTimerCount: timers.filter((timer) => timer.status === "expired")
            .length,
          cancelledTimerCount: timers.filter(
            (timer) => timer.status === "cancelled"
          ).length,
          completionMessage: "本次做菜已结束。",
        },
      }

      return persistWithResult(
        nextSession,
        buildResult(nextSession, request.type, "Session completed."),
        databaseUrl
      )
    }

    case "create_timer": {
      const timer = createTimer(
        {
          sessionId: session.sessionId,
          stepIndex: request.stepIndex ?? session.currentStepIndex,
          label: request.label ?? "",
          durationSec: request.durationSec ?? 0,
        },
        databaseUrl
      )

      const nextSession = {
        ...session,
        activeTimers: listTimers(session.sessionId, databaseUrl).timers.filter(
          (activeTimer) => activeTimer.status === "running"
        ),
      }

      return persistWithResult(
        nextSession,
        buildResult(
          nextSession,
          request.type,
          `Created timer "${timer.label}".`,
          timer.timerId
        ),
        databaseUrl
      )
    }

    case "cancel_timer": {
      const timer = cancelTimer(
        {
          sessionId: session.sessionId,
          timerId: request.timerId,
          label: request.label,
        },
        databaseUrl
      )

      const nextSession = {
        ...session,
        activeTimers: listTimers(session.sessionId, databaseUrl).timers.filter(
          (activeTimer) => activeTimer.status === "running"
        ),
      }

      return persistWithResult(
        nextSession,
        buildResult(
          nextSession,
          request.type,
          `Cancelled timer "${timer.label}".`,
          timer.timerId
        ),
        databaseUrl
      )
    }
  }
}
