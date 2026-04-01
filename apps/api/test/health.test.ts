import { describe, expect, it } from "bun:test"
import { buildApp } from "../src/app"

describe("health route", () => {
  it("returns ok true", async () => {
    const app = buildApp()
    const response = await app.handle(new Request("http://localhost/health"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
