import type { SessionRoomBinding } from "@yes-chief/shared"
import { getDatabase } from "../persistence/db"

type SessionRoomBindingRow = SessionRoomBinding

const selectBindingBy = (
  field: "sessionId" | "roomName",
  value: string,
  databaseUrl?: string
) => {
  const sqlite = getDatabase(databaseUrl)

  return sqlite
    .prepare(
      `
        SELECT
          "sessionId",
          "roomName",
          "createdAt",
          "updatedAt"
        FROM session_room_bindings
        WHERE "${field}" = ?1
        LIMIT 1
      `
    )
    .get(value) as SessionRoomBindingRow | undefined
}

export const getSessionRoomBinding = (
  sessionId: string,
  databaseUrl?: string
): SessionRoomBinding | null =>
  selectBindingBy("sessionId", sessionId, databaseUrl) ?? null

export const getBindingByRoomName = (
  roomName: string,
  databaseUrl?: string
): SessionRoomBinding | null =>
  selectBindingBy("roomName", roomName, databaseUrl) ?? null

export const upsertSessionRoomBinding = (
  input: {
    sessionId: string
    roomName: string
  },
  databaseUrl?: string
): SessionRoomBinding => {
  const sqlite = getDatabase(databaseUrl)
  const existing = getSessionRoomBinding(input.sessionId, databaseUrl)
  const now = new Date().toISOString()
  const createdAt = existing?.createdAt ?? now

  if (existing) {
    sqlite
      .prepare(
        `
          UPDATE session_room_bindings
          SET
            "roomName" = ?2,
            "updatedAt" = ?3
          WHERE "sessionId" = ?1
        `
      )
      .run(input.sessionId, input.roomName, now)
  } else {
    sqlite
      .prepare(
        `
          INSERT INTO session_room_bindings (
            "sessionId",
            "roomName",
            "createdAt",
            "updatedAt"
          ) VALUES (
            ?1,
            ?2,
            ?3,
            ?4
          )
        `
      )
      .run(input.sessionId, input.roomName, createdAt, now)
  }

  return {
    createdAt,
    roomName: input.roomName,
    sessionId: input.sessionId,
    updatedAt: now,
  }
}

export const clearSessionRoomBinding = (
  sessionId: string,
  databaseUrl?: string
) => {
  const sqlite = getDatabase(databaseUrl)

  sqlite
    .prepare(
      `
        DELETE FROM session_room_bindings
        WHERE "sessionId" = ?1
      `
    )
    .run(sessionId)
}
