import type { ReactNode } from "react"
import type { SessionSnapshot } from "@yes-chief/shared"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type SessionDashboardProps = {
  recipeTitle: string
  statusPanel: ReactNode
  stepProgressLabel: string
  summary?: string | null
  timerPanel: ReactNode
  visibleSnapshot: SessionSnapshot
}

export function SessionDashboard({
  recipeTitle,
  statusPanel,
  stepProgressLabel,
  summary,
  timerPanel,
  visibleSnapshot,
}: SessionDashboardProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.95fr)]">
      <div className="space-y-6">
        {statusPanel}

        <Card className="overflow-hidden border-border/70 bg-background/90 shadow-lg shadow-primary/5">
          <CardHeader className="gap-4 border-b border-border/70 bg-muted/20">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Active</Badge>
              <Badge variant="secondary">{recipeTitle}</Badge>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                当前步骤
              </div>
              <CardTitle className="text-3xl leading-tight text-balance md:text-5xl">
                {visibleSnapshot.currentStep.title}
              </CardTitle>
              <CardDescription className="text-base">
                {stepProgressLabel}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <div className="rounded-3xl border border-primary/15 bg-primary/[0.05] px-5 py-5">
              <div className="text-sm leading-7 text-foreground md:text-lg md:leading-8">
                {visibleSnapshot.currentStep.instruction}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  火候提示
                </div>
                <div className="mt-2 text-base font-medium">
                  {visibleSnapshot.currentStep.heatLevel}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  观察重点
                </div>
                <div className="mt-2 text-base font-medium">
                  {visibleSnapshot.currentStep.focus}
                </div>
              </div>
            </div>

            {summary ? (
              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground">
                {summary}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div>
          <div className="mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            正在计时
          </div>
          {timerPanel}
        </div>
      </div>
    </div>
  )
}
