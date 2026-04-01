const databaseUrl = Bun.env.DATABASE_URL ?? "./apps/api/data/yes-chief.sqlite"

export default {
  schema: "./src/persistence/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl,
  },
}
