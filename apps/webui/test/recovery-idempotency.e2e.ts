import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
} from "@playwright/test"

const API_BASE_URL = "http://127.0.0.1:3300"
const missingLiveKitEnv = (process.env.PLAYWRIGHT_MISSING_LIVEKIT_ENV ?? "")
  .split(",")
  .filter((value) => value.length > 0)

type CreateSessionResponse = {
  session: {
    recipeTitle: string
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

type DeleteSessionRoomResponse = {
  cleanup: "already_missing" | "deleted"
  roomName: string
  sessionId: string
}

type GetSessionResponse = {
  session: {
    recipeTitle: string
    sessionId: string
  }
}

const waitForPoliteAnnouncement = async (liveRegion: Locator, text: string) => {
  await expect
    .poll(async () => (await liveRegion.textContent()) ?? "", {
      timeout: 10_000,
    })
    .toContain(text)
}

const createSessionViaApi = async (request: APIRequestContext) => {
  const response = await request.post(`${API_BASE_URL}/sessions`, {
    data: {
      recipeId: "recipe-garlic-rice",
    },
  })

  expect(response.ok()).toBeTruthy()

  return (await response.json()) as CreateSessionResponse
}

test("recovery discovery can restore the same session after page.reload", async ({
  page,
  request,
}) => {
  const politeLiveRegion = page.locator('.sr-only[aria-live="polite"]')
  const created = await createSessionViaApi(request)

  await page.goto("/")
  await page.reload()

  await expect(
    page.getByRole("heading", { name: "Recent Sessions" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Continue Cooking" }).first()
  ).toBeVisible()

  const sessionResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname ===
        `/sessions/${created.session.sessionId}`
  )

  await page.getByRole("button", { name: "Continue Cooking" }).first().click()

  expect((await sessionResponsePromise).ok()).toBeTruthy()
  await waitForPoliteAnnouncement(politeLiveRegion, "Restored previous session")
  await expect(page.getByText(created.session.recipeTitle)).toBeVisible()
})

test.fixme(
  "shows a Reconnect entry after disconnect recovery exhausts retries",
  async ({ page }) => {
    await page.goto("/")
    await page.reload()
    await expect(page.getByRole("button", { name: "Reconnect" })).toBeVisible()
  }
)

test("room replacement keeps the same sessionId across reconnect and reload", async ({
  page,
  request,
}) => {
  test.skip(
    missingLiveKitEnv.length > 0,
    `Missing LiveKit env: ${missingLiveKitEnv.join(", ")}`
  )

  const politeLiveRegion = page.locator('.sr-only[aria-live="polite"]')
  const created = await createSessionViaApi(request)

  const firstConnect = await request.post(
    `${API_BASE_URL}/sessions/${created.session.sessionId}/connect`
  )

  expect(firstConnect.ok()).toBeTruthy()

  const firstPayload = (await firstConnect.json()) as ConnectSessionResponse
  const firstRoomName = firstPayload.binding.roomName

  expect(firstPayload.sessionId).toBe(created.session.sessionId)
  expect(firstPayload.binding.sessionId).toBe(created.session.sessionId)
  expect(firstRoomName.length).toBeGreaterThan(0)

  const cleanupResponse = await request.delete(
    `${API_BASE_URL}/sessions/${created.session.sessionId}/room`
  )

  expect(cleanupResponse.ok()).toBeTruthy()

  const cleanupPayload =
    (await cleanupResponse.json()) as DeleteSessionRoomResponse

  expect(cleanupPayload.sessionId).toBe(created.session.sessionId)
  expect(cleanupPayload.roomName).toBe(firstRoomName)

  const secondConnect = await request.post(
    `${API_BASE_URL}/sessions/${created.session.sessionId}/connect`
  )

  expect(secondConnect.ok()).toBeTruthy()

  const secondPayload = (await secondConnect.json()) as ConnectSessionResponse
  const secondRoomName = secondPayload.binding.roomName

  expect(secondPayload.sessionId).toBe(created.session.sessionId)
  expect(secondPayload.binding.sessionId).toBe(created.session.sessionId)
  expect(secondRoomName.length).toBeGreaterThan(0)
  expect(secondRoomName).not.toBe(firstRoomName)

  const getSessionResponse = await request.get(
    `${API_BASE_URL}/sessions/${created.session.sessionId}`
  )

  expect(getSessionResponse.ok()).toBeTruthy()
  expect(
    ((await getSessionResponse.json()) as GetSessionResponse).session.sessionId
  ).toBe(created.session.sessionId)

  await page.goto("/")
  await page.reload()

  const sessionResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname ===
        `/sessions/${created.session.sessionId}`
  )

  await page.getByRole("button", { name: "Continue Cooking" }).first().click()

  expect((await sessionResponsePromise).ok()).toBeTruthy()
  await waitForPoliteAnnouncement(politeLiveRegion, "Restored previous session")
  await expect(page.getByText(created.session.recipeTitle)).toBeVisible()
  await expect(
    page.getByText("Connection Status", { exact: true })
  ).toBeVisible()
})
