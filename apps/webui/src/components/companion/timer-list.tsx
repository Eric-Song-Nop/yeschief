import type { CompanionTimer } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Timer } from "lucide-react"

type TimerListProps = {
  timers: CompanionTimer[]
}

const getTimerStatusLabel = (status: CompanionTimer["status"]) => {
  switch (status) {
    case "cancelled":
      return "Cancelled"
    case "expired":
      return "Expired"
    case "running":
      return "Running"
  }
}

export function TimerList({ timers }: TimerListProps) {
  if (timers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center text-muted-foreground">
        <Timer className="mb-2 h-5 w-5 opacity-20" />
        <span className="text-xs font-medium tracking-wide">No active timers</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {timers.map((timer) => (
        <div
          className="group relative overflow-hidden rounded-2xl border border-border/40 bg-background/50 p-4 transition-all hover:border-primary/20 hover:bg-muted/30"
          key={timer.timerId}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="text-sm font-semibold tracking-tight text-foreground/90">
                {timer.label}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Step {timer.stepIndex + 1}
              </div>
            </div>
            <Badge
              variant="secondary"
              className="border-0 bg-primary/5 text-[10px] font-bold uppercase tracking-wider text-primary"
            >
              {getTimerStatusLabel(timer.status)}
            </Badge>
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-mono text-3xl font-medium tabular-nums tracking-tighter text-foreground">
              {timer.remainingTimeLabel}
            </span>
          </div>
          {/* Progress bar could go here if remainingSec is available */}
        </div>
      ))}
    </div>
  )
}
