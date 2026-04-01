import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from "@livekit/agents"
import * as livekit from "@livekit/agents-plugin-livekit"
import * as silero from "@livekit/agents-plugin-silero"
import { BackgroundVoiceCancellation } from "@livekit/noise-cancellation-node"
import { fileURLToPath } from "node:url"
import { SessionApiClient } from "./api/session-client"
import { Agent } from "./agent"
import { loadAgentEnv } from "./env"
import { startTimerReminderLoop } from "./orchestration/timer-reminders"

loadAgentEnv({ strict: false })

const parseSessionIdFromJobMetadata = (metadata?: string) => {
  if (!metadata) {
    return null
  }

  try {
    const parsed = JSON.parse(metadata) as { sessionId?: unknown }

    return typeof parsed.sessionId === "string" ? parsed.sessionId : null
  } catch {
    return null
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load()
  },
  entry: async (ctx: JobContext) => {
    const apiClient = new SessionApiClient()
    const sessionId =
      parseSessionIdFromJobMetadata(ctx.job.metadata) ?? ctx.room.name ?? null

    if (!sessionId) {
      throw new Error(
        "Session id is required from ctx.job.metadata or ctx.room.name"
      )
    }

    const initialSession = await apiClient.getSession(sessionId)
    const snapshotStore = {
      current: initialSession.session,
    }

    const session = new voice.AgentSession({
      stt: new inference.STT({
        model: "deepgram/nova-3",
        language: "multi",
      }),
      llm: new inference.LLM({
        model: "openai/gpt-4.1-mini",
      }),
      tts: new inference.TTS({
        model: "cartesia/sonic-3",
        voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      }),
      turnHandling: {
        turnDetection: new livekit.turnDetector.MultilingualModel(),
        interruption: {
          mode: "adaptive",
          minDuration: 500,
          minWords: 1,
          falseInterruptionTimeout: 2000,
          resumeFalseInterruption: true,
        },
      },
      vad: ctx.proc.userData.vad! as silero.VAD,
      voiceOptions: {
        preemptiveGeneration: true,
      },
    })
    await session.start({
      agent: new Agent({
        apiClient,
        sessionId,
        snapshotStore,
      }),
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    })

    await ctx.connect()

    startTimerReminderLoop({
      apiClient,
      session,
      sessionId,
      snapshotStore,
    })

    session.generateReply({
      instructions: `Start guiding the current cooking step immediately in a short, positive tutor tone. Do not greet generically. Current step: ${snapshotStore.current.currentStep.title}. Action: ${snapshotStore.current.currentStep.instruction}.`,
    })
  },
})

if (import.meta.main) {
  // Run the agent server only when this file is the entrypoint.
  cli.runApp(
    new ServerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: "agent",
    })
  )
}
