import { and, asc, desc, eq, gt, gte, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLogs,
  outlets,
  roles,
  userOutlets,
  userRoles,
  users,
  userSessions,
} from "@/db/schema";
import type { AuthContext } from "@/lib/auth/session";
import type {
  OnlinePresencePayload,
  OnlineUserPresence,
  PresenceActivity,
  PresenceActivityKind,
  PresenceActivityPayload,
} from "./contracts";

export const PRESENCE_HEARTBEAT_INTERVAL_MS = 60_000;
export const PRESENCE_ONLINE_WINDOW_MS = 2 * 60_000;
export const PRESENCE_HISTORY_WINDOW_MS = 12 * 60 * 60_000;
export const PRESENCE_ACTIVITY_LIMIT = 10;

const PRESENCE_ACTIVITY_ACTIONS = [
  "sale.completed",
  "buyback.completed",
  "pos.held_cart.create",
];

type OnlineSessionState = {
  userId: string;
  fullName: string;
  sessionStartedAt: Date;
  lastSeenAt: Date;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getActivityKind(action: string): PresenceActivityKind | null {
  if (action === "sale.completed") return "sale";
  if (action === "buyback.completed") return "buyback";
  if (action === "pos.held_cart.create") return "hold_cart";
  return null;
}

function getActivityReference(
  kind: PresenceActivityKind,
  data: Record<string, unknown>,
) {
  if (kind === "sale") return readString(data.invoiceNumber) ?? "Transaksi POS";
  if (kind === "buyback") return readString(data.buybackNumber) ?? "Buyback";
  return readString(data.holdNumber) ?? "Hold Cart";
}

function getActivityStatusLabel(kind: PresenceActivityKind) {
  if (kind === "hold_cart") return "Ditahan";
  return "Selesai";
}

async function getOnlineSessionStates(
  auth: AuthContext,
  requestedUserId?: string,
): Promise<Map<string, OnlineSessionState>> {
  const now = new Date();
  const onlineCutoff = new Date(now.getTime() - PRESENCE_ONLINE_WINDOW_MS);
  const historyFloor = new Date(now.getTime() - PRESENCE_HISTORY_WINDOW_MS);

  const baseCondition = and(
    eq(users.organizationId, auth.organization.id),
    eq(users.status, "active"),
    isNull(userSessions.revokedAt),
    gt(userSessions.expiresAt, now),
    gte(userSessions.lastSeenAt, onlineCutoff),
  );

  const rows = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      sessionCreatedAt: userSessions.createdAt,
      lastSeenAt: userSessions.lastSeenAt,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      requestedUserId
        ? and(baseCondition, eq(users.id, requestedUserId))
        : baseCondition,
    )
    .orderBy(desc(userSessions.lastSeenAt));

  const states = new Map<string, OnlineSessionState>();

  for (const row of rows) {
    const existing = states.get(row.userId);
    const sessionStartedAt =
      row.sessionCreatedAt < historyFloor ? historyFloor : row.sessionCreatedAt;

    if (!existing) {
      states.set(row.userId, {
        userId: row.userId,
        fullName: row.fullName,
        sessionStartedAt,
        lastSeenAt: row.lastSeenAt,
      });
      continue;
    }

    if (sessionStartedAt < existing.sessionStartedAt) {
      existing.sessionStartedAt = sessionStartedAt;
    }

    if (row.lastSeenAt > existing.lastSeenAt) {
      existing.lastSeenAt = row.lastSeenAt;
    }
  }

  return states;
}

function createRoleLabels(
  userIds: string[],
  rows: Array<{ userId: string; roleName: string }>,
) {
  const labels = new Map<string, string>();

  for (const userId of userIds) {
    const names = rows
      .filter((row) => row.userId === userId)
      .map((row) => row.roleName);

    labels.set(
      userId,
      names.length === 0
        ? "Pengguna"
        : names.length === 1
          ? (names[0] ?? "Pengguna")
          : `${names[0] ?? "Pengguna"} +${names.length - 1}`,
    );
  }

  return labels;
}

function createOutletLabels(
  userIds: string[],
  rows: Array<{ userId: string; outletName: string; isPrimary: boolean }>,
) {
  const labels = new Map<string, string>();

  for (const userId of userIds) {
    const assigned = rows.filter((row) => row.userId === userId);
    const primary = assigned.find((row) => row.isPrimary) ?? assigned[0];

    if (!primary) {
      labels.set(userId, "Tanpa outlet");
    } else if (assigned.length === 1) {
      labels.set(userId, primary.outletName);
    } else {
      labels.set(userId, `${primary.outletName} +${assigned.length - 1}`);
    }
  }

  return labels;
}

