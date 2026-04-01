import type { GetSessionTimersResult, SessionTimer } from "@yes-chief/shared"
import { getDatabase } from "../persistence/db"

type TimerRow = {
  id: string
  sessionId: string
  label: string
  stepIndex: number
  durationSec: number
  startedAt: string
  targetAt: string
  status: SessionTimer["status"]
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  expiredAt: string | null
}

const createServiceError = (status: number, message: string) =>
  Object.assign(new Error(message), { status })

const getNowIso = () => new Date().toISOString()

const toTimer = (row: TimerRow, now = Date.now()): SessionTimer => {
  const targetAtMs = Date.parse(row.targetAt)
  const remainingMs =
    row.status === "running" ? Math.max(0, targetAtMs - now) : 0

  return {
    timerId: row.id,
    label: row.label,
    stepIndex: row.stepIndex,
    durationSec: row.durationSec,
    startedAt: row.startedAt,
    targetAt: row.targetAt,
    status: row.status,
    remainingSec: Math.ceil(remainingMs / 1000),
  }
}

const getTimerRows = (sessionId: string, databaseUrl?: string) => {
  const sqlite = getDatabase(databaseUrl)

  return sqlite
    .prepare(`
      SELECT
        "id",
        "sessionId",
        "label",
        "stepIndex",
        "durationSec",
        "startedAt",
        "targetAt",
        "status",
        "createdAt",
        "updatedAt",
        "cancelledAt",
        "expiredAt"
      FROM timers
      WHERE "sessionId" = ?1
      ORDER BY "targetAt" ASC, "createdAt" ASC
    `)
    .all(sessionId) as TimerRow[]
}

export const refreshExpiredTimers = (
  sessionId: string,
  databaseUrl?: string
) => {
  const sqlite = getDatabase(databaseUrl)
  const now = getNowIso()

  sqlite
    .prepare(`
      UPDATE timers
      SET
        "status" = 'expired',
        "expiredAt" = ?2,
        "updatedAt" = ?2
      WHERE
        "sessionId" = ?1
        AND "status" = 'running'
        AND datetime("targetAt") <= datetime(?2)
    `)
    .run(sessionId, now)
}

type CreateTimerInput = {
  sessionId: string
  stepIndex: number
  label: string
  durationSec: number
}

export const createTimer = (
  input: CreateTimerInput,
  databaseUrl?: string
): SessionTimer => {
  if (input.label.trim().length === 0) {
    throw createServiceError(400, "label is required")
  }

  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) {
    throw createServiceError(400, "durationSec must be a positive number")
  }

  const sqlite = getDatabase(databaseUrl)
  const now = getNowIso()
  const targetAt = new Date(Date.now() + input.durationSec * 1000).toISOString()
  const timerId = crypto.randomUUID()

  sqlite
    .prepare(`
      INSERT INTO timers (
        "id",
        "sessionId",
        "label",
        "stepIndex",
        "durationSec",
        "startedAt",
        "targetAt",
        "status",
        "createdAt",
        "updatedAt",
        "cancelledAt",
        "expiredAt"
      ) VALUES (
        ?1,
        ?2,
        ?3,
        ?4,
        ?5,
        ?6,
        ?7,
        'running',
        ?6,
        ?6,
        NULL,
        NULL
      )
    `)
    .run(
      timerId,
      input.sessionId,
      input.label.trim(),
      input.stepIndex,
      input.durationSec,
      now,
      targetAt
    )

  return {
    timerId,
    label: input.label.trim(),
    stepIndex: input.stepIndex,
    durationSec: input.durationSec,
    startedAt: now,
    targetAt,
    status: "running",
    remainingSec: input.durationSec,
  }
}

export const listTimers = (
  sessionId: string,
  databaseUrl?: string
): GetSessionTimersResult => {
  refreshExpiredTimers(sessionId, databaseUrl)

  const now = Date.now()

  return {
    sessionId,
    timers: getTimerRows(sessionId, databaseUrl).map((row) =>
      toTimer(row, now)
    ),
  }
}

type CancelTimerInput = {
  sessionId: string
  timerId?: string
  label?: string
}

export const cancelTimer = (
  input: CancelTimerInput,
  databaseUrl?: string
): SessionTimer => {
  const sqlite = getDatabase(databaseUrl)
  const now = getNowIso()
  const runningTimers = getTimerRows(input.sessionId, databaseUrl).filter(
    (timer) => timer.status === "running"
  )

  let matchedTimer: TimerRow | undefined

  if (input.timerId) {
    matchedTimer = runningTimers.find((timer) => timer.id === input.timerId)
  } else if (input.label) {
    const matches = runningTimers.filter((timer) => timer.label === input.label)

    if (matches.length > 1) {
      throw createServiceError(
        409,
        "label matches more than one running timer; use timerId instead"
      )
    }

    matchedTimer = matches[0]
  } else {
    throw createServiceError(400, "timerId or label is required")
  }

  if (!matchedTimer) {
    throw createServiceError(404, "Timer not found")
  }

  sqlite
    .prepare(`
      UPDATE timers
      SET
        "status" = 'cancelled',
        "cancelledAt" = ?2,
        "updatedAt" = ?2
      WHERE "id" = ?1
    `)
    .run(matchedTimer.id, now)

  return {
    ...toTimer(matchedTimer),
    remainingSec: 0,
    status: "cancelled",
  }
}

export const cancelRunningTimersForSession = (
  sessionId: string,
  databaseUrl?: string
) => {
  const sqlite = getDatabase(databaseUrl)
  const now = getNowIso()

  sqlite
    .prepare(`
      UPDATE timers
      SET
        "status" = 'cancelled',
        "cancelledAt" = ?2,
        "updatedAt" = ?2
      WHERE
        "sessionId" = ?1
        AND "status" = 'running'
    `)
    .run(sessionId, now)
}
