import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { presetRecipes, sessions } from "./schema"

export const DEFAULT_DATABASE_URL = "./apps/api/data/yes-chief.sqlite"

type CachedDatabase = {
  path: string
  sqlite: Database
}

let cachedDatabase: CachedDatabase | null = null

const normalizeDatabaseUrl = (databaseUrl?: string) => {
  const value = (
    databaseUrl ??
    Bun.env.DATABASE_URL ??
    DEFAULT_DATABASE_URL
  ).trim()

  return value.length > 0 ? value : DEFAULT_DATABASE_URL
}

const ensureDatabaseDirectory = (databasePath: string) => {
  const directory = dirname(databasePath)

  if (directory !== ".") {
    mkdirSync(directory, { recursive: true })
  }
}

const initializeDatabase = (sqlite: Database) => {
  sqlite.exec("PRAGMA foreign_keys = ON;")
  sqlite.exec(presetRecipes.createSql)
  sqlite.exec(sessions.createSql)
}

export const getDatabase = (databaseUrl?: string) => {
  const path = normalizeDatabaseUrl(databaseUrl)

  if (cachedDatabase?.path === path) {
    return cachedDatabase.sqlite
  }

  if (cachedDatabase) {
    cachedDatabase.sqlite.close()
    cachedDatabase = null
  }

  ensureDatabaseDirectory(path)

  const sqlite = new Database(path)

  initializeDatabase(sqlite)

  cachedDatabase = {
    path,
    sqlite,
  }

  return sqlite
}

export const resetDatabase = () => {
  if (!cachedDatabase) {
    return
  }

  cachedDatabase.sqlite.close()
  cachedDatabase = null
}
