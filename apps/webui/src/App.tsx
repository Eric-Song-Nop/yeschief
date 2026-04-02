import type { SessionSnapshot } from "@yes-chief/shared"
import { LoaderCircle, Soup } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useCookingSession } from "@/hooks/use-cooking-session"
import {
  initialVoiceStatus,
  useLiveKitRoom,
  type VoiceStatus,
} from "@/hooks/use-livekit-room"
import { connectSession, type CompanionTimer } from "@/lib/api"

const buildApiRecoveryMessage = (
  message: string | undefined,
  fallback: string
) => {
  const detail = message?.trim() || fallback

  return `请确认 API 与 LiveKit 已启动后重试。 ${detail}`
}

const getTimerStatusLabel = (status: CompanionTimer["status"]) => {
  switch (status) {
    case "cancelled":
      return "已取消"
    case "expired":
      return "已到点"
    case "running":
      return "进行中"
  }
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

export function App() {
  const [voiceError, setVoiceError] = useState("")
  const [politeAnnouncement, setPoliteAnnouncement] = useState("")
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState("")
  const previousVoiceStatusRef = useRef(initialVoiceStatus)
  const previousTimersRef = useRef<CompanionTimer[]>([])
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
    selectedRecipeId,
    sessionResult,
    setSelectedRecipeId,
    syncError,
    timers,
  } = useCookingSession({
    shouldSync: voiceStatus.connected,
  })
  const isJoiningVoice = voiceStatus.connecting

  const selectedRecipe =
    recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null

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

  const displayedSnapshot = latestSnapshot ?? sessionResult?.session ?? null
  const displayedSummary = displayedSnapshot?.summary ?? null
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

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,oklch(0.99_0.02_95),transparent_42%),linear-gradient(180deg,oklch(0.99_0.01_95),oklch(0.96_0.01_95))] px-4 py-6 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <aside className="order-1 rounded-3xl border border-border/70 bg-card/95 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Soup className="size-3.5" />
              Yes Chief Companion
            </div>

            <div className="space-y-3">
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance md:text-4xl">
                跟着语音 tutor 做菜
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                先开始这道菜，再接通语音指导。页面只负责辅助查看当前进度、连接状态和结束总结。
              </p>
            </div>

            <details className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <summary className="cursor-pointer list-none font-medium text-foreground">
                开发信息
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    API 地址
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-foreground">
                    {import.meta.env.VITE_API_BASE_URL ??
                      "http://localhost:3000"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    当前会话
                  </div>
                  <div className="mt-1 break-all font-mono text-xs text-foreground">
                    {displayedSnapshot?.sessionId ?? "尚未开始"}
                  </div>
                </div>
              </div>
            </details>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                当前选择
              </div>
              {selectedRecipe ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xl font-medium">
                    {selectedRecipe.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    共 {selectedRecipe.stepCount}{" "}
                    步，开始后会从第一步进入语音指导。
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted-foreground">
                  先从下方选择一道菜，再开始本次做菜会话。
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Button
                className="min-h-12 text-base"
                disabled={
                  !selectedRecipeId ||
                  isCreatingSession ||
                  isLoadingRecipes ||
                  isJoiningVoice
                }
                onClick={() => void handleCreateSession()}
              >
                {isCreatingSession ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    正在开始
                  </>
                ) : (
                  "开始这道菜"
                )}
              </Button>

              <Button
                className="min-h-12 text-base"
                disabled={!sessionResult || isJoiningVoice || isCreatingSession}
                onClick={() => void handleJoinVoice()}
                variant="secondary"
              >
                {isJoiningVoice ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    正在接通
                  </>
                ) : (
                  "接通语音指导"
                )}
              </Button>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    连接状态
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">
                    {lifecycleStatus}
                  </div>
                </div>
                <div className="rounded-full border border-primary/30 bg-background/85 px-3 py-1 text-sm font-medium text-primary">
                  {tutorStatus}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm">
                  {microphoneStatus}
                </div>
                <div className="rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm">
                  {audioStatus}
                </div>
                <div className="rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm sm:col-span-2">
                  {sessionJoinStatus}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-background/90 px-3 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>语音活动</span>
                  <span
                    className="text-muted-foreground"
                    data-state={voiceActivityState}
                  >
                    {voiceActivityLabel}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${voiceActivityLevel * 100}%` }}
                  />
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                接通语音指导后，优先跟着 tutor
                往下做；页面只负责辅助查看状态，不替代语音主流程。
              </p>
            </div>

            {createError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {createError}
              </div>
            ) : null}

            {voiceError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {voiceError}
              </div>
            ) : null}

            {displayedSummary && displayedSnapshot?.status === "completed" ? (
              <div className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  本次做菜总结
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      完成菜谱
                    </div>
                    <div className="mt-1 text-lg font-medium">
                      {displayedSummary.recipeTitle}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      结束时间
                    </div>
                    <div className="mt-1 text-sm text-foreground">
                      {displayedSummary.completedAt}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      结束于第几步
                    </div>
                    <div className="mt-1 text-sm text-foreground">
                      第 {displayedSummary.finalStepIndex + 1} 步 / 共{" "}
                      {displayedSummary.totalSteps} 步
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      计时器结果
                    </div>
                    <div className="mt-1 text-sm text-foreground">
                      已到点 {displayedSummary.expiredTimerCount} 个，已取消{" "}
                      {displayedSummary.cancelledTimerCount} 个
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-border/70 bg-muted/35 px-4 py-4 text-sm leading-6 text-foreground">
                  {displayedSummary.completionMessage}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  当前进度
                </div>
                {displayedSnapshot ? (
                  <div className="mt-3 space-y-5">
                    <div>
                      <div className="text-lg font-semibold">
                        {getStepProgressLabel(displayedSnapshot)}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        当前菜谱：{displayedSnapshot.recipeTitle}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        当前步骤
                      </div>
                      <div className="mt-2 text-lg font-medium">
                        {displayedSnapshot.currentStep.title}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        {displayedSnapshot.currentStep.instruction}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        正在计时
                      </div>
                      <div className="mt-3 space-y-2">
                        {visibleTimers.length > 0 ? (
                          visibleTimers.map((timer) => (
                            <div
                              key={timer.timerId}
                              className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium">{timer.label}</div>
                                <div className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                                  {getTimerStatusLabel(timer.status)}
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">
                                剩余时间：{timer.remainingTimeLabel}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-4 text-sm leading-6 text-muted-foreground">
                            当前没有正在计时的项目。需要时直接对 tutor
                            说“帮我设一个 timer”。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-4 text-sm leading-6 text-muted-foreground">
                    开始这道菜后，这里会显示当前进度和正在计时的内容。
                  </div>
                )}
              </div>
            )}

            <div className="sr-only" ref={audioHostRef} />
          </div>
        </aside>

        <section className="order-2 rounded-3xl border border-border/70 bg-card/95 p-5 shadow-sm backdrop-blur sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                选择一道菜
              </div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                先定好菜谱，再接通语音 tutor
              </h2>
            </div>

            {isLoadingRecipes ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                正在加载
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                共 {recipes.length} 道菜
              </div>
            )}
          </div>

          {recipesError ? (
            <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {recipesError}
            </div>
          ) : null}

          <div
            aria-label="选择菜谱"
            className="mt-6 grid gap-3 md:grid-cols-2"
            role="radiogroup"
          >
            {recipes.map((recipe) => {
              const isSelected = recipe.id === selectedRecipeId

              return (
                <button
                  aria-checked={isSelected}
                  aria-label={`选择菜谱 ${recipe.title}`}
                  key={recipe.id}
                  className={[
                    "rounded-3xl border px-4 py-4 text-left transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/70 bg-background/75 hover:border-primary/40 hover:bg-muted/45",
                  ].join(" ")}
                  onClick={() => setSelectedRecipeId(recipe.id)}
                  role="radio"
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-medium">{recipe.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {recipe.slug}
                      </div>
                    </div>
                    <div className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                      共 {recipe.stepCount} 步
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {!isLoadingRecipes && recipes.length === 0 && !recipesError ? (
            <div className="mt-5 rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm text-muted-foreground">
              当前没有可开始的菜谱，请稍后再试。
            </div>
          ) : null}
        </section>

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
