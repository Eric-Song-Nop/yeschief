import type {
  ConnectSessionResult,
  DeleteSessionRoomResult,
} from "@yes-chief/shared"
import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
} from "livekit-server-sdk"
import {
  clearSessionRoomBinding,
  getSessionRoomBinding,
  upsertSessionRoomBinding,
} from "./session-room-binding"

const LIVEKIT_AGENT_NAME = "agent"
const DISPATCH_REQUEST_TIMEOUT_SEC = 10
const PARTICIPANT_TOKEN_TTL = "15m"

type LiveKitEnv = Record<string, string | undefined>
type LiveKitConfig = ReturnType<typeof getLiveKitConfig>
type SessionRoomClient = {
  createRoom(options: {
    departureTimeout: number
    emptyTimeout: number
    name: string
  }): Promise<unknown>
  deleteRoom(room: string): Promise<void>
  listRooms(names?: string[]): Promise<Array<{ name?: string }>>
}
type SessionRoomClientFactory = (config: LiveKitConfig) => SessionRoomClient

const createServiceError = (status: number, message: string) =>
  Object.assign(new Error(message), { status })

const getLiveKitConfig = (env: LiveKitEnv) => {
  const requiredKeys = [
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
  ] as const

  const missing = requiredKeys.filter((key) => {
    const value = env[key]

    return typeof value !== "string" || value.trim().length === 0
  })

  if (missing.length > 0) {
    throw createServiceError(
      500,
      `${missing.join(", ")} are required for session connect`
    )
  }

  return {
    apiKey: env.LIVEKIT_API_KEY!.trim(),
    apiSecret: env.LIVEKIT_API_SECRET!.trim(),
    serverUrl: env.LIVEKIT_URL!.trim(),
  }
}

const buildParticipantIdentity = (sessionId: string) =>
  `web-${sessionId}-${crypto.randomUUID().slice(0, 8)}`

const buildDispatchMetadata = (sessionId: string, roomName: string) =>
  JSON.stringify({
    roomName,
    sessionId,
  })

const ensureRoomExists = async (
  roomClient: SessionRoomClient,
  roomName: string
) => {
  const existingRooms = await roomClient.listRooms([roomName])

  if (existingRooms.length > 0) {
    return
  }

  await roomClient.createRoom({
    departureTimeout: 20,
    emptyTimeout: 60,
    name: roomName,
  })
}

const createRoomServiceClient = (config: LiveKitConfig): SessionRoomClient =>
  new RoomServiceClient(config.serverUrl, config.apiKey, config.apiSecret, {
    requestTimeout: DISPATCH_REQUEST_TIMEOUT_SEC,
  })

let roomServiceClientFactory: SessionRoomClientFactory = createRoomServiceClient

export const setRoomServiceClientFactoryForTests = (
  factory: SessionRoomClientFactory | null
) => {
  roomServiceClientFactory = factory ?? createRoomServiceClient
}

const ensureAgentDispatch = async (
  dispatchClient: AgentDispatchClient,
  roomName: string,
  sessionId: string
) => {
  const metadata = buildDispatchMetadata(sessionId, roomName)
  const dispatches = await dispatchClient.listDispatch(roomName)
  const hasMatchingDispatch = dispatches.some(
    (dispatch) => dispatch.agentName === LIVEKIT_AGENT_NAME
  )

  if (hasMatchingDispatch) {
    return
  }

  await dispatchClient.createDispatch(roomName, LIVEKIT_AGENT_NAME, {
    metadata,
  })
}

const roomExists = async (roomClient: SessionRoomClient, roomName: string) => {
  const existingRooms = await roomClient.listRooms([roomName])

  return existingRooms.some((room) => room.name === roomName)
}

const buildReplacementRoomName = (sessionId: string) =>
  `session-${sessionId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`

const resolveSessionRoomBinding = async (
  sessionId: string,
  roomClient: SessionRoomClient,
  databaseUrl?: string
) => {
  const currentBinding = getSessionRoomBinding(sessionId, databaseUrl)

  if (
    currentBinding &&
    (await roomExists(roomClient, currentBinding.roomName))
  ) {
    return currentBinding
  }

  if (!currentBinding && (await roomExists(roomClient, sessionId))) {
    return upsertSessionRoomBinding(
      {
        roomName: sessionId,
        sessionId,
      },
      databaseUrl
    )
  }

  const roomName = buildReplacementRoomName(sessionId)

  await ensureRoomExists(roomClient, roomName)

  return upsertSessionRoomBinding(
    {
      roomName,
      sessionId,
    },
    databaseUrl
  )
}

export const connectSession = async (
  sessionId: string,
  env: LiveKitEnv = Bun.env,
  databaseUrl?: string
): Promise<ConnectSessionResult> => {
  const config = getLiveKitConfig(env)
  const dispatchClient = new AgentDispatchClient(
    config.serverUrl,
    config.apiKey,
    config.apiSecret,
    {
      requestTimeout: DISPATCH_REQUEST_TIMEOUT_SEC,
    }
  )
  const roomClient = roomServiceClientFactory(config)
  let binding

  try {
    binding = await resolveSessionRoomBinding(
      sessionId,
      roomClient,
      databaseUrl
    )
    await ensureAgentDispatch(dispatchClient, binding.roomName, sessionId)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown dispatch failure"

    throw createServiceError(
      502,
      `Failed to dispatch agent for session connect: ${message}`
    )
  }

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: buildParticipantIdentity(sessionId),
    metadata: JSON.stringify({
      role: "web-companion",
      roomName: binding.roomName,
      sessionId,
    }),
    name: "Cooking Companion",
    ttl: PARTICIPANT_TOKEN_TTL,
  })

  token.addGrant({
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
    room: binding.roomName,
    roomJoin: true,
  })

  const participantToken = await token.toJwt()

  return {
    binding,
    participantToken,
    serverUrl: config.serverUrl,
    sessionId,
  }
}

export const deleteSessionRoom = async (
  sessionId: string,
  env: LiveKitEnv = Bun.env,
  databaseUrl?: string
): Promise<DeleteSessionRoomResult> => {
  const config = getLiveKitConfig(env)
  const roomClient = roomServiceClientFactory(config)
  const binding = getSessionRoomBinding(sessionId, databaseUrl)
  const roomName = binding?.roomName ?? sessionId

  try {
    const existingRooms = await roomClient.listRooms([roomName])

    if (existingRooms.length === 0) {
      clearSessionRoomBinding(sessionId, databaseUrl)

      return {
        cleanup: "already_missing",
        roomName,
        sessionId,
      }
    }

    await roomClient.deleteRoom(roomName)
    clearSessionRoomBinding(sessionId, databaseUrl)

    return {
      cleanup: "deleted",
      roomName,
      sessionId,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown room cleanup failure"

    throw createServiceError(
      502,
      `Failed to delete room for session cleanup: ${message}`
    )
  }
}
