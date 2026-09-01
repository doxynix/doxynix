import { SEVERITY_LEVELS } from "@doxynix/shared";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  inet,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const rolesEnum = pgEnum("roles", ["analyst", "admin"]);
export const severityEnum = pgEnum("severity_level", SEVERITY_LEVELS);
export const channelEnum = pgEnum("notification_channel", ["telegram", "email", "webhook"]);
export const statusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);

export const users = pgTable("users", {
  createdAt: timestamp("created_at").notNull(),
  email: citext("email").unique().notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: text("name").notNull(),
  password: text("password"),
  role: rolesEnum("role").default("analyst").notNull(),
  twoFactorBackupCodes: text("two_factor_backup_codes"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"),
  updatedAt: timestamp("updated_at").notNull(),
});

export const incidents = pgTable(
  "incidents",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    findingsCount: integer("findings_count").default(0).notNull(),
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    score: integer("score").notNull(),
    severity: severityEnum("severity").notNull(),
  },
  (table) => [
    index("incidents_created_brin_idx").using("brin", table.createdAt),
    index("incidents_file_name_trgm_idx").using("gin", sql`${table.fileName} gin_trgm_ops`),
    index("incidents_severity_idx").on(table.severity),
  ],
);

export const findings = pgTable(
  "findings",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    incidentId: uuid("incident_id")
      .references(() => incidents.id, { onDelete: "cascade" })
      .notNull(),
    line: integer("line").notNull(),
    matchedText: text("matched_text").notNull(),
    ruleName: varchar("rule_name", { length: 100 }).notNull(),
    severity: severityEnum("severity").notNull(),
  },
  (table) => [index("findings_incident_id_idx").on(table.incidentId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    action: varchar("action", { length: 150 }).notNull(),
    actor: varchar("actor", { length: 100 }).notNull(),
    country: varchar("country", { length: 10 }).default("UNKNOWN").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    ipAddress: inet("ip_address").notNull(),
    requestId: varchar("request_id", { length: 100 }),
    target: varchar("target", { length: 150 }).notNull(),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("audit_logs_created_brin_idx").using("brin", table.createdAt),
    index("audit_logs_ip_gist_idx").using("gist", table.ipAddress),
    index("audit_logs_actor_idx").on(table.actor),
    index("audit_logs_action_idx").on(table.action),
  ],
);

export const rules = pgTable(
  "rules",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description").notNull(),
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    isActive: boolean("is_active").default(true).notNull(),
    name: citext("name").unique().notNull(),
    pattern: text("pattern").notNull(),
    severity: severityEnum("severity").notNull(),
  },
  (table) => [
    index("rules_active_partial_idx").on(table.id).where(sql`${table.isActive} = true`),
    index("rules_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
    index("rules_desc_trgm_idx").using("gin", sql`${table.description} gin_trgm_ops`),
    index("rules_created_at_idx").on(table.createdAt),
  ],
);

export const cronSyncState = pgTable("cron_sync_state", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  lastSyncedPosition: varchar("last_synced_position", {
    length: 255,
  }).notNull(),
  serviceName: citext("service_name").unique().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    channel: channelEnum("channel").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    errorMessage: text("error_message"),
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    incidentId: uuid("incident_id")
      .references(() => incidents.id, { onDelete: "cascade" })
      .notNull(),
    status: statusEnum("status").default("pending").notNull(),
  },
  (table) => [
    index("notifications_failed_pending_partial_idx")
      .on(table.id)
      .where(sql`${table.status} IN ('pending', 'failed')`),
    index("notifications_incident_id_idx").on(table.incidentId),
  ],
);

export const sessions = pgTable("sessions", {
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  ipAddress: text("ip_address"),
  token: text("token").notNull().unique(),
  updatedAt: timestamp("updated_at").notNull(),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  accountId: text("account_id").notNull(),
  createdAt: timestamp("created_at").notNull(),
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  idToken: text("id_token"),
  password: text("password"),
  providerId: text("provider_id").notNull(),
  refreshToken: text("refresh_token"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  updatedAt: timestamp("updated_at").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const verifications = pgTable("verifications", {
  createdAt: timestamp("created_at"),
  expiresAt: timestamp("expires_at").notNull(),
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  identifier: text("identifier").notNull(),
  updatedAt: timestamp("updated_at"),
  value: text("value").notNull(),
});

export const twoFactors = pgTable("two_factors", {
  backupCodes: text("backup_codes").notNull(),
  enabled: boolean("enabled").notNull(),
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  secret: text("secret").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const incidentsRelations = relations(incidents, ({ many }) => ({
  findings: many(findings),
  notifications: many(notifications),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  incident: one(incidents, {
    fields: [findings.incidentId],
    references: [incidents.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  incident: one(incidents, {
    fields: [notifications.incidentId],
    references: [incidents.id],
  }),
}));

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export type IncidentSelect = typeof incidents.$inferSelect;
export type IncidentInsert = typeof incidents.$inferInsert;

export type FindingSelect = typeof findings.$inferSelect;
export type FindingInsert = typeof findings.$inferInsert;

export type RuleSelect = typeof rules.$inferSelect;
export type RuleInsert = typeof rules.$inferInsert;

export type AuditLogSelect = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;

export const selectIncidentSchema = createSelectSchema(incidents);
export const insertIncidentSchema = createInsertSchema(incidents);

export const selectRuleSchema = createSelectSchema(rules);
export const insertRuleSchema = createInsertSchema(rules);

export const selectUserSchema = createSelectSchema(users);
export const insertUserSchema = createInsertSchema(users);

export const selectAuditLogSchema = createSelectSchema(auditLogs);
export const insertAuditLogSchema = createInsertSchema(auditLogs);
