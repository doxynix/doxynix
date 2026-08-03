import { sql } from "drizzle-orm";
import {
  boolean,
  inet,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const rolesEnum = pgEnum("roles", ["analyst", "admin"]);
export const severityEnum = pgEnum("severity_level", ["low", "medium", "high", "critical"]);
export const channelEnum = pgEnum("notification_channel", ["telegram", "email", "webhook"]);
export const statusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: rolesEnum("role").default("analyst").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  severity: severityEnum("severity").notNull(),
  findingsCount: integer("findings_count").default(0).notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  incidentId: uuid("incident_id")
    .references(() => incidents.id, { onDelete: "cascade" })
    .notNull(),
  ruleName: varchar("rule_name", { length: 100 }).notNull(),
  severity: severityEnum("severity").notNull(),
  matchedText: text("matched_text").notNull(),
  line: integer("line").notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  actor: varchar("actor", { length: 100 }).notNull(),
  action: varchar("action", { length: 150 }).notNull(),
  target: varchar("target", { length: 150 }).notNull(),
  ipAddress: inet("ip_address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: varchar("name", { length: 100 }).unique().notNull(),
  description: text("description").notNull(),
  severity: severityEnum("severity").notNull(),
  pattern: text("pattern").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cronSyncState = pgTable("cron_sync_state", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  serviceName: varchar("service_name", { length: 100 }).unique().notNull(),
  lastSyncedPosition: varchar("last_synced_position", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  incidentId: uuid("incident_id")
    .references(() => incidents.id, { onDelete: "cascade" })
    .notNull(),
  channel: channelEnum("channel").notNull(),
  status: statusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
