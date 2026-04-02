import { expect, test, type Locator } from "@playwright/test"

const API_BASE_URL = "http://127.0.0.1:3300"
const emptyTimerStateText =
  "当前没有正在计时的项目。需要时直接对 tutor 说“帮我设一个 timer”。"
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

  const politeLiveRegion = page.locator('[aria-live="polite"]')
  const assertiveLiveRegion = page.locator('[aria-live="assertive"]')
  const companionPanel = page.locator("aside")

  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      name: "跟着语音 tutor 做菜",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("radiogroup", {
      name: "选择菜谱",
    })
  ).toBeVisible()
  await expect(
    page.getByRole("radio", {
      name: "选择菜谱 Garlic Butter Rice",
    })
  ).toHaveAttribute("aria-checked", "true")
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
    companionPanel.getByText("麦克风已开启", { exact: true })
  ).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    companionPanel.getByText("浏览器音频已就绪", { exact: true })
  ).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    companionPanel.getByText("已加入当前会话", { exact: true })
  ).toBeVisible({
    timeout: 30_000,
  })

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
  await expect(page.getByText("焖饭")).toBeVisible({
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

  await expect(page.getByText("本次做菜总结")).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText("完成菜谱")).toBeVisible()
  await expect(page.getByText("结束时间")).toBeVisible()
  await expect(page.getByText("结束于第几步")).toBeVisible()
  await expect(page.getByText("计时器结果")).toBeVisible()
})
