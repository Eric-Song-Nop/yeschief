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
  lifecycleStatus,
  microphoneStatus,
  primaryAction,
  secondaryAction,
  sessionJoinStatus,
  tutorStatus,
  voiceActivityLabel,
}: ConnectionStatusProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Connection Status
        </div>
        <div className="mt-2 text-lg font-semibold text-foreground">
          {lifecycleStatus}
        </div>
        {lifecycleStatus === "Disconnected" ? (
          <div className="mt-2 text-sm text-muted-foreground">
            Auto-recovery has stopped. Click "Rejoin" to continue the current session.
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            {voiceActivityLabel}
          </div>
        )}
      </div>

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
