import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  hardwareAgents,
  organizations,
  outlets,
  registers,
  users,
} from "./index";

export const hardwareAgentEnrollments = pgTable(
  "hardware_agent_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    registerId: uuid("register_id")
      .notNull()
      .references(() => registers.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 24 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    claimedByInstanceId: varchar("claimed_by_instance_id", { length: 120 }),
    claimedIpAddress: varchar("claimed_ip_address", { length: 64 }),
    claimedUserAgent: text("claimed_user_agent"),
    agentId: uuid("agent_id").references(() => hardwareAgents.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("hardware_agent_enrollments_code_hash_uq").on(table.codeHash),
    uniqueIndex("hardware_agent_enrollments_one_pending_per_register_uq")
      .on(table.registerId)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex("hardware_agent_enrollments_agent_uq")
      .on(table.agentId)
      .where(sql`${table.agentId} is not null`),
    index("hardware_agent_enrollments_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("hardware_agent_enrollments_register_status_idx").on(
      table.registerId,
      table.status,
      table.createdAt,
    ),
    check(
      "hardware_agent_enrollments_code_hash_ck",
      sql`${table.codeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "hardware_agent_enrollments_status_ck",
      sql`${table.status} in ('pending', 'claimed', 'completed', 'expired', 'revoked')`,
    ),
    check(
      "hardware_agent_enrollments_expiry_ck",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "hardware_agent_enrollments_state_ck",
      sql`(
        ${table.status} = 'pending'
        and ${table.claimedAt} is null
        and ${table.completedAt} is null
        and ${table.revokedAt} is null
        and ${table.claimedByInstanceId} is null
        and ${table.agentId} is null
      ) or (
        ${table.status} = 'claimed'
        and ${table.claimedAt} is not null
        and ${table.completedAt} is null
        and ${table.revokedAt} is null
        and ${table.claimedByInstanceId} is not null
        and ${table.agentId} is not null
      ) or (
        ${table.status} = 'completed'
        and ${table.claimedAt} is not null
        and ${table.completedAt} is not null
        and ${table.revokedAt} is null
        and ${table.claimedByInstanceId} is not null
        and ${table.agentId} is not null
      ) or (
        ${table.status} = 'expired'
        and ${table.claimedAt} is null
        and ${table.completedAt} is null
        and ${table.revokedAt} is null
        and ${table.claimedByInstanceId} is null
        and ${table.agentId} is null
      ) or (
        ${table.status} = 'revoked'
        and ${table.claimedAt} is null
        and ${table.completedAt} is null
        and ${table.revokedAt} is not null
        and ${table.claimedByInstanceId} is null
        and ${table.agentId} is null
      )`,
    ),
  ],
);

export type HardwareAgentEnrollment =
  typeof hardwareAgentEnrollments.$inferSelect;
