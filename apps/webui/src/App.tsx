import type {
  SessionSnapshot,
  SessionSummary as SessionSummaryData,
} from "@yes-chief/shared"
import { LoaderCircle, Mic } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ConnectionStatus } from "@/components/companion/connection-status"
import { RecipeSelection } from "@/components/companion/recipe-selection"
import { SessionDashboard } from "@/components/companion/session-dashboard"
import { SessionRecoveryList } from "@/components/companion/session-recovery-list"
import { SessionSummary } from "@/components/companion/session-summary"
import { TimerList } from "@/components/companion/timer-list"
import { Button } from "@/components/ui/button"
import { useCookingSession } from "@/hooks/use-cooking-session"
import {
  initialVoiceStatus,
  useLiveKitRoom,
  type ReconnectState,
  type VoiceStatus,
} from "@/hooks/use-livekit-room"
import {
  connectSession,
  deleteSessionRoom,
  endSession,
  type CompanionTimer,
} from "@/lib/api"

const buildApiRecoveryMessage = (
  message: string | undefined,
  fallback: string
) => {
  const detail = message?.trim() || fallback

  return `Please make sure API and LiveKit are running and try again. ${detail}`
}

const getLifecycleStatus = (
  snapshot: SessionSnapshot | null,
  reconnectAttempt: number,
  reconnectState: ReconnectState,
  voiceStatus: VoiceStatus,
  isJoinedCurrentSession: boolean
) => {
  if (snapshot?.status === "completed") {
    return "Completed"
  }

  if (reconnectState === "reconnecting") {
    return reconnectAttempt > 0
      ? `Reconnecting (attempt ${reconnectAttempt})`
      : "Reconnecting"
  }

  if (reconnectState === "disconnected") {
    return "Disconnected"
  }

  if (reconnectState === "reconnected") {
    return "Reconnected"
  }

  if (snapshot?.status === "paused") {
    return "Paused"
  }

  if (voiceStatus.connecting) {
    return "Connecting"
  }

  if (isJoinedCurrentSession && voiceStatus.agentReady) {
    return "Voice connected"
  }

  if (isJoinedCurrentSession) {
    return "Waiting for tutor"
  }

  return "Ready to start"
}

const getStepProgressLabel = (snapshot: SessionSnapshot | null) => {
  if (!snapshot) {
    return "Progress will be shown here once you start cooking."
  }

  return `Step ${snapshot.currentStepIndex + 1} of ${snapshot.totalSteps}`
}

type CompanionStage = "discovery" | "active" | "completed"

const getCompanionStage = (
  snapshot: SessionSnapshot | null,
  summary: SessionSummaryData | null
): CompanionStage => {
  if (summary || snapshot?.status === "completed") {
    return "completed"
  }

  if (snapshot) {
    return "active"
  }

  return "discovery"
}

const buildCompletionSummary = (
  snapshot: SessionSnapshot | null
): SessionSummaryData | null => {
  if (!snapshot) {
    return null
  }

  if (snapshot.summary) {
    return snapshot.summary
  }

  return {
    cancelledTimerCount: snapshot.activeTimers.filter(
      (timer) => timer.status === "cancelled"
    ).length,
    completedAt: snapshot.updatedAt,
    completionMessage:
      "This cooking session has ended. You can start another dish later.",
    expiredTimerCount: snapshot.activeTimers.filter(
      (timer) => timer.status === "expired"
    ).length,
    finalStepIndex: snapshot.currentStepIndex,
    recipeTitle: snapshot.recipeTitle,
    totalSteps: snapshot.totalSteps,
  }
}

