import type { VoiceActivityState } from "@/hooks/use-livekit-room"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ConnectionStatusProps = {
  audioStatus: string
  lifecycleStatus: string
  microphoneStatus: string
  sessionJoinStatus: string
  tutorStatus: string
  voiceActivityLabel: string
  voiceActivityLevel: number
  voiceActivityState: VoiceActivityState
}

const getTutorBadgeVariant = (voiceActivityState: VoiceActivityState) => {
  switch (voiceActivityState) {
    case "speaking":
      return "success"
    case "idle":
      return "secondary"
    case "disconnected":
      return "outline"
  }
}

export function ConnectionStatus({
  audioStatus,
  lifecycleStatus,
  microphoneStatus,
  sessionJoinStatus,
  tutorStatus,
  voiceActivityLabel,
  voiceActivityLevel,
  voiceActivityState,
}: ConnectionStatusProps) {
  return (
    <Card className="border-primary/20 bg-primary/5 shadow-none">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              连接状态
            </div>
            <CardTitle className="mt-2 text-2xl md:text-3xl">
              {lifecycleStatus}
            </CardTitle>
          </div>
          <Badge variant={getTutorBadgeVariant(voiceActivityState)}>
            {tutorStatus}
          </Badge>
        </div>
        <CardDescription>
          接通语音指导后，优先跟着 tutor 往下做；页面只负责辅助查看状态。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background/90 px-3 py-2 text-sm">
            {microphoneStatus}
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/90 px-3 py-2 text-sm">
            {audioStatus}
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/90 px-3 py-2 text-sm sm:col-span-2">
            {sessionJoinStatus}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>语音活动</span>
            <span className="text-muted-foreground">{voiceActivityLabel}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {Array.from({ length: 12 }, (_, index) => {
              const intensity = Math.max(
                0.18,
                Math.min(1, voiceActivityLevel * 1.25 - index * 0.05)
              )

              return (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-7 flex-1 rounded-full bg-primary/15 transition-all duration-150",
                    voiceActivityState === "speaking" && "bg-primary/70"
                  )}
                  key={`voice-bar-${index}`}
                  style={{
                    opacity: intensity,
                    transform: `scaleY(${0.55 + intensity * 0.85})`,
                  }}
                />
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
