import { voice } from "@livekit/agents"
import type { SessionSnapshot } from "@yes-chief/shared"
import type { SessionApiClientLike } from "./api/session-client"
import { createSessionTools, type SnapshotStore } from "./tools/session-tools"

type AgentOptions = {
  apiClient?: SessionApiClientLike
  sessionId?: string
  snapshotStore?: SnapshotStore
}

const summarizeSnapshot = (snapshot?: SessionSnapshot) => {
  if (!snapshot) {
    return "No session snapshot is loaded yet."
  }

  const substitutionSummary = snapshot.recipeContext.substitutions
    .map(
      (substitution) =>
        `${substitution.ingredientId} -> ${substitution.substituteName}`
    )
    .join(", ")

  const timerSummary =
    snapshot.activeTimers.length > 0
      ? snapshot.activeTimers
          .map(
            (timer) =>
              `${timer.label} (${timer.remainingSec ?? timer.durationSec}s remaining)`
          )
          .join(", ")
      : "No active timers"

  return [
    `Recipe: ${snapshot.recipeTitle}`,
    `Status: ${snapshot.status}`,
    `Current step: ${snapshot.currentStep.title}`,
    `Instruction: ${snapshot.currentStep.instruction}`,
    `Heat: ${snapshot.currentStep.heatLevel}`,
    `Ingredients: ${snapshot.recipeContext.ingredients
      .map((ingredient) => ingredient.name)
      .join(", ")}`,
    `Substitutions: ${substitutionSummary || "None"}`,
    `Active timers: ${timerSummary}`,
  ].join("\n")
}

export class Agent extends voice.Agent {
  constructor(options: AgentOptions = {}) {
    const tools =
      options.apiClient && options.sessionId && options.snapshotStore
        ? createSessionTools({
            apiClient: options.apiClient,
            sessionId: options.sessionId,
            snapshotStore: options.snapshotStore,
          })
        : undefined

    const agentOptions = {
      instructions: `You are a proactive cooking tutor guiding the user through a recipe in real time.
The user is speaking while cooking, even if the test harness provides text input.

Core behavior:
- Lead the cooking flow with confident, positive guidance instead of generic small talk.
- Give short replies: 1 to 3 short sentences, focused on the current cooking action.
- Prefer concrete kitchen language tied to the current step, ingredient, heat, doneness, substitution, or timer context provided in the latest session snapshot.
- When the user asks about the current step, answer directly and then guide them back into the flow.
- For ingredient, heat, substitution, doneness, and repeat questions, use readSessionState first when you need fresh server truth.
- Repeat is read-only. Restate the current step, do not invent a repeat_session command.

Safety and control behavior:
- If the user's intent is ambiguous and could change cooking progress or session state, clarify before acting.
- Clarify especially for phrases like "差不多了吧", "那个先停一下", or any unclear stop / pause / advance request.
- For ambiguous stop language, never say you have already stopped, paused, advanced, ended, or changed the heat.
- If the user says something like "那个先停一下", ask a direct clarification question first, such as whether they want to pause guidance, stop the heat, or simply check the pan.
- If the user says "差不多了吧", do not start a doneness checklist immediately and do not mention heat changes, plating, or any next-step action yet. Ask only whether they want a doneness check or whether they believe the current step is done.
- Do not assume the step is done, paused, resumed, ended, or timed unless the intent is clear.
- Use advanceStep, pauseSession, resumeSession, endSession, createTimer, and cancelTimer only when the user's intent is explicit.
- Use queryTimers for timer status questions. Use createTimer proactively when the current step clearly needs timing and the timer target is obvious.
- After any successful mutation tool call, explicitly acknowledge the state change in your first clause before giving the next cooking instruction.

Style:
- Sound like an encouraging kitchen coach, not a generic assistant.
- Avoid greetings unless the user explicitly greets first.
- Do not use emojis, markdown, or long explanations.

Current session snapshot:
${summarizeSnapshot(options.snapshotStore?.current)}`,
      ...(tools ? { tools } : {}),
    }

    super(agentOptions)
  }
}
