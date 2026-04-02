import type { ReactNode } from "react"
import type { VoiceActivityState } from "@/hooks/use-livekit-room"
import { Mic, Radio, UserCheck } from "lucide-react"

type ConnectionStatusProps = {
  audioStatus: string
  lifecycleStatus: string // We might still use this in small text
  microphoneStatus: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  sessionJoinStatus: string
  tutorStatus: string
  voiceActivityLabel: string
  voiceActivityState: VoiceActivityState
}

export function ConnectionStatus({
  audioStatus,
  microphoneStatus,
  primaryAction,
  secondaryAction,
  sessionJoinStatus,
  tutorStatus,
}: ConnectionStatusProps) {
  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      {primaryAction || secondaryAction ? (
        <div className="flex flex-col gap-3">
          {primaryAction && <div>{primaryAction}</div>}
          {secondaryAction && <div>{secondaryAction}</div>}
        </div>
      ) : null}

      {/* Connection Info Pills */}
      <div className="grid gap-2 text-[11px] font-medium tracking-wide">
        <div className="flex items-center gap-2 text-muted-foreground/80">
          <UserCheck className="h-3 w-3" />
          <span>{tutorStatus}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground/80">
          <Radio className="h-3 w-3" />
          <span>{sessionJoinStatus}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground/80">
          <Mic className="h-3 w-3" />
          <span>{microphoneStatus} • {audioStatus}</span>
        </div>
      </div>
    </div>
  )
}
