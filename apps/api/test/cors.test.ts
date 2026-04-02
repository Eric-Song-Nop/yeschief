import { describe, expect, it } from "bun:test"
import {
  DEFAULT_CORS_ALLOWED_ORIGINS,
  resolveCorsAllowedOrigins,
} from "../src/app"

describe("resolveCorsAllowedOrigins", () => {
  it("returns compose-friendly defaults when unset", () => {
    expect(resolveCorsAllowedOrigins(undefined)).toEqual([
      ...DEFAULT_CORS_ALLOWED_ORIGINS,
    ])
  })

  it("parses comma-separated origins from env", () => {
    expect(
      resolveCorsAllowedOrigins(
        "http://localhost:8080, http://example.com , ,http://127.0.0.1:5173"
      )
    ).toEqual([
      "http://localhost:8080",
      "http://example.com",
      "http://127.0.0.1:5173",
    ])
  })
})
