import type { ReactNode } from "react"
import type { SessionSnapshot } from "@yes-chief/shared"
import { Eye, Flame, Info } from "lucide-react"

import type { VoiceActivityState } from "@/hooks/use-livekit-room"

import { VoiceActivityVisualizer } from "@/components/companion/voice-activity-visualizer"
import { Badge } from "@/components/ui/badge"

const getHeatLevelLabel = (
  heatLevel: SessionSnapshot["currentStep"]["heatLevel"]
) => {
  switch (heatLevel) {
    case "high":
      return "High Heat"
    case "low":
      return "Low Heat"
    case "medium":
      return "Medium Heat"
    case "medium-high":
      return "Medium-High Heat"
    case "off":
      return "Off Heat"
  }
}

type SessionDashboardProps = {
  recipeTitle: string
  statusPanel: ReactNode
  stepProgressLabel: string
  summary?: string | null
  timerPanel: ReactNode
  visibleSnapshot: SessionSnapshot
  voiceActivityLevel: number
  voiceActivityState: VoiceActivityState
}

export function SessionDashboard({
  recipeTitle,
  statusPanel,
  stepProgressLabel,
  summary,
  timerPanel,
  visibleSnapshot,
  voiceActivityLevel,
  voiceActivityState,
}: SessionDashboardProps) {
  const isPaused = visibleSnapshot.status === "paused"

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_380px] items-start pb-20">
      <div
        className={`space-y-12 transition-all duration-500 ${
          isPaused ? "opacity-40 grayscale-[0.5]" : "opacity-100"
        }`}
      >
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {isPaused ? (
              <Badge
                variant="outline"
                className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                Paused
              </Badge>
            ) : (
              <Badge className="border-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400">
                In Progress
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="border-0 bg-muted/50 text-muted-foreground hover:bg-muted/80"
            >
              {recipeTitle}
            </Badge>
            <span className="text-sm font-medium tracking-wider text-muted-foreground/60">
              {stepProgressLabel}
            </span>
          </div>

          <h1 className="text-balance text-5xl font-light leading-[1.1] tracking-tight text-foreground sm:text-6xl md:text-7xl">
            {visibleSnapshot.currentStep.title}
          </h1>
        </div>

        {/* Main Instruction */}
        <div className="max-w-none">
          <p className="text-pretty text-2xl font-medium leading-relaxed text-foreground/90 md:text-3xl">
            {visibleSnapshot.currentStep.instruction}
          </p>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap gap-8 border-t border-border/40 pt-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                Heat Level
              </div>
              <div className="text-sm font-semibold text-foreground">
                {getHeatLevelLabel(visibleSnapshot.currentStep.heatLevel)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                Focus Point
              </div>
              <div className="text-sm font-semibold text-foreground">
                {visibleSnapshot.currentStep.focus}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Note - Feedback from tutor */}
        {summary && (
          <div className="flex items-start gap-3 rounded-2xl bg-primary/[0.03] border border-primary/5 p-5 text-primary">
            <Info className="mt-0.5 h-5 w-5 shrink-0 opacity-70" />
            <p className="text-sm font-medium leading-relaxed">{summary}</p>
          </div>
        )}
      </div>

      {/* Side Panel */}
      <div className="sticky top-8 space-y-10">
        {/* Timer Section - Most Urgent */}
        <div>
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
            Active Timers
          </div>
          {timerPanel}
        </div>

        {/* Voice Tutor Section */}
        <div className="space-y-6 border-t border-border/40 pt-10">
          <VoiceActivityVisualizer
            voiceActivityLevel={voiceActivityLevel}
            voiceActivityState={voiceActivityState}
          />
          {statusPanel}
        </div>
      </div>
    </div>
  )
}
