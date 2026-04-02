import type {
  SessionSnapshot,
  SessionSummary as SessionSummaryData,
} from "@yes-chief/shared"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ConnectionStatus } from "@/components/companion/connection-status"
import { RecipeSelection } from "@/components/companion/recipe-selection"
import { SessionDashboard } from "@/components/companion/session-dashboard"
import { SessionSummary } from "@/components/companion/session-summary"
import { TimerList } from "@/components/companion/timer-list"
import { Button } from "@/components/ui/button"
import { useCookingSession } from "@/hooks/use-cooking-session"
import {
  initialVoiceStatus,
  useLiveKitRoom,
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

  return `请确认 API 与 LiveKit 已启动后重试。 ${detail}`
}

const getLifecycleStatus = (
  snapshot: SessionSnapshot | null,
  voiceStatus: VoiceStatus,
  isJoinedCurrentSession: boolean
) => {
  if (snapshot?.status === "completed") {
    return "已结束"
  }

  if (snapshot?.status === "paused") {
    return "已暂停"
  }

  if (voiceStatus.connecting) {
    return "正在连接"
  }

  if (isJoinedCurrentSession && voiceStatus.agentReady) {
    return "语音已接通"
  }

  if (isJoinedCurrentSession) {
    return "等待 tutor 接入"
  }

  return "准备开始"
}

const getStepProgressLabel = (snapshot: SessionSnapshot | null) => {
  if (!snapshot) {
    return "开始这道菜后，这里会显示当前进度。"
  }

  return `第 ${snapshot.currentStepIndex + 1} 步 / 共 ${snapshot.totalSteps} 步`
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
    completionMessage: "本次做菜会话已经结束，你可以稍后再开始下一道菜。",
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
  const {
    audioHostRef,
    connectResult,
    disconnectRoom,
    joinVoiceSession,
    voiceActivityLevel,
    voiceActivityState,
    voiceError: roomVoiceError,
    voiceStatus,
  } = useLiveKitRoom()
  const {
    createError,
    createSessionForSelectedRecipe,
    isCreatingSession,
    isLoadingRecipes,
    latestSnapshot,
    recipes,
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

  const handleCreateSession = async () => {
    setVoiceError("")

    try {
      await disconnectRoom()
      const result = await createSessionForSelectedRecipe()

      if (result) {
        setPoliteAnnouncement("session 已创建")
      }
    } catch {
      return
    }
  }

  const handleJoinVoice = async () => {
    if (!sessionResult) {
      return
    }

    setVoiceError("")
    setPoliteAnnouncement("正在连接语音指导")

    try {
      const nextConnectResult = await connectSession(
        sessionResult.session.sessionId
      )
      const joined = await joinVoiceSession(nextConnectResult)

      if (joined) {
        await refreshCompanionState()
      }
    } catch (error) {
      setVoiceError(
        buildApiRecoveryMessage(
          error instanceof Error ? error.message : undefined,
          "暂时无法接通语音指导。"
        )
      )
    }
  }

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
      setPoliteAnnouncement("已返回 Discovery，请重新选择菜谱。")
    } catch (error) {
      setVoiceError(
        buildApiRecoveryMessage(
          error instanceof Error ? error.message : undefined,
          mode === "active"
            ? "暂时无法结束当前会话并返回重选。"
            : "暂时无法返回重选。"
        )
      )
    } finally {
      setIsReturningToDiscovery(false)
    }
  }

  const displayedSnapshot = latestSnapshot ?? sessionResult?.session ?? null
  const existingSummary = displayedSnapshot?.summary ?? null
  const isJoinedCurrentSession = Boolean(
    connectResult &&
    displayedSnapshot &&
    voiceStatus.connected &&
    connectResult.sessionId === displayedSnapshot.sessionId
  )
  const lifecycleStatus = getLifecycleStatus(
    displayedSnapshot,
    voiceStatus,
    isJoinedCurrentSession
  )
  const microphoneStatus = voiceStatus.micEnabled
    ? "麦克风已开启"
    : "麦克风未开启"
  const audioStatus = voiceStatus.audioReady
    ? "浏览器音频已就绪"
    : "等待浏览器播放音频"
  const sessionJoinStatus = isJoinedCurrentSession
    ? "已加入当前会话"
    : "尚未加入当前会话"
  const tutorStatus = voiceStatus.agentReady
    ? "tutor 已接入"
    : "等待 tutor 接入"
  const voiceActivityLabel =
    voiceActivityState === "speaking"
      ? "tutor 正在说话"
      : voiceActivityState === "idle"
        ? "tutor 在线待机"
        : "暂未检测到远端音频"
  const visibleTimers = timers.filter((timer) => timer.status === "running")
  const stage = getCompanionStage(displayedSnapshot, existingSummary)
  const displayedSummary =
    stage === "completed" ? buildCompletionSummary(displayedSnapshot) : null

  useEffect(() => {
    const previousVoiceStatus = previousVoiceStatusRef.current

    if (!previousVoiceStatus.audioReady && voiceStatus.audioReady) {
      setPoliteAnnouncement("浏览器音频已就绪")
    } else if (
      !previousVoiceStatus.connected &&
      voiceStatus.connected &&
      !voiceStatus.audioReady
    ) {
      setPoliteAnnouncement("等待浏览器播放音频")
    }

    if (!previousVoiceStatus.agentReady && voiceStatus.agentReady) {
      setPoliteAnnouncement("tutor 已接入")
    }

    if (!previousVoiceStatus.connected && isJoinedCurrentSession) {
      setPoliteAnnouncement("语音已接通")
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
        setPoliteAnnouncement("已新建计时器")
        previousTimersRef.current = timers
        return
      }

      if (previousTimer.status !== timer.status) {
        if (timer.status === "cancelled") {
          setPoliteAnnouncement("已取消计时器")
          previousTimersRef.current = timers
          return
        }

        if (timer.status === "expired") {
          setPoliteAnnouncement("timer 已到点")
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
        !isJoinedCurrentSession ? (
          <Button
            className="min-h-12 w-full text-base sm:w-auto"
            disabled={!sessionResult || isJoiningVoice}
            onClick={() => void handleJoinVoice()}
            variant="secondary"
          >
            {isJoiningVoice ? "正在接通" : "接通语音指导"}
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
            {isReturningToDiscovery ? "正在返回重选" : "结束并返回重选"}
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

  const activeSummary =
    displayedSnapshot?.lastCommandResult?.message ??
    displayedSnapshot?.currentStep.focus

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
            {isReturningToDiscovery ? "正在返回重选" : "返回重选"}
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
      <RecipeSelection
        canJoinVoice={Boolean(sessionResult)}
        createError={createError}
        isCreatingSession={isCreatingSession}
        isJoiningVoice={isJoiningVoice}
        isLoadingRecipes={isLoadingRecipes}
        onCreateSession={() => void handleCreateSession()}
        onJoinVoice={() => void handleJoinVoice()}
        onSelectRecipe={setSelectedRecipeId}
        recipes={recipes}
        recipesError={recipesError}
        selectedRecipeId={selectedRecipeId}
      />
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
