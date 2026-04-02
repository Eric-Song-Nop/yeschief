import type { CompanionTimer } from "@/lib/api"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TimerListProps = {
  timers: CompanionTimer[]
}

const getTimerStatusLabel = (status: CompanionTimer["status"]) => {
  switch (status) {
    case "cancelled":
      return "已取消"
    case "expired":
      return "已到点"
    case "running":
      return "进行中"
  }
}

export function TimerList({ timers }: TimerListProps) {
  return (
    <Card className="h-full">
      <CardHeader className="gap-2">
        <CardTitle>正在计时</CardTitle>
        <CardDescription>
          页面只显示当前仍在运行的计时器，语音才是主要控制入口。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {timers.length > 0 ? (
          <div className="space-y-3">
            {timers.map((timer) => (
              <div
                className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-3"
                key={timer.timerId}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{timer.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      第 {timer.stepIndex + 1} 步
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {getTimerStatusLabel(timer.status)}
                  </Badge>
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight">
                  {timer.remainingTimeLabel}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-5 text-sm leading-6 text-muted-foreground">
            当前没有运行中的计时器。这是正常状态，等你用语音创建后会显示在这里。
          </div>
        )}
      </CardContent>
    </Card>
  )
}
