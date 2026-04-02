import type { SessionRecoveryItem } from "@yes-chief/shared"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type SessionRecoveryListProps = {
  error?: string
  isLoading: boolean
  isLoadingSession: boolean
  onLoadSession: (sessionId: string) => void
  sessions: SessionRecoveryItem[]
}

const RECOVERY_STATUS_LABELS: Record<SessionRecoveryItem["status"], string> = {
  active: "进行中",
  completed: "已完成",
  paused: "已暂停",
}

const formatUpdatedAt = (updatedAt: string) => {
  const date = new Date(updatedAt)

  if (Number.isNaN(date.getTime())) {
    return updatedAt
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date)
}

const getRecoveryActionLabel = (session: SessionRecoveryItem) =>
  session.status === "completed" ? "查看总结" : "继续烹饪"

export function SessionRecoveryList({
  error = "",
  isLoading,
  isLoadingSession,
  onLoadSession,
  sessions,
}: SessionRecoveryListProps) {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 rounded-[2rem] border border-border/50 bg-background/70 p-6 shadow-sm shadow-primary/5 sm:p-8">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
          继续之前的会话
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          恢复已有 session
        </h2>
        <p className="text-sm text-muted-foreground md:text-base">
          恢复时始终先加载服务端 snapshot 和 timers，不会重新创建业务会话。
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              className="rounded-[1.75rem] border border-border/50 bg-background/90 p-6"
              key={`recovery-skeleton-${index}`}
            >
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-4 h-4 w-1/3" />
              <Skeleton className="mt-8 h-10 w-28" />
            </div>
          ))}
        </div>
      ) : sessions.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sessions.map((session) => (
            <Card
              className="rounded-[1.75rem] border-border/60 bg-background/90 shadow-none"
              key={session.sessionId}
            >
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl leading-tight">
                      {session.recipeTitle}
                    </CardTitle>
                    <CardDescription>
                      第 {session.currentStepIndex + 1} 步 / 共{" "}
                      {session.totalSteps} 步
                    </CardDescription>
                  </div>
                  <div className="rounded-full bg-primary/[0.08] px-3 py-1 text-xs font-semibold tracking-[0.16em] text-primary">
                    {RECOVERY_STATUS_LABELS[session.status]}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                  <div>最后活动时间</div>
                  <div className="mt-1 font-medium text-foreground">
                    {formatUpdatedAt(session.updatedAt)}
                  </div>
                </div>

                <Button
                  className="min-h-12 w-full text-base"
                  disabled={isLoadingSession}
                  onClick={() => onLoadSession(session.sessionId)}
                  variant={session.status === "completed" ? "secondary" : "default"}
                >
                  {isLoadingSession ? (
                    <>
                      <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                      正在恢复
                    </>
                  ) : (
                    getRecoveryActionLabel(session)
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-border/70 bg-background/60 px-5 py-8 text-sm text-muted-foreground">
          还没有可恢复的会话。你可以直接从下面开始新的一道菜。
        </div>
      )}
    </section>
  )
}
