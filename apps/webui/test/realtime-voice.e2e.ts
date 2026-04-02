import { expect, test, type Locator } from "@playwright/test"

const API_BASE_URL = "http://127.0.0.1:3300"
const emptyTimerStateText =
  "当前没有运行中的计时器。这是正常状态，等你用语音创建后会显示在这里。"
const missingLiveKitEnv = (process.env.PLAYWRIGHT_MISSING_LIVEKIT_ENV ?? "")
  .split(",")
  .filter((value) => value.length > 0)

type CreateSessionResponse = {
  session: {
    sessionId: string
  }
}

type ConnectSessionResponse = {
  roomName: string
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

test("voice-first companion covers create join timer lifecycle and summary", async ({
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
      name: "跟着语音 tutor 做菜",
    })
  ).toBeVisible()
  await expect(
    page.locator("header").getByText("Discovery", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("当前选择", { exact: true })).toBeVisible()
  const recipeChoices = page.getByRole("radio")
  await expect(page.getByRole("radiogroup", { name: "选择菜谱" })).toBeVisible()
  await expect(recipeChoices.first()).toBeVisible()
  await recipeChoices.first().click()
  await expect(politeLiveRegion).toHaveCount(1)
  await expect(assertiveLiveRegion).toHaveCount(1)

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/sessions"
  )

  await page
    .getByRole("button", {
      name: "开始这道菜",
    })
    .click()

  const createResponse = await createResponsePromise
  const createPayload = (await createResponse.json()) as CreateSessionResponse
  const sessionId = createPayload.session.sessionId

  expect(createResponse.ok()).toBeTruthy()
  await waitForPoliteAnnouncement(politeLiveRegion, "session 已创建")
  await expect(page.locator("header").getByText("Active", { exact: true })).toBeVisible()
  await expect(page.getByText("当前步骤", { exact: true })).toBeVisible()
  await expect(page.getByText("连接状态", { exact: true })).toBeVisible()

  const connectResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/sessions/${sessionId}/connect`
  )

  await page
    .getByRole("button", {
      name: "接通语音指导",
    })
    .click()

  const connectResponse = await connectResponsePromise
  const connectPayload =
    (await connectResponse.json()) as ConnectSessionResponse

  expect(connectResponse.ok()).toBeTruthy()
  expect(connectPayload.sessionId).toBe(sessionId)
  expect(connectPayload.roomName).toBe(sessionId)

  await waitForPoliteAnnouncement(politeLiveRegion, "正在连接语音指导")
  await expect(
    mainPanel.getByText("麦克风已开启", { exact: true }).first()
  ).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    mainPanel.getByText("浏览器音频已就绪", { exact: true }).first()
  ).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    mainPanel.getByText("已加入当前会话", { exact: true }).first()
  ).toBeVisible({
    timeout: 30_000,
  })

  const voiceActivityVisualizer = page.getByLabel("tutor 语音活动")
  await expect(voiceActivityVisualizer).toBeVisible({
    timeout: 30_000,
  })
  await expect(voiceActivityVisualizer).toHaveAttribute(
    "data-voice-activity-state",
    /disconnected|idle|speaking/u
  )

  const createTimerResponse = await request.post(
    `${API_BASE_URL}/sessions/${sessionId}/commands`,
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

  await waitForPoliteAnnouncement(politeLiveRegion, "已新建计时器")
  await expect(page.getByText("焖饭", { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  })

  const cancelTimerResponse = await request.post(
    `${API_BASE_URL}/sessions/${sessionId}/commands`,
    {
      data: {
        timerId,
        type: "cancel_timer",
      },
    }
  )

  expect(cancelTimerResponse.ok()).toBeTruthy()
  await waitForPoliteAnnouncement(politeLiveRegion, "已取消计时器")
  await expect(page.getByText(emptyTimerStateText)).toBeVisible({
    timeout: 10_000,
  })

  const endSessionResponse = await request.post(
    `${API_BASE_URL}/sessions/${sessionId}/commands`,
    {
      data: {
        type: "end_session",
      },
    }
  )

  expect(endSessionResponse.ok()).toBeTruthy()

  await expect(page.getByText("Garlic Butter Rice 已完成")).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText("完成时间", { exact: true })).toBeVisible()
  await expect(page.getByText("最终进度", { exact: true })).toBeVisible()
  await expect(page.getByText("已到点计时器", { exact: true })).toBeVisible()
  await expect(page.getByText("已取消计时器", { exact: true }).first()).toBeVisible()
})