export function App() {
  const [isReturningToDiscovery, setIsReturningToDiscovery] = useState(false)
  const [voiceError, setVoiceError] = useState("")
  const [politeAnnouncement, setPoliteAnnouncement] = useState("")
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState("")
  const previousVoiceStatusRef = useRef(initialVoiceStatus)
  const previousTimersRef = useRef<CompanionTimer[]>([])
  const previousPoliteAnnouncementRef = useRef("")
  const previousAssertiveAnnouncementRef = useRef("")
  const reconnectSessionRef = useRef<() => Promise<boolean>>(async () => false)
  const {
    audioHostRef,
    canRetryManually,
    connectResult,
    disconnectRoom,
    joinVoiceSession,
    reconnectAttempt,
    reconnectState,
    voiceActivityLevel,
    voiceActivityState,
    voiceError: roomVoiceError,
    voiceStatus,
  } = useLiveKitRoom({
    onReconnectNeeded: async () => reconnectSessionRef.current(),
  })
  const {
    createError,
    createSessionForSelectedRecipe,
    isCreatingSession,
    isLoadingRecoverySessions,
    isLoadingRecipes,
    isLoadingSession,
    latestSnapshot,
    loadSession,
    recipes,
    recoveryError,
    recoverySessions,
    recipesError,
    refreshCompanionState,
    resetSessionState,
    selectedRecipeId,
    sessionResult,
    setSelectedRecipeId,
    syncError,
    timers,
  } = useCookingSession({
    shouldSync: voiceStatus.connected,
  })
  const isJoiningVoice = voiceStatus.connecting
  const displayedSnapshot = latestSnapshot ?? sessionResult?.session ?? null
  const currentSessionId = displayedSnapshot?.sessionId ?? null
  const existingSummary = displayedSnapshot?.summary ?? null

  const handleCreateSession = async () => {
    setVoiceError("")

    try {
      await disconnectRoom()
      const result = await createSessionForSelectedRecipe()

      if (result) {
        setPoliteAnnouncement("Session created")
      }
    } catch {
      return
    }
  }

  const handleJoinVoice = async () => {
    if (!currentSessionId) {
      return
    }

    setVoiceError("")
    setPoliteAnnouncement("Connecting to voice guidance")

    try {
      const nextConnectResult = await connectSession(currentSessionId)
      const joined = await joinVoiceSession(nextConnectResult)

      if (joined) {
        const refreshedSnapshot = await refreshCompanionState()

        if (refreshedSnapshot?.status === "completed") {
          await disconnectRoom()
          setPoliteAnnouncement("Session ended, switched to summary.")
        }
      }
    } catch (error) {
      setVoiceError(
        buildApiRecoveryMessage(
          error instanceof Error ? error.message : undefined,
          "Unable to connect to voice guidance at the moment."
        )
      )
    }
  }

  const handleLoadSession = async (sessionId: string) => {
    setVoiceError("")

    try {
      await disconnectRoom()
      const result = await loadSession(sessionId)

      if (result) {
        setPoliteAnnouncement(
          result.session.status === "completed"
            ? "Restored completed session"
            : "Restored previous session"
        )
      }
    } catch {
      return
    }
  }

  useEffect(() => {
    reconnectSessionRef.current = async () => {
      if (!currentSessionId) {
        return false
      }

      try {
        const nextConnectResult = await connectSession(currentSessionId)
        const joined = await joinVoiceSession(nextConnectResult)

        if (!joined) {
          return false
        }

        const refreshedSnapshot = await refreshCompanionState()

        if (refreshedSnapshot?.status === "completed") {
          await disconnectRoom()
        }

        return true
      } catch {
        return false
      }
    }
  }, [
    currentSessionId,
    disconnectRoom,
    joinVoiceSession,
    refreshCompanionState,
  ])

  const handleReturnToDiscovery = async (
    mode: Extract<CompanionStage, "active" | "completed">
  ) => {
    if (!displayedSnapshot) {
      return
    }

    const sessionId = displayedSnapshot.sessionId

    setVoiceError("")
    setIsReturningToDiscovery(true)

    try {
      if (mode === "active") {
        await endSession(sessionId)
      }

      await disconnectRoom()
      await deleteSessionRoom(sessionId)
      resetSessionState()
      setPoliteAnnouncement("Returned to Discovery, please select a recipe.")
    } catch (error) {
      setVoiceError(
        buildApiRecoveryMessage(
          error instanceof Error ? error.message : undefined,
          mode === "active"
            ? "Unable to end session and return at the moment."
            : "Unable to return at the moment."
        )
      )
    } finally {
      setIsReturningToDiscovery(false)
    }
  }

  const isJoinedCurrentSession = Boolean(
    connectResult &&
    currentSessionId &&
    voiceStatus.connected &&
    connectResult.sessionId === currentSessionId
  )
  const lifecycleStatus = getLifecycleStatus(
    displayedSnapshot,
    reconnectAttempt,
    reconnectState,
    voiceStatus,
    isJoinedCurrentSession
  )
  const microphoneStatus = voiceStatus.micEnabled
    ? "Microphone on"
    : "Microphone off"
  const audioStatus = voiceStatus.audioReady
    ? "Browser audio ready"
    : "Waiting for browser audio"
  const sessionJoinStatus = isJoinedCurrentSession
    ? "Joined current session"
    : "Not joined current session"
  const tutorStatus = voiceStatus.agentReady
    ? "Tutor connected"
    : "Waiting for tutor"
  const voiceActivityLabel =
    voiceActivityState === "speaking"
      ? "Tutor is speaking"
      : voiceActivityState === "idle"
        ? "Tutor is online and waiting"
        : "No remote audio detected"
  const stage = getCompanionStage(displayedSnapshot, existingSummary)
  const canReconnectCurrentSession =
    stage === "active" && Boolean(displayedSnapshot) && canRetryManually
  const visibleTimers = timers.filter((timer) => timer.status === "running")
  const displayedSummary =
    stage === "completed" ? buildCompletionSummary(displayedSnapshot) : null

  useEffect(() => {
    const previousVoiceStatus = previousVoiceStatusRef.current

    if (!previousVoiceStatus.audioReady && voiceStatus.audioReady) {
      setPoliteAnnouncement("Browser audio ready")
    } else if (
      !previousVoiceStatus.connected &&
      voiceStatus.connected &&
      !voiceStatus.audioReady
    ) {
      setPoliteAnnouncement("Waiting for browser audio")
    }

    if (!previousVoiceStatus.agentReady && voiceStatus.agentReady) {
      setPoliteAnnouncement("Tutor connected")
    }

    if (!previousVoiceStatus.connected && isJoinedCurrentSession) {
      setPoliteAnnouncement("Voice connected")
    }

    previousVoiceStatusRef.current = voiceStatus
  }, [isJoinedCurrentSession, voiceStatus])

  useEffect(() => {
    const previousTimers = previousTimersRef.current

    for (const timer of timers) {
      const previousTimer = previousTimers.find(
        (currentTimer) => currentTimer.timerId === timer.timerId
      )

      if (!previousTimer) {
        setPoliteAnnouncement("Timer created")
        previousTimersRef.current = timers
        return
      }

      if (previousTimer.status !== timer.status) {
        if (timer.status === "cancelled") {
          setPoliteAnnouncement("Timer cancelled")
          previousTimersRef.current = timers
          return
        }

        if (timer.status === "expired") {
          setPoliteAnnouncement("Timer expired")
          previousTimersRef.current = timers
          return
        }
      }
    }

    previousTimersRef.current = timers
  }, [timers])

  useEffect(() => {
    if (recipesError) {
      setAssertiveAnnouncement(recipesError)
    }
  }, [recipesError])

  useEffect(() => {
    if (createError) {
      setAssertiveAnnouncement(createError)
    }
  }, [createError])

  useEffect(() => {
    if (voiceError) {
      setAssertiveAnnouncement(voiceError)
    }
  }, [voiceError])

  useEffect(() => {
    if (syncError) {
      setVoiceError(syncError)
    }
  }, [syncError])

  useEffect(() => {
    if (roomVoiceError) {
      setVoiceError(roomVoiceError)
    }
  }, [roomVoiceError])

  useEffect(() => {
    if (reconnectState !== "reconnected") {
      return
    }

    let cancelled = false

    const reconcileRecoveredSession = async () => {
      const refreshedSnapshot = await refreshCompanionState()

      if (cancelled) {
        return
      }

      if (refreshedSnapshot?.status === "completed") {
        await disconnectRoom()
      }
    }

    void reconcileRecoveredSession()

    return () => {
      cancelled = true
    }
  }, [disconnectRoom, reconnectState, refreshCompanionState])

  useEffect(() => {
    if (
      politeAnnouncement &&
      politeAnnouncement !== previousPoliteAnnouncementRef.current
    ) {
      toast.success(politeAnnouncement)
    }

    previousPoliteAnnouncementRef.current = politeAnnouncement
  }, [politeAnnouncement])

  useEffect(() => {
    if (
      assertiveAnnouncement &&
      assertiveAnnouncement !== previousAssertiveAnnouncementRef.current
    ) {
      toast.error(assertiveAnnouncement)
    }

    previousAssertiveAnnouncementRef.current = assertiveAnnouncement
  }, [assertiveAnnouncement])

  const connectionStatusPanel = (
    <ConnectionStatus
      audioStatus={audioStatus}
      lifecycleStatus={lifecycleStatus}
      microphoneStatus={microphoneStatus}
      primaryAction={
        canReconnectCurrentSession ? (
          <Button
            className="min-h-12 w-full text-base sm:w-auto"
            disabled={isJoiningVoice}
            onClick={() => void handleJoinVoice()}
            variant="success"
          >
            {isJoiningVoice ? (
              <LoaderCircle className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Mic className="h-5 w-5 mr-2" />
            )}
            {isJoiningVoice ? "Reconnecting" : "Reconnect"}
          </Button>
        ) : !isJoinedCurrentSession ? (
          <Button
            className="min-h-12 w-full text-base sm:w-auto"
            disabled={!displayedSnapshot || isJoiningVoice}
            onClick={() => void handleJoinVoice()}
            variant="success"
          >
            {isJoiningVoice ? (
              <LoaderCircle className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Mic className="h-5 w-5 mr-2" />
            )}
            {isJoiningVoice ? "Connecting" : "Connect voice guidance"}
          </Button>
        ) : null
      }
      secondaryAction={
        stage === "active" ? (
          <Button
            className="min-h-12 w-full text-base sm:w-auto"
            disabled={isReturningToDiscovery}
            onClick={() => void handleReturnToDiscovery("active")}
            variant="destructive"
          >
            {isReturningToDiscovery ? "Returning" : "End and return"}
          </Button>
        ) : null
      }
      sessionJoinStatus={sessionJoinStatus}
      tutorStatus={tutorStatus}
      voiceActivityLabel={voiceActivityLabel}
      voiceActivityState={voiceActivityState}
    />
  )

  const timerListPanel = <TimerList timers={visibleTimers} />

  const activeSummary = displayedSnapshot?.lastCommandResult?.message

  const stageContent =
    stage === "completed" && displayedSummary ? (
      <SessionSummary
        action={
          <Button
            className="min-h-12 w-full text-base sm:w-auto"
            disabled={isReturningToDiscovery}
            onClick={() => void handleReturnToDiscovery("completed")}
            variant="destructive"
          >
            {isReturningToDiscovery ? "Returning" : "Return"}
          </Button>
        }
        summary={displayedSummary}
      />
    ) : stage === "active" && displayedSnapshot ? (
      <SessionDashboard
        recipeTitle={displayedSnapshot.recipeTitle}
        statusPanel={connectionStatusPanel}
        stepProgressLabel={getStepProgressLabel(displayedSnapshot)}
        summary={activeSummary}
        timerPanel={timerListPanel}
        visibleSnapshot={displayedSnapshot}
        voiceActivityLevel={voiceActivityLevel}
        voiceActivityState={voiceActivityState}
      />
    ) : (
      <div className="space-y-10">
        <RecipeSelection
          createError={createError}
          isCreatingSession={isCreatingSession || isLoadingSession}
          isLoadingRecipes={isLoadingRecipes}
          onCreateSession={() => void handleCreateSession()}
          onSelectRecipe={setSelectedRecipeId}
          recipes={recipes}
          recipesError={recipesError}
          selectedRecipeId={selectedRecipeId}
        />

        <SessionRecoveryList
          error={recoveryError}
          isLoading={isLoadingRecoverySessions}
          isLoadingSession={isLoadingSession}
          onLoadSession={(sessionId) => void handleLoadSession(sessionId)}
          sessions={recoverySessions}
        />
      </div>
    )

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,oklch(0.99_0.02_95),transparent_42%),linear-gradient(180deg,oklch(0.99_0.01_95),oklch(0.96_0.01_95))] px-4 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section>{stageContent}</section>

        <div className="sr-only" ref={audioHostRef} />

        <div aria-atomic="true" aria-live="polite" className="sr-only">
          {politeAnnouncement}
        </div>
        <div aria-atomic="true" aria-live="assertive" className="sr-only">
          {assertiveAnnouncement}
        </div>
      </div>
    </main>
  )
}

export default App
