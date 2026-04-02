import type { SessionSnapshot } from "@yes-chief/shared"
import type { SessionApiClientLike } from "../api/session-client"

type SnapshotStore = {
  current: SessionSnapshot
}

type ReplySession = {
  generateReply: (options: { instructions: string }) => unknown
}

type TimerReminderLoopOptions = {
  apiClient: SessionApiClientLike
  intervalMs?: number
  session: ReplySession
  sessionId: string
  snapshotStore: SnapshotStore
}

export const startTimerReminderLoop = ({
  apiClient,
  intervalMs = 1000,
  session,
  sessionId,
  snapshotStore,
}: TimerReminderLoopOptions) => {
  const announcedTimerIds = new Set<string>()
  let stopped = false

  const intervalHandle = setInterval(async () => {
    try {
      const timersResult = await apiClient.getTimers(sessionId)
      snapshotStore.current = {
        ...snapshotStore.current,
        activeTimers: timersResult.timers.filter(
          (timer) => timer.status === "running"
        ),
      }

      for (const timer of timersResult.timers) {
        if (
          timer.status === "expired" &&
          !announcedTimerIds.has(timer.timerId)
        ) {
          announcedTimerIds.add(timer.timerId)

          const latestSession = await apiClient.getSession(sessionId)
          snapshotStore.current = latestSession.session

          await Promise.resolve(
            session.generateReply({
              instructions: `The timer "${timer.label}" has expired. Give a short reminder, then bring the user back to the current step "${latestSession.session.currentStep.title}" with the action "${latestSession.session.currentStep.instruction}".`,
            })
          )
        }
      }
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Timer reminder loop failed"
      )
    }
  }, intervalMs)

  return () => {
    if (stopped) {
      return
    }

    stopped = true
    clearInterval(intervalHandle)
  }
}
