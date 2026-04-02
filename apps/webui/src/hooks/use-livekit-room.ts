import type { ConnectSessionResult } from "@yes-chief/shared"
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client"
import { useEffect, useRef, useState } from "react"

export type VoiceActivityState = "disconnected" | "idle" | "speaking"

export type VoiceStatus = {
  agentReady: boolean
  audioReady: boolean
  connected: boolean
  connecting: boolean
  micEnabled: boolean
}

type AttachedAudio = {
  mediaElement: HTMLMediaElement
  track: RemoteTrack
}

type AudioAnalysis = {
  analyser: AnalyserNode | null
  context: AudioContext | null
  frameId: number | null
  source: MediaElementAudioSourceNode | null
  trackSid: string | null
}

export const initialVoiceStatus: VoiceStatus = {
  agentReady: false,
  audioReady: false,
  connected: false,
  connecting: false,
  micEnabled: false,
}

const SPEAKING_THRESHOLD = 0.08
const SPEAKING_MULTIPLIER = 6

const buildApiRecoveryMessage = (
  message: string | undefined,
  fallback: string
) => {
  const detail = message?.trim() || fallback

  return `请确认 API 与 LiveKit 已启动后重试。 ${detail}`
}

const buildMicRecoveryMessage = (
  message: string | undefined,
  fallback: string
) => {
  const detail = message?.trim() || fallback

  return `请检查麦克风权限后重试。 ${detail}`
}

const getAudioContextConstructor = () => {
  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  )
}

const getAgentReady = (room: Room) =>
  Array.from(room.remoteParticipants.values()).some(
    (participant) => participant.isAgent
  )

