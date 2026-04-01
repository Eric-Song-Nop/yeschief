import { rmSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { resetDatabase } from "../src/persistence/db"

export const withTestDatabase = async <T>(
  callback: (databaseUrl: string) => Promise<T>
) => {
  const previousDatabaseUrl = Bun.env.DATABASE_URL
  const tempDir = mkdtempSync(join(tmpdir(), "yes-chief-api-"))
  const databaseUrl = join(tempDir, "test.sqlite")

  Bun.env.DATABASE_URL = databaseUrl
  resetDatabase()

  try {
    return await callback(databaseUrl)
  } finally {
    resetDatabase()

    if (previousDatabaseUrl === undefined) {
      delete Bun.env.DATABASE_URL
    } else {
      Bun.env.DATABASE_URL = previousDatabaseUrl
    }

    rmSync(tempDir, {
      force: true,
      recursive: true,
    })
  }
}
