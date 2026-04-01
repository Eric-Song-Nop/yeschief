import { llm } from "@livekit/agents"
import type {
  SessionCommandResponse,
  SessionSnapshot,
  SessionTimer,
} from "@yes-chief/shared"
import type { SessionApiClientLike } from "../api/session-client"

export type SnapshotStore = {
  current: SessionSnapshot
}

type SessionToolOptions = {
  apiClient: SessionApiClientLike
  sessionId: string
  snapshotStore: SnapshotStore
}

const syncTimersIntoSnapshot = (
  snapshot: SessionSnapshot,
  timers: SessionTimer[]
): SessionSnapshot => ({
  ...snapshot,
  activeTimers: timers.filter((timer) => timer.status === "running"),
  updatedAt: new Date().toISOString(),
})

const summarizeSession = (session: SessionSnapshot) => ({
  activeTimers: session.activeTimers.map((timer) => ({
    label: timer.label,
    remainingSec: timer.remainingSec ?? timer.durationSec,
    timerId: timer.timerId,
  })),
  currentStepIndex: session.currentStepIndex,
  currentStepInstruction: session.currentStep.instruction,
  currentStepTitle: session.currentStep.title,
  heatLevel: session.currentStep.heatLevel,
  recipeTitle: session.recipeTitle,
  status: session.status,
})

const toCommandPayload = (response: SessionCommandResponse) => ({
  ...summarizeSession(response.session),
  commandType: response.result.commandType,
  message: response.result.message,
  timerId: response.result.timerId ?? null,
})

export const createSessionTools = ({
  apiClient,
  sessionId,
  snapshotStore,
}: SessionToolOptions) => ({
  readSessionState: llm.tool({
    description:
      "Read the latest session snapshot before answering questions about the current step, ingredients, heat, substitutions, doneness, or when you need to repeat the current step.",
    execute: async () => {
      const result = await apiClient.getSession(sessionId)
      snapshotStore.current = result.session

      return {
        ...summarizeSession(result.session),
        ingredients: result.session.recipeContext.ingredients,
        substitutions: result.session.recipeContext.substitutions,
      }
    },
  }),

  advanceStep: llm.tool({
    description:
      "Advance to the next cooking step only when the user clearly asks for the next step.",
    execute: async () => {
      const response = await apiClient.postCommand(sessionId, {
        type: "advance_step",
      })
      snapshotStore.current = response.session

      return toCommandPayload(response)
    },
  }),

  pauseSession: llm.tool({
    description:
      "Pause the cooking session only when the user explicitly wants to pause guidance or the session.",
    execute: async () => {
      const response = await apiClient.postCommand(sessionId, {
        type: "pause_session",
      })
      snapshotStore.current = response.session

      return toCommandPayload(response)
    },
  }),

  resumeSession: llm.tool({
    description:
      "Resume the cooking session only when the user clearly asks to continue after a pause.",
    execute: async () => {
      const response = await apiClient.postCommand(sessionId, {
        type: "resume_session",
      })
      snapshotStore.current = response.session

      return toCommandPayload(response)
    },
  }),

  endSession: llm.tool({
    description:
      "End the cooking session only when the user clearly says the session should end.",
    execute: async () => {
      const response = await apiClient.postCommand(sessionId, {
        type: "end_session",
      })
      snapshotStore.current = response.session

      return toCommandPayload(response)
    },
  }),

  createTimer: llm.tool({
    description:
      "Create a timer when the user clearly asks for one, or when the current step naturally needs timing and the timer target is obvious.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        durationSec: {
          type: "number",
          minimum: 1,
        },
        label: {
          type: "string",
          minLength: 1,
        },
      },
      required: ["durationSec", "label"],
    },
    execute: async ({ durationSec, label }) => {
      const response = await apiClient.postCommand(sessionId, {
        type: "create_timer",
        durationSec,
        label,
      })
      snapshotStore.current = response.session

      return toCommandPayload(response)
    },
  }),

  cancelTimer: llm.tool({
    description:
      "Cancel a timer only when the user clearly asks to cancel it. Prefer timerId when available, otherwise use a unique label.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        label: {
          type: "string",
          minLength: 1,
        },
        timerId: {
          type: "string",
          minLength: 1,
        },
      },
    },
    execute: async ({ label, timerId }) => {
      const response = await apiClient.postCommand(sessionId, {
        type: "cancel_timer",
        label,
        timerId,
      })
      snapshotStore.current = response.session

      return toCommandPayload(response)
    },
  }),

  queryTimers: llm.tool({
    description:
      "Query the latest timers when the user asks about timers, remaining time, expired timers, or cancelled timers.",
    execute: async () => {
      const result = await apiClient.getTimers(sessionId)
      snapshotStore.current = syncTimersIntoSnapshot(
        snapshotStore.current,
        result.timers
      )

      return {
        sessionId,
        timers: result.timers,
      }
    },
  }),
})
