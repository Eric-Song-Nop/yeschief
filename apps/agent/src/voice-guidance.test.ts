import { inference, initializeLogger, voice } from "@livekit/agents"
import type {
  GetSessionResult,
  GetSessionTimersResult,
  SessionCommandRequest,
  SessionCommandResponse,
  SessionSnapshot,
  SessionTimer,
} from "@yes-chief/shared"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Agent } from "./agent"
import { loadAgentEnv } from "./env"
import { startTimerReminderLoop } from "./orchestration/timer-reminders"

loadAgentEnv({ strict: false })

initializeLogger({ pretty: false, level: "warn" })

const buildSessionSnapshotFixture = (): SessionSnapshot => ({
  sessionId: "session-voice-test",
  recipeId: "recipe-omelette",
  recipeTitle: "Simple Omelette",
  status: "active",
  currentStepIndex: 1,
  currentStep: {
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
  totalSteps: 3,
  recipeContext: {
    id: "recipe-omelette",
    slug: "simple-omelette",
    title: "Simple Omelette",
    stepCount: 3,
    equipment: ["10-inch nonstick pan"],
    ingredients: [
      {
        id: "egg",
        amount: "3",
        name: "large eggs",
        preparation: "lightly beaten",
      },
      {
        id: "butter",
        amount: "1 tbsp",
        name: "unsalted butter",
      },
    ],
    substitutions: [
      {
        ingredientId: "butter",
        substituteIngredientId: "olive-oil",
        substituteName: "olive oil",
        reason: "Works when butter is unavailable.",
      },
    ],
    steps: [
      {
        id: "step-1",
        title: "Beat the eggs",
        instruction: "Whisk until blended.",
        focus: "Make the mixture even.",
        tips: ["Do not over-whisk."],
        heatLevel: "off",
        donenessNotes: "Still pourable.",
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
        instruction: "Fold and plate the omelette.",
        focus: "Keep it tender.",
        tips: ["Serve immediately."],
        heatLevel: "off",
        donenessNotes: "Pale and tender.",
        ingredientIds: ["egg"],
        timerHintSec: 0,
      },
    ],
  },
  activeTimers: [
    {
      timerId: "timer-running-1",
      label: "Low heat cook",
      stepIndex: 1,
      durationSec: 90,
      startedAt: "2026-04-01T09:00:00.000Z",
      targetAt: "2026-04-01T09:01:30.000Z",
      status: "running",
      remainingSec: 45,
    },
  ],
  lastCommandResult: null,
  summary: null,
  createdAt: "2026-04-01T08:59:00.000Z",
  updatedAt: "2026-04-01T09:00:45.000Z",
})

type MockApiClient = {
  getSession(sessionId: string): Promise<GetSessionResult>
  postCommand(
    sessionId: string,
    request: SessionCommandRequest
  ): Promise<SessionCommandResponse>
  getTimers(sessionId: string): Promise<GetSessionTimersResult>
}

const cloneSnapshot = (snapshot: SessionSnapshot) => structuredClone(snapshot)

const syncSessionTimers = (
  session: SessionSnapshot,
  timers: SessionTimer[]
): SessionSnapshot => ({
  ...session,
  activeTimers: timers.filter((timer) => timer.status === "running"),
  updatedAt: new Date().toISOString(),
})

const createMockApiClient = () => {
  const state = {
    session: buildSessionSnapshotFixture(),
    timers: buildSessionSnapshotFixture().activeTimers.map((timer) => ({
      ...timer,
    })),
  }

  const calls: Array<{
    method: "getSession" | "postCommand" | "getTimers"
    payload: unknown
  }> = []

  const updateSession = (session: SessionSnapshot) => {
    state.session = syncSessionTimers(session, state.timers)
  }

  const apiClient: MockApiClient = {
    async getSession(sessionId) {
      calls.push({ method: "getSession", payload: { sessionId } })

      return {
        session: cloneSnapshot(syncSessionTimers(state.session, state.timers)),
      }
    },

    async postCommand(sessionId, request) {
      calls.push({ method: "postCommand", payload: { request, sessionId } })

      switch (request.type) {
        case "advance_step": {
          const nextIndex = Math.min(
            state.session.currentStepIndex + 1,
            state.session.recipeContext.steps.length - 1
          )
          const nextStep = state.session.recipeContext.steps[nextIndex]!
          updateSession({
            ...state.session,
            currentStepIndex: nextIndex,
            currentStep: nextStep,
          })
          break
        }

        case "pause_session":
          updateSession({
            ...state.session,
            status: "paused",
          })
          break

        case "resume_session":
          updateSession({
            ...state.session,
            status: "active",
          })
          break

        case "end_session":
          state.timers = state.timers.map((timer) =>
            timer.status === "running"
              ? {
                  ...timer,
                  remainingSec: 0,
                  status: "cancelled",
                }
              : timer
          )
          updateSession({
            ...state.session,
            status: "completed",
          })
          break

        case "create_timer": {
          const timer: SessionTimer = {
            timerId: `timer-created-${state.timers.length + 1}`,
            label: request.label ?? "Kitchen timer",
            stepIndex: request.stepIndex ?? state.session.currentStepIndex,
            durationSec: request.durationSec ?? 60,
            startedAt: "2026-04-01T09:00:45.000Z",
            targetAt: "2026-04-01T09:02:45.000Z",
            status: "running",
            remainingSec: request.durationSec ?? 60,
          }
          state.timers = [...state.timers, timer]
          updateSession(state.session)
          break
        }

        case "cancel_timer":
          state.timers = state.timers.map((timer) =>
            timer.timerId === request.timerId || timer.label === request.label
              ? {
                  ...timer,
                  remainingSec: 0,
                  status: "cancelled",
                }
              : timer
          )
          updateSession(state.session)
          break
      }

      const result = {
        commandType: request.type,
        ok: true,
        message: `Command ${request.type} applied.`,
        sessionId,
        timerId:
          request.type === "create_timer"
            ? (state.timers.at(-1)?.timerId ?? null)
            : (request.timerId ?? null),
      } as const

      state.session = {
        ...state.session,
        lastCommandResult: result,
      }

      return {
        session: cloneSnapshot(syncSessionTimers(state.session, state.timers)),
        result,
      }
    },

    async getTimers(sessionId) {
      calls.push({ method: "getTimers", payload: { sessionId } })

      return {
        sessionId,
        timers: state.timers.map((timer) => ({ ...timer })),
      }
    },
  }

  return {
    apiClient,
    calls,
    snapshotStore: {
      current: cloneSnapshot(state.session),
    },
    state,
  }
}

const getMessageText = (event: {
  event: () => { item: { content: string | string[] } }
}) => {
  const content = event.event().item.content

  return Array.isArray(content) ? content.join(" ") : content
}

type AssistantMessageAssert = {
  event: () => { item: { content: string | string[] } }
  judge: (
    llm: inference.LLM,
    options: {
      intent: string
    }
  ) => Promise<void>
}

const getAssistantMessage = (result: {
  events: Array<{ type: string; item: { role?: string } }>
  expect: {
    at: (index: number) => {
      isMessage: (options: { role: "assistant" }) => AssistantMessageAssert
    }
  }
}) => {
  const messageIndex = result.events.findIndex(
    (event) => event.type === "message" && event.item.role === "assistant"
  )

  if (messageIndex < 0) {
    throw new Error("Expected an assistant message event")
  }

  return result.expect.at(messageIndex).isMessage({ role: "assistant" })
}

const hasMutationToolCall = (result: {
  events: Array<{ type: string; item: any }>
}) =>
  result.events.some(
    (event) =>
      event.type === "function_call" &&
      [
        "advanceStep",
        "pauseSession",
        "resumeSession",
        "endSession",
        "createTimer",
        "cancelTimer",
      ].includes(event.item.name)
  )

describe("voice guidance eval", () => {
  let llm: inference.LLM
  let session: voice.AgentSession
  let api: ReturnType<typeof createMockApiClient>

  beforeEach(async () => {
    api = createMockApiClient()
    llm = new inference.LLM({ model: "openai/gpt-5.1" })
    session = new voice.AgentSession({ llm })
    await session.start({
      agent: new Agent({
        apiClient: api.apiClient,
        sessionId: api.snapshotStore.current.sessionId,
        snapshotStore: api.snapshotStore,
      }),
    })
  })

  afterEach(async () => {
    await session?.close()
    await llm?.aclose()
  })

  it(
    "GUID-01: 基于当前步骤和 recipe context 给出 1 到 3 句主动 tutor 开场指导",
    { timeout: 30000 },
    async () => {
      const result = await session
        .run({
          userInput: "请直接开始这一段指导。",
        })
        .wait()

      const message = getAssistantMessage(result)
      const messageText = getMessageText(message)

      expect(messageText).not.toMatch(/hello|hi|很高兴见到你|我能帮你什么/i)

      await message.judge(llm, {
        intent: `\
Acts like a proactive cooking tutor instead of a generic assistant.

The reply must:
- start guiding the current cooking step immediately
- stay within 1 to 3 short, actionable sentences
- mention at least one concrete action tied to the current step or ingredient context

The reply must not:
- open with a generic greeting
- ask broad questions about what the user wants to do
- drift into general chat unrelated to the current step
`,
      })
    }
  )

  it.each(["差不多了吧", "那个先停一下"])(
    "GUID-04: 面对模糊高风险表达 %s 时先澄清而不是擅自推进或暂停",
    { timeout: 30000 },
    async (utterance) => {
      const result = await session
        .run({
          userInput: utterance,
        })
        .wait()

      const message = getAssistantMessage(result)
      const messageText = getMessageText(message)

      expect(messageText).toMatch(/[？?]/)

      await message.judge(llm, {
        intent: `\
Clarifies the user's ambiguous, high-risk intent before taking any action.

The reply must:
- ask a direct clarification question about what the user means

The reply must not:
- say the step is done
- say it has already paused, stopped, ended, or advanced anything
- issue a timer action before the user clarifies
`,
      })
    }
  )

  it(
    "CTRL-01: 用户说下一步时选择 advanceStep 工具并确认新 step",
    { timeout: 30000 },
    async () => {
      const result = await session.run({ userInput: "下一步" }).wait()

      result.expect
        .nextEvent()
        .isFunctionCall({ name: "advanceStep", args: {} })
      result.expect.nextEvent().isFunctionCallOutput()

      const message = await result.expect
        .nextEvent()
        .isMessage({ role: "assistant" })

      await message.judge(llm, {
        intent: `\
Clearly moves the user into the next cooking step and gives the new action.

The reply must:
- make it clear that the user should now do the newly selected step
- mention the new step content or action
- stay brief and action-oriented
`,
      })

      result.expect.noMoreEvents()
    }
  )

  it(
    "CTRL-02: 用户说重复一下时只重述当前步骤，不走 mutation",
    { timeout: 30000 },
    async () => {
      const result = await session.run({ userInput: "重复一下当前步骤" }).wait()

      const message = getAssistantMessage(result)
      const messageText = getMessageText(message)

      expect(hasMutationToolCall(result)).toBe(false)
      expect(messageText).toMatch(/低火|小火/)
      expect(messageText).toMatch(/当前步骤|这一步|先/)
    }
  )

  it(
    "GUID-02: 指导中被打断提问时先回答问题再带回流程",
    { timeout: 30000 },
    async () => {
      const result = await session
        .run({
          userInput: "等一下，这一步应该是小火吗？回答完继续带我做这一步。",
        })
        .wait()

      const message = getAssistantMessage(result)
      const messageText = getMessageText(message)

      expect(messageText).toMatch(/小火|低火/)

      await message.judge(llm, {
        intent: `\
Answers the interruption question about heat level and then returns the user to the current cooking flow.

The reply must:
- answer that the current step uses low heat
- tell the user what to do next in the current step or bring them back to the same step
- stay concise and practical
`,
      })
    }
  )

  it(
    "GUID-03: ingredient / heat / substitution / timer 问题都引用 snapshot 字段",
    { timeout: 30000 },
    async () => {
      const result = await session
        .run({
          userInput:
            "这一步用了哪些食材，要什么火候，黄油能换什么，现在 timer 还有什么？",
        })
        .wait()

      const message = getAssistantMessage(result)
      const messageText = getMessageText(message)

      expect(messageText).toMatch(/鸡蛋|黄油|橄榄油|小火|低火|计时器/)

      await message.judge(llm, {
        intent: `\
Answers from grounded snapshot data.

The reply must:
- mention eggs and butter as current-step ingredients
- mention low heat
- mention olive oil as the butter substitution
- mention the running timer label or remaining timer information
`,
      })
    }
  )

  it(
    "TIME-01: 设 timer 时选择 createTimer 工具",
    { timeout: 30000 },
    async () => {
      const result = await session
        .run({ userInput: "帮我设一个 120 秒的 pan check timer" })
        .wait()

      const functionCall = result.expect
        .nextEvent()
        .isFunctionCall({ name: "createTimer" })
      const functionArgs = JSON.parse(functionCall.event().item.args) as {
        durationSec?: number
        label?: string
      }

      expect(functionArgs.durationSec).toBe(120)
      expect(functionArgs.label?.toLowerCase()).toBe("pan check")
      result.expect.nextEvent().isFunctionCallOutput()

      const message = getAssistantMessage(result)

      await message.judge(llm, {
        intent: "Confirms that a 120 second timer named pan check was created.",
      })
    }
  )

  it(
    "TIME-02: 查 timer 时选择 queryTimers 工具",
    { timeout: 30000 },
    async () => {
      const result = await session
        .run({ userInput: "现在 timer 怎么样了？" })
        .wait()

      result.expect.nextEvent().isFunctionCall({ name: "queryTimers" })
      result.expect.nextEvent().isFunctionCallOutput()

      const message = getAssistantMessage(result)

      await message.judge(llm, {
        intent:
          "Reports the currently running timer with its label or remaining time first, and may optionally add one short cooking guidance sentence.",
      })
    }
  )

  it(
    "TIME-03: 取消 timer 时选择 cancelTimer 工具",
    { timeout: 30000 },
    async () => {
      const result = await session
        .run({ userInput: "把 low heat cook 那个 timer 取消掉" })
        .wait()

      result.expect.nextEvent().isFunctionCall({
        name: "cancelTimer",
        args: { label: "Low heat cook" },
      })
      result.expect.nextEvent().isFunctionCallOutput()

      const message = getAssistantMessage(result)

      await message.judge(llm, {
        intent:
          "Confirms that the named timer was cancelled and returns the user to cooking guidance.",
      })
    }
  )
})

describe("timer reminder orchestration", () => {
  it("TIME-04: expired timer 会触发短促提醒并回到当前步骤", async () => {
    vi.useFakeTimers()

    const generateReply = vi.fn()
    const session = {
      generateReply,
    }

    const apiClient: MockApiClient = {
      async getSession() {
        return {
          session: buildSessionSnapshotFixture(),
        }
      },
      async postCommand() {
        throw new Error("postCommand should not be called")
      },
      async getTimers() {
        return {
          sessionId: "session-voice-test",
          timers: [
            {
              timerId: "timer-expired",
              label: "expired pasta",
              stepIndex: 1,
              durationSec: 60,
              startedAt: "2026-04-01T09:00:00.000Z",
              targetAt: "2026-04-01T09:01:00.000Z",
              status: "expired",
              remainingSec: 0,
            },
          ],
        }
      },
    }

    const stop = startTimerReminderLoop({
      apiClient,
      session,
      sessionId: "session-voice-test",
      snapshotStore: {
        current: buildSessionSnapshotFixture(),
      },
    })

    await vi.advanceTimersByTimeAsync(1000)

    expect(generateReply).toHaveBeenCalledTimes(1)
    expect(generateReply.mock.calls[0]?.[0]?.instructions).toContain("expired")
    expect(generateReply.mock.calls[0]?.[0]?.instructions).toContain(
      "Cook gently"
    )

    stop()
    vi.useRealTimers()
  })

  it("TIME-05: completed session 会停止 reminder loop，不再继续播报陈旧提醒", async () => {
    vi.useFakeTimers()

    const generateReply = vi.fn()
    const session = {
      generateReply,
    }
    const getTimers = vi.fn().mockResolvedValue({
      sessionId: "session-voice-test",
      timers: [],
    })

    const stop = startTimerReminderLoop({
      apiClient: {
        async getSession() {
          return {
            session: {
              ...buildSessionSnapshotFixture(),
              status: "completed",
            },
          }
        },
        async getTimers() {
          return getTimers()
        },
        async postCommand() {
          throw new Error("postCommand should not be called")
        },
      },
      session,
      sessionId: "session-voice-test",
      snapshotStore: {
        current: buildSessionSnapshotFixture(),
      },
    })

    await vi.advanceTimersByTimeAsync(2000)

    expect(generateReply).not.toHaveBeenCalled()
    expect(getTimers).not.toHaveBeenCalled()

    stop()
    vi.useRealTimers()
  })
})
