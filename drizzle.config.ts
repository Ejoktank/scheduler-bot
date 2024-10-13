import { defineConfig } from "drizzle-kit";
import { database } from './src/.env.json'

export default defineConfig({
  out: "./migrations",
  dialect: 'sqlite',
  schema: './src/storage/schema.ts',
  dbCredentials: {
    url: database
  }
})
