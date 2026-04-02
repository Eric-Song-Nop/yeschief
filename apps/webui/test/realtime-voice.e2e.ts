import { expect, test, type Locator, type Page } from "@playwright/test"

const API_BASE_URL = "http://127.0.0.1:3300"
const emptyTimerStateText = "No active timers"
const missingLiveKitEnv = (process.env.PLAYWRIGHT_MISSING_LIVEKIT_ENV ?? "")
  .split(",")
  .filter((value) => value.length > 0)

type CreateSessionResponse = {
  session: {
    sessionId: string
  }
}

type ConnectSessionResponse = {
  binding: {
    roomName: string
    sessionId: string
  }
  sessionId: string
}

type SessionCommandResponse = {
  result: {
    timerId?: string | null
  }
}

const waitForPoliteAnnouncement = async (liveRegion: Locator, text: string) => {
  await expect
    .poll(async () => (await liveRegion.textContent()) ?? "", {
      timeout: 10_000,
    })
    .toContain(text)
}

const expectDiscoveryStage = async (page: Page) => {
  await expect(
    page.getByRole("heading", { name: "Recent Sessions" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "What would you like to cook?" })
  ).toBeVisible()
}

const createSessionFromDiscovery = async (
  page: Page,
  politeLiveRegion: Locator
) => {
  await expectDiscoveryStage(page)

  const recipeChoices = page.getByRole("radio")

  await expect(
    page.getByRole("radiogroup", { name: "Select Recipe" })
  ).toBeVisible()
  await expect(recipeChoices.first()).toBeVisible()
  await recipeChoices.first().click()

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/sessions"
  )

  await page
    .getByRole("button", {
      name: "Start Cooking",
    })
    .click()

  const createResponse = await createResponsePromise
  const createPayload = (await createResponse.json()) as CreateSessionResponse

  expect(createResponse.ok()).toBeTruthy()
  await waitForPoliteAnnouncement(politeLiveRegion, "Session created")
  await expect(
    page.getByText("In Progress", { exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByText("Connection Status", { exact: true })
  ).toBeVisible()

  return createPayload.session.sessionId
}

const joinVoiceForSession = async (
  page: Page,
  mainPanel: Locator,
  politeLiveRegion: Locator,
  sessionId: string
) => {
  const connectResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/sessions/${sessionId}/connect`
  )

  await page
    .getByRole("button", {
      name: "Connect voice guidance",
    })
    .click()

  const connectResponse = await connectResponsePromise
  const connectPayload =
    (await connectResponse.json()) as ConnectSessionResponse

  expect(connectResponse.ok()).toBeTruthy()
  expect(connectPayload.sessionId).toBe(sessionId)
  expect(connectPayload.binding.sessionId).toBe(sessionId)
  expect(connectPayload.binding.roomName.length).toBeGreaterThan(0)

  await waitForPoliteAnnouncement(
    politeLiveRegion,
    "Connecting to voice guidance"
  )
  await expect(
    mainPanel.getByText("Microphone on • Browser audio ready", {
      exact: true,
    })
  ).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    mainPanel.getByText("Joined current session", { exact: true }).first()
  ).toBeVisible({
    timeout: 30_000,
  })
}

test("voice-first companion covers create join timer lifecycle, summary, and new session start-over flows", async ({
  page,
  request,
}) => {
  test.skip(
    missingLiveKitEnv.length > 0,
    `Missing LiveKit env: ${missingLiveKitEnv.join(", ")}`
  )

  const politeLiveRegion = page.locator('.sr-only[aria-live="polite"]')
  const assertiveLiveRegion = page.locator('.sr-only[aria-live="assertive"]')
  const mainPanel = page.locator("main")

  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      name: "What would you like to cook?",
    })
  ).toBeVisible()
  await expect(politeLiveRegion).toHaveCount(1)
  await expect(assertiveLiveRegion).toHaveCount(1)

  const firstSessionId = await createSessionFromDiscovery(
    page,
    politeLiveRegion
  )
  await expect(
    page.getByText("Connection Status", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("End and return", { exact: true })).toBeVisible()

  await joinVoiceForSession(page, mainPanel, politeLiveRegion, firstSessionId)

  const voiceActivityVisualizer = page.getByLabel("Tutor Voice Activity")
  await expect(voiceActivityVisualizer).toBeVisible({
    timeout: 30_000,
  })
  await expect(voiceActivityVisualizer).toHaveAttribute(
    "data-voice-activity-state",
    /disconnected|idle|speaking/u
  )

  const activeEndSessionResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/sessions/${firstSessionId}/commands`
  )
  const activeCleanupResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === `/sessions/${firstSessionId}/room`
  )

  await page
    .getByRole("button", {
      name: "End and return",
    })
    .click()

  expect((await activeEndSessionResponsePromise).ok()).toBeTruthy()
  expect((await activeCleanupResponsePromise).ok()).toBeTruthy()
  await expectDiscoveryStage(page)

  const secondSessionId = await createSessionFromDiscovery(
    page,
    politeLiveRegion
  )

  expect(secondSessionId).not.toBe(firstSessionId)
  await joinVoiceForSession(page, mainPanel, politeLiveRegion, secondSessionId)

  const createTimerResponse = await request.post(
    `${API_BASE_URL}/sessions/${secondSessionId}/commands`,
    {
      data: {
        durationSec: 120,
        label: "焖饭",
        type: "create_timer",
      },
    }
  )
  const createTimerPayload =
    (await createTimerResponse.json()) as SessionCommandResponse
  const timerId = createTimerPayload.result.timerId

  expect(createTimerResponse.ok()).toBeTruthy()
  expect(timerId).toBeTruthy()

  await waitForPoliteAnnouncement(politeLiveRegion, "Timer created")
  await expect(page.getByText("焖饭", { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  })

  const cancelTimerResponse = await request.post(
    `${API_BASE_URL}/sessions/${secondSessionId}/commands`,
    {
      data: {
        timerId,
        type: "cancel_timer",
      },
    }
  )

  expect(cancelTimerResponse.ok()).toBeTruthy()
  await waitForPoliteAnnouncement(politeLiveRegion, "Timer cancelled")
  await expect(page.getByText(emptyTimerStateText)).toBeVisible({
    timeout: 10_000,
  })

  const endSessionResponse = await request.post(
    `${API_BASE_URL}/sessions/${secondSessionId}/commands`,
    {
      data: {
        type: "end_session",
      },
    }
  )

  expect(endSessionResponse.ok()).toBeTruthy()

  await expect(page.getByText("Garlic Butter Rice Completed")).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText("Completion Time", { exact: true })).toBeVisible()
  await expect(page.getByText("Final Progress", { exact: true })).toBeVisible()
  await expect(page.getByText("Expired Timers", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Cancelled Timers", { exact: true }).first()
  ).toBeVisible()
  await expect(page.getByText("Return", { exact: true })).toBeVisible()

  const completedCleanupResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname === `/sessions/${secondSessionId}/room`
  )

  await page
    .getByRole("button", {
      name: "Return",
    })
    .click()

  expect((await completedCleanupResponsePromise).ok()).toBeTruthy()
  await expectDiscoveryStage(page)

  const thirdSessionId = await createSessionFromDiscovery(
    page,
    politeLiveRegion
  )

  expect(thirdSessionId).not.toBe(secondSessionId)
})