export function useLiveKitRoom() {
  const [connectResult, setConnectResult] =
    useState<ConnectSessionResult | null>(null)
  const [voiceError, setVoiceError] = useState("")
  const [voiceStatus, setVoiceStatus] = useState(initialVoiceStatus)
  const [voiceActivityLevel, setVoiceActivityLevel] = useState(0)
  const [voiceActivityState, setVoiceActivityState] =
    useState<VoiceActivityState>("disconnected")
  const audioHostRef = useRef<HTMLDivElement | null>(null)
  const roomRef = useRef<Room | null>(null)
  const attachedAudioRef = useRef(new Map<string, AttachedAudio>())
  const analysisRef = useRef<AudioAnalysis>({
    analyser: null,
    context: null,
    frameId: null,
    source: null,
    trackSid: null,
  })
  const isMountedRef = useRef(true)

  const stopVoiceActivityAnalysis = () => {
    const currentAnalysis = analysisRef.current

    if (currentAnalysis.frameId !== null) {
      window.cancelAnimationFrame(currentAnalysis.frameId)
    }

    currentAnalysis.source?.disconnect()
    currentAnalysis.analyser?.disconnect()

    if (currentAnalysis.context && currentAnalysis.context.state !== "closed") {
      void currentAnalysis.context.close()
    }

    analysisRef.current = {
      analyser: null,
      context: null,
      frameId: null,
      source: null,
      trackSid: null,
    }

    if (isMountedRef.current) {
      setVoiceActivityLevel(0)
      setVoiceActivityState("disconnected")
    }
  }

  const clearAttachedAudio = () => {
    stopVoiceActivityAnalysis()

    for (const [trackSid, attachedAudio] of attachedAudioRef.current) {
      attachedAudio.track.detach(attachedAudio.mediaElement)
      attachedAudio.mediaElement.remove()
      attachedAudioRef.current.delete(trackSid)
    }
  }

  const startVoiceActivityAnalysis = async (
    trackSid: string,
    mediaElement: HTMLMediaElement
  ) => {
    stopVoiceActivityAnalysis()

    const AudioContextConstructor = getAudioContextConstructor()

    if (!AudioContextConstructor) {
      return
    }

    try {
      const audioContext = new AudioContextConstructor()

      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }

      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.85

      const source = audioContext.createMediaElementSource(mediaElement)

      source.connect(analyser)
      analyser.connect(audioContext.destination)

      const sampleBuffer = new Uint8Array(analyser.fftSize)

      analysisRef.current = {
        analyser,
        context: audioContext,
        frameId: null,
        source,
        trackSid,
      }

      const updateVoiceActivity = () => {
        if (
          !isMountedRef.current ||
          analysisRef.current.trackSid !== trackSid ||
          roomRef.current === null
        ) {
          return
        }

        analyser.getByteTimeDomainData(sampleBuffer)

        let sum = 0

        for (const sample of sampleBuffer) {
          const normalized = (sample - 128) / 128

          sum += normalized * normalized
        }

        const rms = Math.sqrt(sum / sampleBuffer.length)
        const nextLevel = Math.min(1, rms * SPEAKING_MULTIPLIER)

        setVoiceActivityLevel(nextLevel)
        setVoiceActivityState(
          nextLevel >= SPEAKING_THRESHOLD ? "speaking" : "idle"
        )

        analysisRef.current.frameId =
          window.requestAnimationFrame(updateVoiceActivity)
      }

      updateVoiceActivity()
    } catch {
      stopVoiceActivityAnalysis()
    }
  }

  const attachRemoteAudioTrack = async (track: RemoteTrack) => {
    const mediaElement = track.attach()

    mediaElement.autoplay = true
    mediaElement.setAttribute("playsinline", "true")
    audioHostRef.current?.appendChild(mediaElement)

    const trackSid = track.sid

    if (!trackSid) {
      return
    }

    attachedAudioRef.current.set(trackSid, {
      mediaElement,
      track,
    })

    await startVoiceActivityAnalysis(trackSid, mediaElement)
  }

  const detachRemoteAudioTrack = (track: RemoteTrack) => {
    const trackSid = track.sid

    if (!trackSid) {
      return
    }

    const attachedAudio = attachedAudioRef.current.get(trackSid)

    if (!attachedAudio) {
      return
    }

    if (analysisRef.current.trackSid === trackSid) {
      stopVoiceActivityAnalysis()
    }

    track.detach(attachedAudio.mediaElement)
    attachedAudio.mediaElement.remove()
    attachedAudioRef.current.delete(trackSid)
  }

  const disconnectRoom = async () => {
    const room = roomRef.current

    roomRef.current = null
    clearAttachedAudio()

    if (room) {
      room.removeAllListeners()
      await room.disconnect()
    }

    if (isMountedRef.current) {
      setConnectResult(null)
      setVoiceError("")
      setVoiceStatus(initialVoiceStatus)
    }
  }

  const joinVoiceSession = async (connectPayload: ConnectSessionResult) => {
    setVoiceError("")
    setVoiceStatus({
      ...initialVoiceStatus,
      connecting: true,
    })

    try {
      await disconnectRoom()

      if (!isMountedRef.current) {
        return false
      }

      setVoiceStatus({
        ...initialVoiceStatus,
        connecting: true,
      })

      const room = new Room()
      const isCurrentRoom = () => roomRef.current === room
      const syncAgentReady = () => {
        if (!isCurrentRoom() || !isMountedRef.current) {
          return
        }

        setVoiceStatus((currentStatus) => ({
          ...currentStatus,
          agentReady: getAgentReady(room),
        }))
      }

      roomRef.current = room
      setConnectResult(connectPayload)

      room.on(RoomEvent.Connected, () => {
        if (!isCurrentRoom() || !isMountedRef.current) {
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
        if (!isCurrentRoom() || !isMountedRef.current) {
          return
        }

        clearAttachedAudio()
        setConnectResult(null)
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

        void attachRemoteAudioTrack(track)

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

        detachRemoteAudioTrack(track)
      })

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!isCurrentRoom() || !isMountedRef.current) {
          return
        }

        setVoiceStatus((currentStatus) => ({
          ...currentStatus,
          audioReady: room.canPlaybackAudio,
        }))
      })

      room.on(RoomEvent.MediaDevicesError, (error) => {
        if (!isCurrentRoom() || !isMountedRef.current) {
          return
        }

        setVoiceError(
          buildMicRecoveryMessage(error.message, "浏览器暂时无法访问麦克风。")
        )
      })

      await room.connect(
        connectPayload.serverUrl,
        connectPayload.participantToken
      )
      await room.startAudio()
      await room.localParticipant.setMicrophoneEnabled(true)

      if (!isMountedRef.current || !isCurrentRoom()) {
        return false
      }

      setVoiceStatus((currentStatus) => ({
        ...currentStatus,
        agentReady: getAgentReady(room),
        audioReady: room.canPlaybackAudio,
        connected: true,
        connecting: false,
        micEnabled: true,
      }))

      return true
    } catch (error) {
      await disconnectRoom()

      if (isMountedRef.current) {
        setVoiceError(
          buildApiRecoveryMessage(
            error instanceof Error ? error.message : undefined,
            "暂时无法接通语音指导。"
          )
        )
      }

      return false
    }
  }

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      void disconnectRoom()
    }
  }, [])

  return {
    audioHostRef,
    connectResult,
    disconnectRoom,
    joinVoiceSession,
    voiceActivityLevel,
    voiceActivityState,
    voiceError,
    voiceStatus,
  }
}
