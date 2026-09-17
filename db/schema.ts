import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const githubAttempts = sqliteTable(
  "github_oauth_attempts",
  {
    stateHash: text("state_hash").primaryKey(),
    viewer: text("viewer").notNull(),
    verifier: text("verifier").notNull(),
    expires: integer("expires").notNull(),
  },
  (table) => [index("github_attempts_expiry").on(table.expires)],
);

export const githubSessions = sqliteTable(
  "github_sessions",
  {
    idHash: text("id_hash").primaryKey(),
    viewer: text("viewer").notNull(),
    token: text("token").notNull(),
    login: text("login").notNull(),
    expires: integer("expires").notNull(),
  },
  (table) => [index("github_sessions_expiry").on(table.expires)],
);
