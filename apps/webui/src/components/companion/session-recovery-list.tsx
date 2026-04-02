import type { SessionRecoveryItem } from "@yes-chief/shared"
import {
  Clock,
  History,
  LoaderCircle,
  Play,
  ArrowRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type SessionRecoveryListProps = {
  error?: string
  isLoading: boolean
  isLoadingSession: boolean
  onLoadSession: (sessionId: string) => void
  sessions: SessionRecoveryItem[]
}

const RECOVERY_STATUS_LABELS: Record<SessionRecoveryItem["status"], string> = {
  active: "In Progress",
  completed: "Completed",
  paused: "Paused",
}

const formatUpdatedAt = (updatedAt: string) => {
  const date = new Date(updatedAt)

  if (Number.isNaN(date.getTime())) {
    return updatedAt
  }

  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

  if (diffInMinutes < 1) return "Just now"
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(date)
}

const getRecoveryActionLabel = (session: SessionRecoveryItem) =>
  session.status === "completed" ? "View Summary" : "Continue Cooking"

export function SessionRecoveryList({
  error = "",
  isLoading,
  isLoadingSession,
  onLoadSession,
  sessions,
}: SessionRecoveryListProps) {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-10">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <History className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Recent Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Quickly resume your cooking progress
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              className="rounded-[2rem] border border-border/40 bg-background/50 p-6"
              key={`recovery-skeleton-${index}`}
            >
              <div className="flex gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
              <Skeleton className="mt-8 h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : sessions.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {sessions.map((session) => (
            <Card
              className="group relative overflow-hidden rounded-[2rem] border-border/40 bg-background/40 transition-all duration-300 hover:bg-background/60 hover:shadow-xl hover:shadow-primary/5"
              key={session.sessionId}
            >
              <CardHeader className="p-6 pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-semibold transition-colors group-hover:text-primary">
                      {session.recipeTitle}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 font-medium">
                      <span>Step {session.currentStepIndex + 1}</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                      <span>of {session.totalSteps} steps</span>
                    </CardDescription>
                  </div>
                  <div
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                      session.status === "active"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : session.status === "completed"
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-orange-500/10 text-orange-600"
                    )}
                  >
                    {RECOVERY_STATUS_LABELS[session.status]}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-6">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Last active: {formatUpdatedAt(session.updatedAt)}</span>
                  </div>
                </div>

                <Button
                  className="h-12 w-full rounded-2xl text-sm font-semibold transition-all group-hover:bg-primary group-hover:text-primary-foreground"
                  disabled={isLoadingSession}
                  onClick={() => onLoadSession(session.sessionId)}
                  variant="secondary"
                >
                  {isLoadingSession ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <div className="flex items-center gap-2">
                      {session.status === "completed" ? (
                        <ArrowRight className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 fill-current" />
                      )}
                      {getRecoveryActionLabel(session)}
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-border/60 bg-background/20 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/30 text-muted-foreground/40">
            <History className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-medium text-foreground/60">
            No history yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your cooking sessions will appear here once you start.
          </p>
        </div>
      )}
    </section>
  )
}
