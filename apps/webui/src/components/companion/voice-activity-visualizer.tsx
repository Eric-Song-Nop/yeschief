import type { CSSProperties } from "react"

import type { VoiceActivityState } from "@/hooks/use-livekit-room"

import { cn } from "@/lib/utils"

type VoiceActivityVisualizerProps = {
  voiceActivityLevel: number
  voiceActivityState: VoiceActivityState
}

const BAR_COUNT = 5
const IDLE_HEIGHT = 0.28
const HEIGHT_FACTORS = [0.52, 0.8, 1, 0.8, 0.52]

const getBarScale = (
  index: number,
  voiceActivityLevel: number,
  voiceActivityState: VoiceActivityState
) => {
  if (voiceActivityState !== "speaking") {
    return IDLE_HEIGHT
  }

  const normalizedLevel = Math.max(0, Math.min(1, voiceActivityLevel))

  return Math.max(
    IDLE_HEIGHT,
    Math.min(1, IDLE_HEIGHT + normalizedLevel * HEIGHT_FACTORS[index])
  )
}

const getVoiceActivityLabel = (voiceActivityState: VoiceActivityState) => {
  switch (voiceActivityState) {
    case "speaking":
      return "Tutor is speaking"
    case "idle":
      return "Tutor is online and waiting"
    case "disconnected":
      return "No remote audio detected"
  }
}

export function VoiceActivityVisualizer({
  voiceActivityLevel,
  voiceActivityState,
}: VoiceActivityVisualizerProps) {
  return (
    <div
      aria-label="Tutor Voice Activity"
      className="rounded-[1.75rem] border border-primary/20 bg-background/90 px-5 py-4"
      data-voice-activity-state={voiceActivityState}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Tutor Presence
          </div>
          <div className="mt-1 font-medium text-foreground">
            {getVoiceActivityLabel(voiceActivityState)}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Real-time audio driven</div>
      </div>

      <div className="mt-4 flex h-14 items-end gap-2">
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const scale = getBarScale(
            index,
            voiceActivityLevel,
            voiceActivityState
          )

          return (
            <span
              aria-hidden="true"
              className={cn(
                "block h-full flex-1 rounded-full bg-primary/18 transition-all duration-150 ease-out",
                voiceActivityState === "speaking" && "bg-primary/75",
                voiceActivityState === "idle" && "bg-primary/28"
              )}
              key={`voice-activity-bar-${index}`}
              style={
                {
                  transform: `scaleY(${scale})`,
                  transformOrigin: "bottom center",
                } satisfies CSSProperties
              }
            />
          )
        })}
      </div>
    </div>
  )
}
