import { SEVERITY_LEVELS } from "@doxynix/siem-shared";
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
  fromDriver(value: unknown): string {
    return value as string;
  },
  toDriver(value: string): string {
    return value;
  },
});

export const rolesEnum = pgEnum("roles", ["analyst", "admin"]);
export const severityEnum = pgEnum("severity_level", SEVERITY_LEVELS);
export const channelEnum = pgEnum("notification_channel", ["telegram", "email", "webhook"]);
export const statusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  email: citext("email").unique().notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  password: text("password"),
  role: rolesEnum("role").default("analyst").notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorBackupCodes: text("two_factor_backup_codes"),
});

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    severity: severityEnum("severity").notNull(),
    findingsCount: integer("findings_count").default(0).notNull(),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
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
    ruleName: varchar("rule_name", { length: 100 }).notNull(),
    severity: severityEnum("severity").notNull(),
    matchedText: text("matched_text").notNull(),
    line: integer("line").notNull(),
  },
  (table) => [index("findings_incident_id_idx").on(table.incidentId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    actor: varchar("actor", { length: 100 }).notNull(),
    action: varchar("action", { length: 150 }).notNull(),
    target: varchar("target", { length: 150 }).notNull(),
    ipAddress: inet("ip_address").notNull(),
    country: varchar("country", { length: 10 }).default("UNKNOWN").notNull(),
    userAgent: text("user_agent"),
    requestId: varchar("request_id", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
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
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: citext("name").unique().notNull(),
    description: text("description").notNull(),
    severity: severityEnum("severity").notNull(),
    pattern: text("pattern").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
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
  serviceName: citext("service_name").unique().notNull(),
  lastSyncedPosition: varchar("last_synced_position", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    incidentId: uuid("incident_id")
      .references(() => incidents.id, { onDelete: "cascade" })
      .notNull(),
    channel: channelEnum("channel").notNull(),
    status: statusEnum("status").default("pending").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_failed_pending_partial_idx")
      .on(table.id)
      .where(sql`${table.status} IN ('pending', 'failed')`),
    index("notifications_incident_id_idx").on(table.incidentId),
  ],
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const twoFactors = pgTable("two_factors", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  enabled: boolean("enabled").notNull(),
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
