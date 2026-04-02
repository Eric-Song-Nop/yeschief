import type { ReactNode } from "react"
import type { SessionSummary as SessionSummaryData } from "@yes-chief/shared"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type SessionSummaryProps = {
  action?: ReactNode
  summary: SessionSummaryData
}

export function SessionSummary({ action, summary }: SessionSummaryProps) {
  return (
    <Card className="mx-auto w-full max-w-3xl border-primary/20 bg-background/95 shadow-xl shadow-primary/10">
      <CardHeader className="items-start gap-4 text-left">
        <Badge>Completed</Badge>
        <div className="space-y-2">
          <CardTitle className="text-3xl md:text-4xl">
            {summary.recipeTitle} 已完成
          </CardTitle>
          <CardDescription>
            这次做菜已经收口，下面是本轮语音陪伴的完成摘要。
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              完成时间
            </div>
            <div className="mt-2 text-sm text-foreground">
              {summary.completedAt}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              最终进度
            </div>
            <div className="mt-2 text-sm text-foreground">
              第 {summary.finalStepIndex + 1} 步 / 共 {summary.totalSteps} 步
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              已到点计时器
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {summary.expiredTimerCount}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/25 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              已取消计时器
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              {summary.cancelledTimerCount}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border/70 bg-primary/[0.05] px-5 py-5 text-sm leading-7 text-foreground md:text-base">
          {summary.completionMessage}
        </div>

        {action ? <div>{action}</div> : null}
      </CardContent>
    </Card>
  )
}
