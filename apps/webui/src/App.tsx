import type {
  ConnectSessionResult,
  CreateSessionResult,
  SessionSnapshot,
  SessionTimer,
  RecipeSummary,
} from "@yes-chief/shared"
import { Track, Room, RoomEvent, type RemoteTrack } from "livekit-client"
import { useEffect, useRef, useState } from "react"
import { LoaderCircle, Soup } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  connectSession,
  createSession,
  getSession,
  listPresetRecipes,
  listSessionTimers,
} from "@/lib/api"

type VoiceStatus = {
  agentReady: boolean
  audioReady: boolean
  connected: boolean
  connecting: boolean
  micEnabled: boolean
}

const initialVoiceStatus: VoiceStatus = {
  agentReady: false,
  audioReady: false,
  connected: false,
  connecting: false,
  micEnabled: false,
}

const formatRemainingTime = (remainingSec?: number) => {
  if (typeof remainingSec !== "number" || Number.isNaN(remainingSec)) {
    return "unknown"
  }

  const minutes = Math.floor(remainingSec / 60)
  const seconds = remainingSec % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

const attachRemoteAudioTrack = (
  track: RemoteTrack,
  audioHost: HTMLDivElement | null
) => {
  const mediaElement = track.attach()

  mediaElement.autoplay = true
  mediaElement.setAttribute("playsinline", "true")

  audioHost?.appendChild(mediaElement)

  return mediaElement
}

export function App() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [selectedRecipeId, setSelectedRecipeId] = useState("")
  const [sessionResult, setSessionResult] =
    useState<CreateSessionResult | null>(null)
  const [latestSnapshot, setLatestSnapshot] = useState<SessionSnapshot | null>(
    null
  )
  const [timers, setTimers] = useState<SessionTimer[]>([])
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true)
  const [recipesError, setRecipesError] = useState("")
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isJoiningVoice, setIsJoiningVoice] = useState(false)
  const [createError, setCreateError] = useState("")
  const [voiceError, setVoiceError] = useState("")
  const [voiceStatus, setVoiceStatus] = useState(initialVoiceStatus)
  const [connectResult, setConnectResult] =
    useState<ConnectSessionResult | null>(null)
  const roomRef = useRef<Room | null>(null)
  const audioHostRef = useRef<HTMLDivElement | null>(null)
  const attachedAudioRef = useRef(new Map<string, HTMLMediaElement>())

  useEffect(() => {
    let cancelled = false

    const loadRecipes = async () => {
      setIsLoadingRecipes(true)
      setRecipesError("")

      try {
        const nextRecipes = await listPresetRecipes()

        if (cancelled) {
          return
        }

        setRecipes(nextRecipes)
        setSelectedRecipeId(
          (currentRecipeId) => currentRecipeId || nextRecipes[0]?.id || ""
        )
      } catch (error) {
        if (cancelled) {
          return
        }

        setRecipesError(
          error instanceof Error ? error.message : "加载 preset recipes 失败。"
        )
      } finally {
        if (!cancelled) {
          setIsLoadingRecipes(false)
        }
      }
    }

    void loadRecipes()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const attachedAudio = attachedAudioRef.current

    return () => {
      const room = roomRef.current

      roomRef.current = null

      for (const [trackSid, mediaElement] of attachedAudio) {
        mediaElement.remove()
        attachedAudio.delete(trackSid)
      }

      if (room) {
        room.removeAllListeners()
        void room.disconnect()
      }
    }
  }, [])

  useEffect(() => {
    const sessionId = sessionResult?.session.sessionId

    if (!sessionId || !voiceStatus.connected) {
      return
    }

    let cancelled = false

    const syncCompanionState = async () => {
      try {
        const [sessionResponse, timersResponse] = await Promise.all([
          getSession(sessionId),
          listSessionTimers(sessionId),
        ])

        if (cancelled) {
          return
        }

        setLatestSnapshot(sessionResponse.session)
        setTimers(timersResponse.timers)
      } catch (error) {
        if (cancelled) {
          return
        }

        setVoiceError(
          error instanceof Error
            ? error.message
            : "同步 companion 状态失败。"
        )
      }
    }

    void syncCompanionState()

    const timer = window.setInterval(() => {
      void syncCompanionState()
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionResult?.session.sessionId, voiceStatus.connected])

  const selectedRecipe =
    recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null

  const clearAttachedAudio = () => {
    for (const [trackSid, mediaElement] of attachedAudioRef.current) {
      mediaElement.remove()
      attachedAudioRef.current.delete(trackSid)
    }
  }

  const disconnectRoom = async () => {
    const room = roomRef.current

    roomRef.current = null
    clearAttachedAudio()

    if (room) {
      room.removeAllListeners()
      await room.disconnect()
    }

    setVoiceStatus(initialVoiceStatus)
    setConnectResult(null)
  }

  const handleCreateSession = async () => {
    if (!selectedRecipeId) {
      setCreateError("请先选择一个 recipe。")
      return
    }

    setIsCreatingSession(true)
    setCreateError("")
    setVoiceError("")

    try {
      await disconnectRoom()

      const result = await createSession(selectedRecipeId)

      setSessionResult(result)
      setLatestSnapshot(result.session)
      setTimers(result.session.activeTimers)
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "创建 session 失败。"
      )
    } finally {
      setIsCreatingSession(false)
    }
  }

  const handleJoinVoice = async () => {
    if (!sessionResult) {
      return
    }

    setIsJoiningVoice(true)
    setVoiceError("")
    setVoiceStatus({
      ...initialVoiceStatus,
      connecting: true,
    })

    try {
      await disconnectRoom()

      setVoiceStatus({
        ...initialVoiceStatus,
        connecting: true,
      })

      const nextConnectResult = await connectSession(sessionResult.session.sessionId)
      const room = new Room()
      const isCurrentRoom = () => roomRef.current === room
      const syncAgentReady = () => {
        if (!isCurrentRoom()) {
          return
        }

        const agentReady = Array.from(room.remoteParticipants.values()).some(
          (participant) => participant.isAgent
        )

        setVoiceStatus((currentStatus) => ({
          ...currentStatus,
          agentReady,
        }))
      }

      roomRef.current = room
      setConnectResult(nextConnectResult)

      room.on(RoomEvent.Connected, () => {
        if (!isCurrentRoom()) {
          return
        }

        setVoiceStatus((currentStatus) => ({
          ...currentStatus,
          connected: true,
          connecting: false,
        }))
        syncAgentReady()
      })

      room.on(RoomEvent.Disconnected, () => {
        if (!isCurrentRoom()) {
          return
        }

        clearAttachedAudio()
        setVoiceStatus(initialVoiceStatus)
      })

      room.on(RoomEvent.ParticipantConnected, () => {
        syncAgentReady()
      })

      room.on(RoomEvent.ParticipantDisconnected, () => {
        syncAgentReady()
      })

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (!isCurrentRoom() || track.kind !== Track.Kind.Audio) {
          return
        }

        const mediaElement = attachRemoteAudioTrack(track, audioHostRef.current)
        const trackSid = track.sid

        if (trackSid) {
          attachedAudioRef.current.set(trackSid, mediaElement)
        }

        setVoiceStatus((currentStatus) => ({
          ...currentStatus,
          audioReady: room.canPlaybackAudio,
        }))
        syncAgentReady()
      })

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (!isCurrentRoom() || track.kind !== Track.Kind.Audio) {
          return
        }

        const trackSid = track.sid

        if (!trackSid) {
          return
        }

        const mediaElement = attachedAudioRef.current.get(trackSid)

        if (mediaElement) {
          track.detach(mediaElement)
          mediaElement.remove()
          attachedAudioRef.current.delete(trackSid)
        }
      })

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!isCurrentRoom()) {
          return
        }

        setVoiceStatus((currentStatus) => ({
          ...currentStatus,
          audioReady: room.canPlaybackAudio,
        }))
      })

      room.on(RoomEvent.MediaDevicesError, (error) => {
        if (!isCurrentRoom()) {
          return
        }

        setVoiceError(error.message)
      })

      await room.connect(
        nextConnectResult.serverUrl,
        nextConnectResult.participantToken
      )
      await room.startAudio()
      await room.localParticipant.setMicrophoneEnabled(true)

      setVoiceStatus((currentStatus) => ({
        ...currentStatus,
        agentReady: Array.from(room.remoteParticipants.values()).some(
          (participant) => participant.isAgent
        ),
        audioReady: room.canPlaybackAudio,
        connected: true,
        connecting: false,
        micEnabled: true,
      }))

      const [sessionResponse, timersResponse] = await Promise.all([
        getSession(sessionResult.session.sessionId),
        listSessionTimers(sessionResult.session.sessionId),
      ])

      setLatestSnapshot(sessionResponse.session)
      setTimers(timersResponse.timers)
    } catch (error) {
      await disconnectRoom()
      setVoiceError(
        error instanceof Error ? error.message : "连接 voice session 失败。"
      )
    } finally {
      setIsJoiningVoice(false)
    }
  }

  const displayedSnapshot = latestSnapshot ?? sessionResult?.session ?? null

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top,oklch(0.99_0.02_95),transparent_45%),linear-gradient(180deg,oklch(0.99_0.01_95),oklch(0.97_0.01_95))] px-6 py-10 text-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Soup className="size-3.5" />
                Phase 2 Realtime Voice Guidance
              </div>
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight">
                  创建 cooking session 并接通实时语音 tutor
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  这个 companion 页面现在承担最小可用的 voice 入口：创建 session、
                  请求 connect token、加入 LiveKit room，并投影当前步骤与 timer 状态。
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/60 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                API Base
              </div>
              <div className="mt-1 font-mono text-sm">
                {import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Preset Recipes
              </h2>
              {isLoadingRecipes ? (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  正在加载
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  共 {recipes.length} 个 recipe
                </div>
              )}
            </div>

            {recipesError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {recipesError}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              {recipes.map((recipe) => {
                const isSelected = recipe.id === selectedRecipeId

                return (
                  <button
                    key={recipe.id}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/70 bg-background/70 hover:border-primary/40 hover:bg-muted/60",
                    ].join(" ")}
                    onClick={() => setSelectedRecipeId(recipe.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{recipe.title}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {recipe.slug}
                        </div>
                      </div>
                      <div className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                        {recipe.stepCount} steps
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {!isLoadingRecipes && recipes.length === 0 && !recipesError ? (
              <div className="rounded-2xl border border-border/70 bg-muted/50 p-4 text-sm text-muted-foreground">
                当前没有可用的 preset recipe。
              </div>
            ) : null}
          </div>
        </section>

        <aside className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm backdrop-blur">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Create Session
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              选择 recipe 后调用 API 创建 session，并展示返回的初始快照。
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-border/70 bg-muted/40 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              当前选择
            </div>
            {selectedRecipe ? (
              <div className="mt-3 space-y-2">
                <div className="text-lg font-medium">
                  {selectedRecipe.title}
                </div>
                <div className="text-sm text-muted-foreground">
                  recipeId:{" "}
                  <span className="font-mono text-foreground">
                    {selectedRecipe.id}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  stepCount: {selectedRecipe.stepCount}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">
                先从左侧列表选择一个 recipe。
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button
              className="min-w-40"
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
                  正在创建
                </>
              ) : (
                "Create Session"
              )}
            </Button>
            <div className="text-sm text-muted-foreground">
              创建成功后即可进入最小 voice 连接流程。
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-background/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Join Voice Session</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  通过 API 获取当前 session 的 LiveKit token，然后连接房间、开麦并等待 agent。
                </div>
              </div>
              <Button
                disabled={!sessionResult || isJoiningVoice || isCreatingSession}
                onClick={() => void handleJoinVoice()}
                variant="secondary"
              >
                {isJoiningVoice ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Connecting
                  </>
                ) : (
                  "Join Voice Session"
                )}
              </Button>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                {voiceStatus.connecting ? "Connecting" : "Not connected"}
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                {voiceStatus.connected ? "Connected" : "Disconnected"}
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                Mic {voiceStatus.micEnabled ? "on" : "off"}
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
                Audio {voiceStatus.audioReady ? "ready" : "locked"}
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 sm:col-span-2">
                Agent ready: {voiceStatus.agentReady ? "yes" : "waiting"}
              </div>
            </div>

            {connectResult ? (
              <div className="mt-4 rounded-xl border border-border/60 bg-background/80 px-3 py-3 text-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  roomName
                </div>
                <div className="mt-1 font-mono">{connectResult.roomName}</div>
              </div>
            ) : null}

            <div className="sr-only" ref={audioHostRef} />
          </div>

          {createError ? (
            <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {createError}
            </div>
          ) : null}

          {voiceError ? (
            <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {voiceError}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Session Snapshot
            </div>
            {displayedSnapshot ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    sessionId
                  </div>
                  <div className="mt-1 font-mono text-sm">
                    {displayedSnapshot.sessionId}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      recipeTitle
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {displayedSnapshot.recipeTitle}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      status
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {displayedSnapshot.status}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      currentStep
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {displayedSnapshot.currentStep.title}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {displayedSnapshot.currentStep.instruction}
                    </div>
                  </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Active Timers
                  </div>
                  <div className="mt-3 space-y-2">
                    {timers.length > 0 ? (
                      timers.map((timer) => (
                        <div
                          key={timer.timerId}
                          className="rounded-xl border border-border/60 bg-muted/35 px-3 py-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{timer.label}</div>
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                              {timer.status}
                            </div>
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            remainingSec: {formatRemainingTime(timer.remainingSec)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                        当前没有 Active Timers。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-4 text-sm text-muted-foreground">
                创建成功后，这里会显示 `sessionId`、`recipeTitle`、`status` 和
                `currentStep.title`，加入 voice session 后还会投影 `Active Timers`。
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}

export default App
