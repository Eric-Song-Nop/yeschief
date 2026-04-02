import { expect, test, type Locator, type Page } from "@playwright/test"

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

const waitForPoliteAnnouncement = async (liveRegion: Locator, text: string) => {
  await expect
    .poll(async () => (await liveRegion.textContent()) ?? "", {
      timeout: 10_000,
    })
    .toContain(text)
}

const createSessionViaApi = async (page: Page) => {
  const response = await page.request.post(`${API_BASE_URL}/sessions`, {
    data: {
      recipeId: "recipe-garlic-rice",
    },
  })

  expect(response.ok()).toBeTruthy()

  return (await response.json()) as CreateSessionResponse
}

test("recovery discovery can restore the same session after page.reload", async ({
  page,
}) => {
  test.skip(
    missingLiveKitEnv.length > 0,
    `Missing LiveKit env: ${missingLiveKitEnv.join(", ")}`
  )

  const politeLiveRegion = page.locator('.sr-only[aria-live="polite"]')
  const created = await createSessionViaApi(page)

  await page.goto("/")
  await page.reload()

  await expect(
    page.getByRole("heading", { name: "恢复已有 session" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "继续烹饪" }).first()).toBeVisible()

  const sessionResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === `/sessions/${created.session.sessionId}`
  )

  await page.getByRole("button", { name: "继续烹饪" }).first().click()

  expect((await sessionResponsePromise).ok()).toBeTruthy()
  await waitForPoliteAnnouncement(politeLiveRegion, "已恢复之前的会话")
  await expect(page.getByText(created.session.recipeTitle)).toBeVisible()
})

test.fixme("shows a 重新加入 entry after disconnect recovery exhausts retries", async ({
  page,
}) => {
  await page.goto("/")
  await page.reload()
  await expect(page.getByRole("button", { name: "重新加入" })).toBeVisible()
})
