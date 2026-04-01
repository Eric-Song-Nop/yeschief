import { expect, test } from "@playwright/test"

const missingLiveKitEnv = (
  process.env.PLAYWRIGHT_MISSING_LIVEKIT_ENV ?? ""
)
  .split(",")
  .filter((value) => value.length > 0)

test("session create -> join voice -> observe state", async ({ page }) => {
  test.skip(
    missingLiveKitEnv.length > 0,
    `Missing LiveKit env: ${missingLiveKitEnv.join(", ")}`
  )

  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      name: "创建 cooking session 并接通实时语音 tutor",
    })
  ).toBeVisible()

  const createSessionButton = page.getByRole("button", {
    name: "Create Session",
  })

  await expect(createSessionButton).toBeEnabled()
  await createSessionButton.click()

  await expect(page.getByText("Session Snapshot")).toBeVisible()
  await expect(page.getByText(/[0-9a-f]{8}-[0-9a-f-]{27}/u)).toBeVisible()

  const joinVoiceButton = page.getByRole("button", {
    name: "Join Voice Session",
  })

  await expect(joinVoiceButton).toBeEnabled()
  await joinVoiceButton.click()

  await expect.poll(
    async () => {
      const pageText = (await page.locator("body").textContent()) ?? ""

      if (
        pageText.includes("Failed to dispatch agent for session connect") ||
        pageText.includes("LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET")
      ) {
        throw new Error(pageText)
      }

      return (
        pageText.includes("Agent ready: yes") || pageText.includes("Connected")
      )
    },
    {
      timeout: 20_000,
    }
  ).toBeTruthy()

  await expect(page.getByText("currentStep", { exact: true })).toBeVisible()
  await expect(page.getByText("Active Timers", { exact: true })).toBeVisible()
})
