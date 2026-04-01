export type SqliteTable = {
  name: string
  createSql: string
}

export const sqliteTable = (name: string, columnsSql: string): SqliteTable => ({
  name,
  createSql: `CREATE TABLE IF NOT EXISTS ${name} (${columnsSql})`,
})

export const presetRecipes = sqliteTable(
  "preset_recipes",
  `
  "id" TEXT PRIMARY KEY NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "stepsJson" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
`
)

export const sessions = sqliteTable(
  "sessions",
  `
  "id" TEXT PRIMARY KEY NOT NULL,
  "recipeId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "currentStepIndex" INTEGER NOT NULL,
  "snapshotJson" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  FOREIGN KEY ("recipeId") REFERENCES preset_recipes("id")
`
)
