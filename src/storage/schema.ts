import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("Users", {
    id: integer().primaryKey({ autoIncrement: true }),
    telegramId: integer().unique().notNull()
})

export const task = sqliteTable("Tasks", {
    id: integer().primaryKey({ autoIncrement: true }),
    replyMessageId: integer().notNull(),
    notificationTime: text().notNull(),
    userId: integer().notNull().references(() => user.id)
})
