import type {
  CreateSessionResult,
  RecipeSummary,
  SessionRecoveryItem,
  SessionSnapshot,
} from "@yes-chief/shared"
import { useEffect, useRef, useState } from "react"
import {
  createSession,
  getSession,
  listSessions,
  listPresetRecipes,
  listSessionTimers,
  toCompanionTimers,
  type CompanionTimer,
} from "@/lib/api"

type UseCookingSessionOptions = {
  shouldSync: boolean
}

const buildApiRecoveryMessage = (
  message: string | undefined,
  fallback: string
) => {
  const detail = message?.trim() || fallback

  return `Please make sure API and LiveKit are running and try again. ${detail}`
}

export function useCookingSession({ shouldSync }: UseCookingSessionOptions) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [recoverySessions, setRecoverySessions] = useState<
    SessionRecoveryItem[]
  >([])
  const [selectedRecipeId, setSelectedRecipeId] = useState("")
  const [sessionResult, setSessionResult] =
    useState<CreateSessionResult | null>(null)
  const [latestSnapshot, setLatestSnapshot] = useState<SessionSnapshot | null>(
    null
  )
  const [timers, setTimers] = useState<CompanionTimer[]>([])
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true)
  const [isLoadingRecoverySessions, setIsLoadingRecoverySessions] =
    useState(true)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [recipesError, setRecipesError] = useState("")
  const [recoveryError, setRecoveryError] = useState("")
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [createError, setCreateError] = useState("")
  const [syncError, setSyncError] = useState("")
  const isMountedRef = useRef(true)
  const sessionId = sessionResult?.session.sessionId

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadRecipes = async () => {
      setIsLoadingRecipes(true)
      setRecipesError("")

      try {
        const nextRecipes = await listPresetRecipes()

        if (cancelled || !isMountedRef.current) {
          return
        }

        setRecipes(nextRecipes)
        setSelectedRecipeId(
          (currentRecipeId) => currentRecipeId || nextRecipes[0]?.id || ""
        )
      } catch (error) {
        if (cancelled || !isMountedRef.current) {
          return
        }

        setRecipesError(
          buildApiRecoveryMessage(
            error instanceof Error ? error.message : undefined,
            "Unable to load available recipes at the moment."
          )
        )
      } finally {
        if (!cancelled && isMountedRef.current) {
          setIsLoadingRecipes(false)
        }
      }
    }

    void loadRecipes()

    return () => {
      cancelled = true
    }
  }, [])

  const refreshRecoverySessions = async () => {
    setIsLoadingRecoverySessions(true)
    setRecoveryError("")

    try {
      const result = await listSessions()

      if (!isMountedRef.current) {
        return
      }

      setRecoverySessions(result.sessions)
    } catch (error) {
      if (!isMountedRef.current) {
        return
      }

      setRecoveryError(
        buildApiRecoveryMessage(
          error instanceof Error ? error.message : undefined,
          "Unable to load recoverable sessions at the moment."
        )
      )
    } finally {
      if (isMountedRef.current) {
        setIsLoadingRecoverySessions(false)
      }
    }
  }

  useEffect(() => {
    void refreshRecoverySessions()
  }, [])

  const refreshCompanionState = async () => {
    if (!sessionId) {
      return null
    }

    try {
      const [sessionResponse, timersResponse] = await Promise.all([
        getSession(sessionId),
        listSessionTimers(sessionId),
      ])

      if (!isMountedRef.current) {
        return
      }

      setLatestSnapshot(sessionResponse.session)
      setTimers(toCompanionTimers(timersResponse.timers))
      setSyncError("")

      return sessionResponse.session
    } catch (error) {
      if (!isMountedRef.current) {
        return null
      }

      setSyncError(
        buildApiRecoveryMessage(
          error instanceof Error ? error.message : undefined,
          "Unable to sync current session at the moment."
        )
      )

      return null
    }
  }

  useEffect(() => {
    if (!sessionId || !shouldSync) {
      return
    }

    let cancelled = false

    const syncCompanionState = async () => {
      try {
        const [sessionResponse, timersResponse] = await Promise.all([
          getSession(sessionId),
          listSessionTimers(sessionId),
        ])

        if (cancelled || !isMountedRef.current) {
          return
        }

        setLatestSnapshot(sessionResponse.session)
        setTimers(toCompanionTimers(timersResponse.timers))
        setSyncError("")
      } catch (error) {
        if (cancelled || !isMountedRef.current) {
          return
        }

        setSyncError(
          buildApiRecoveryMessage(
            error instanceof Error ? error.message : undefined,
            "暂时无法同步当前会话。"
          )
        )
      }
    }

    void syncCompanionState()

    const timer = window.setInterval(() => {
      void syncCompanionState()
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionId, shouldSync])

  const createSessionForSelectedRecipe = async () => {
    if (!selectedRecipeId) {
      setCreateError("Please select a dish first.")
      return null
    }

    setIsCreatingSession(true)
    setCreateError("")
    setSyncError("")

    try {
      const result = await createSession(selectedRecipeId)

      if (!isMountedRef.current) {
        return null
      }

      setSessionResult(result)
      setLatestSnapshot(result.session)
      setTimers(toCompanionTimers(result.session.activeTimers))

      return result
    } catch (error) {
      if (!isMountedRef.current) {
        return null
      }

      setCreateError(
        buildApiRecoveryMessage(
          error instanceof Error ? error.message : undefined,
          "Unable to start this dish at the moment."
        )
      )

      return null
    } finally {
      if (isMountedRef.current) {
        setIsCreatingSession(false)
      }
    }
  }

  const loadSession = async (nextSessionId: string) => {
    setIsLoadingSession(true)
    setCreateError("")
    setSyncError("")

    try {
      const [sessionResponse, timersResponse] = await Promise.all([
        getSession(nextSessionId),
        listSessionTimers(nextSessionId),
      ])

      if (!isMountedRef.current) {
        return null
      }

      const nextSessionResult = {
        session: sessionResponse.session,
      }

      setSessionResult(nextSessionResult)
      setLatestSnapshot(sessionResponse.session)
      setTimers(toCompanionTimers(timersResponse.timers))

      return nextSessionResult
    } catch (error) {
      if (!isMountedRef.current) {
        return null
      }

      setSyncError(
        buildApiRecoveryMessage(
          error instanceof Error ? error.message : undefined,
          "Unable to restore this session at the moment."
        )
      )

      return null
    } finally {
      if (isMountedRef.current) {
        setIsLoadingSession(false)
      }
    }
  }

  const resetSessionState = () => {
    setCreateError("")
    setLatestSnapshot(null)
    setSessionResult(null)
    setSelectedRecipeId("")
    setSyncError("")
    setTimers([])
    void refreshRecoverySessions()
  }

  return {
    createError,
    createSessionForSelectedRecipe,
    isCreatingSession,
    isLoadingRecoverySessions,
    isLoadingRecipes,
    isLoadingSession,
    latestSnapshot,
    loadSession,
    recipes,
    recoveryError,
    recoverySessions,
    recipesError,
    refreshCompanionState,
    refreshRecoverySessions,
    resetSessionState,
    selectedRecipeId,
    sessionResult,
    setSelectedRecipeId,
    shouldSync,
    syncError,
    timers,
  }
}
