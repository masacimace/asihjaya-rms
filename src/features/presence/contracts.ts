export type PresenceActivityKind = "sale" | "buyback" | "hold_cart";

export type OnlineUserPresence = {
  userId: string;
  fullName: string;
  roleLabel: string;
  outletLabel: string;
  sessionStartedAt: string;
  lastSeenAt: string;
  activityCount: number;
  isCurrentUser: boolean;
};

export type PresenceActivity = {
  id: string;
  kind: PresenceActivityKind;
  reference: string;
  customerName: string | null;
  itemCount: number | null;
  totalAmount: number | null;
  statusLabel: string | null;
  occurredAt: string;
};

export type OnlinePresencePayload = {
  onlineWindowSeconds: number;
  historyWindowHours: number;
  users: OnlineUserPresence[];
};

export type PresenceActivityPayload = {
  userId: string;
  sessionStartedAt: string;
  activities: PresenceActivity[];
};