function getPresenceHistoryFloor() {
  return new Date(Date.now() - PRESENCE_HISTORY_WINDOW_MS);
}

export async function getOnlinePresence(
  auth: AuthContext,
): Promise<OnlinePresencePayload> {
  const sessionStates = await getOnlineSessionStates(auth);
  const userIds = Array.from(sessionStates.keys());

  if (userIds.length === 0) {
    return {
      onlineWindowSeconds: PRESENCE_ONLINE_WINDOW_MS / 1000,
      historyWindowHours: PRESENCE_HISTORY_WINDOW_MS / (60 * 60_000),
      users: [],
    };
  }

  const historyFloor = getPresenceHistoryFloor();
  const [roleRows, outletRows, activityRows] = await Promise.all([
    db
      .select({
        userId: userRoles.userId,
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          inArray(userRoles.userId, userIds),
          eq(roles.organizationId, auth.organization.id),
          eq(roles.isActive, true),
        ),
      )
      .orderBy(asc(roles.name)),
    db
      .select({
        userId: userOutlets.userId,
        outletName: outlets.name,
        isPrimary: userOutlets.isPrimary,
      })
      .from(userOutlets)
      .innerJoin(outlets, eq(userOutlets.outletId, outlets.id))
      .where(
        and(
          inArray(userOutlets.userId, userIds),
          eq(outlets.organizationId, auth.organization.id),
          eq(outlets.isActive, true),
        ),
      )
      .orderBy(desc(userOutlets.isPrimary), asc(outlets.name)),
    db
      .select({
        actorUserId: auditLogs.actorUserId,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.organizationId, auth.organization.id),
          inArray(auditLogs.actorUserId, userIds),
          inArray(auditLogs.action, PRESENCE_ACTIVITY_ACTIONS),
          gte(auditLogs.createdAt, historyFloor),
        ),
      ),
  ]);

  const roleLabels = createRoleLabels(userIds, roleRows);
  const outletLabels = createOutletLabels(userIds, outletRows);
  const activityCounts = new Map<string, number>();

  for (const row of activityRows) {
    if (!row.actorUserId) continue;

    activityCounts.set(
      row.actorUserId,
      (activityCounts.get(row.actorUserId) ?? 0) + 1,
    );
  }

  const presenceUsers: OnlineUserPresence[] = Array.from(
    sessionStates.values(),
  )
    .map((state) => ({
      userId: state.userId,
      fullName: state.fullName,
      roleLabel: roleLabels.get(state.userId) ?? "Pengguna",
      outletLabel: outletLabels.get(state.userId) ?? "Tanpa outlet",
      sessionStartedAt: historyFloor.toISOString(),
      lastSeenAt: state.lastSeenAt.toISOString(),
      activityCount: activityCounts.get(state.userId) ?? 0,
      isCurrentUser: state.userId === auth.user.id,
    }))
    .sort((left, right) => {
      if (left.isCurrentUser !== right.isCurrentUser) {
        return left.isCurrentUser ? -1 : 1;
      }

      return left.fullName.localeCompare(right.fullName, "id", {
        sensitivity: "base",
      });
    });

  return {
    onlineWindowSeconds: PRESENCE_ONLINE_WINDOW_MS / 1000,
    historyWindowHours: PRESENCE_HISTORY_WINDOW_MS / (60 * 60_000),
    users: presenceUsers,
  };
}

export async function getPresenceActivities(
  auth: AuthContext,
  userId: string,
): Promise<PresenceActivityPayload | null> {
  const sessionStates = await getOnlineSessionStates(auth, userId);
  const sessionState = sessionStates.get(userId);

  if (!sessionState) return null;

  const historyFloor = getPresenceHistoryFloor();

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      afterData: auditLogs.afterData,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, auth.organization.id),
        eq(auditLogs.actorUserId, userId),
        inArray(auditLogs.action, PRESENCE_ACTIVITY_ACTIONS),
        gte(auditLogs.createdAt, historyFloor),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(PRESENCE_ACTIVITY_LIMIT);

  const activities: PresenceActivity[] = rows.flatMap((row) => {
    const kind = getActivityKind(row.action);
    if (!kind) return [];

    const data = readRecord(row.afterData);
    const itemCount =
      readNumber(data.itemCount) ?? readNumber(data.pendingProcessingCount);

    return [
      {
        id: row.id,
        kind,
        reference: getActivityReference(kind, data),
        customerName: readString(data.customerName),
        itemCount,
        totalAmount: readNumber(data.totalAmount),
        statusLabel: getActivityStatusLabel(kind),
        occurredAt: row.createdAt.toISOString(),
      },
    ];
  });

  return {
    userId,
    sessionStartedAt: historyFloor.toISOString(),
    activities,
  };
}
