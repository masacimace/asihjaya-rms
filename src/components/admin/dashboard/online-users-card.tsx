"use client";

import {
  ChevronRight,
  CircleDollarSign,
  Clock3,
  RefreshCcw,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type {
  OnlinePresencePayload,
  OnlineUserPresence,
  PresenceActivity,
  PresenceActivityPayload,
} from "@/features/presence/contracts";

function formatMoney(value: number | null) {
  if (value === null) return null;

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getUserInitials(fullName: string) {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) return "US";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();

  return `${words[0]![0] ?? ""}${words[words.length - 1]![0] ?? ""}`.toUpperCase();
}

function getActivityMeta(kind: PresenceActivity["kind"]) {
  if (kind === "sale") {
    return {
      label: "Penjualan",
      icon: ShoppingBag,
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (kind === "buyback") {
    return {
      label: "Buyback",
      icon: RefreshCcw,
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Hold Cart",
    icon: CircleDollarSign,
    className: "bg-blue-50 text-blue-700",
  };
}

function ActivityCard({ activity }: { activity: PresenceActivity }) {
  const meta = getActivityMeta(activity.kind);
  const Icon = meta.icon;
  const amount = formatMoney(activity.totalAmount);
  const details = [
    activity.itemCount !== null ? `${activity.itemCount} item` : null,
    amount,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl bg-white p-3">
      <div
        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${meta.className}`}
      >
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xs font-semibold text-neutral-900">
            {meta.label}
          </p>
          {activity.statusLabel ? (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-medium text-neutral-600">
              {activity.statusLabel}
            </span>
          ) : null}
        </div>

        <p className="mt-1 truncate text-[11px] font-medium text-neutral-700">
          {activity.reference}
        </p>

        {details.length > 0 ? (
          <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
            {details.join(" · ")}
          </p>
        ) : null}

        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--muted)]">
          {activity.customerName ? (
            <span className="min-w-0 truncate">{activity.customerName}</span>
          ) : null}
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock3 className="size-3" />
            {formatTime(activity.occurredAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function UserSummary({
  user,
  expanded,
  onToggle,
}: {
  user: OnlineUserPresence;
  expanded: boolean;
  onToggle: () => void;
}) {
  const canExpand = user.activityCount > 0;
  const initials = getUserInitials(user.fullName);

  return (
    <button
      type="button"
      disabled={!canExpand}
      aria-expanded={canExpand ? expanded : undefined}
      onClick={onToggle}
      className={`flex w-full min-w-0 items-center gap-3 p-3 text-left transition ${
        canExpand
          ? "cursor-pointer hover:bg-[var(--surface-muted)]/60"
          : "cursor-default"
      }`}
    >
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
        {initials}
        <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-emerald-500" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-neutral-900">
            {user.fullName}
          </span>
          {user.isCurrentUser ? (
            <span className="shrink-0 text-[10px] font-medium text-[var(--accent)]">
              Anda
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
          {user.roleLabel} · {user.outletLabel}
        </span>
        <span className="mt-1 block text-[10px] text-[var(--muted)]">
          {canExpand
            ? `${user.activityCount} aktivitas 12 jam terakhir`
            : "Belum ada aktivitas"}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Online
        </span>
        {canExpand ? (
          <ChevronRight
            className={`size-4 text-neutral-300 transition-transform ${
              expanded ? "rotate-90 text-[var(--accent)]" : ""
            }`}
          />
        ) : null}
      </span>
    </button>
  );
}

export function OnlineUsersCard() {
  const [presence, setPresence] = useState<OnlinePresencePayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [activityByUser, setActivityByUser] = useState<
    Record<string, PresenceActivity[]>
  >({});
  const [loadingActivityUserId, setLoadingActivityUserId] = useState<
    string | null
  >(null);
  const [activityErrorUserId, setActivityErrorUserId] = useState<string | null>(
    null,
  );
  const expandedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function loadPresence() {
      try {
        const response = await fetch("/api/admin/presence", {
          cache: "no-store",
          credentials: "same-origin",
        });

        if (!response.ok) throw new Error("PRESENCE_REQUEST_FAILED");

        const payload = (await response.json()) as OnlinePresencePayload;
        if (disposed) return;

        setPresence(payload);
        setLoadError(false);
        setExpandedUserId((current) => {
          const next =
            current && payload.users.some((user) => user.userId === current)
              ? current
              : null;
          expandedUserIdRef.current = next;
          return next;
        });
      } catch {
        if (!disposed) setLoadError(true);
      }
    }

    function handleHeartbeat() {
      void loadPresence();

      const currentExpandedUserId = expandedUserIdRef.current;
      if (currentExpandedUserId) {
        void loadActivities(currentExpandedUserId);
      }
    }

    void loadPresence();
    window.addEventListener("asihjaya:presence-heartbeat", handleHeartbeat);

    return () => {
      disposed = true;
      window.removeEventListener(
        "asihjaya:presence-heartbeat",
        handleHeartbeat,
      );
    };
  }, []);

  async function loadActivities(userId: string) {
    setLoadingActivityUserId(userId);
    setActivityErrorUserId(null);

    try {
      const params = new URLSearchParams({ userId });
      const response = await fetch(`/api/admin/presence?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) throw new Error("PRESENCE_ACTIVITY_REQUEST_FAILED");

      const payload = (await response.json()) as PresenceActivityPayload;
      setActivityByUser((current) => ({
        ...current,
        [userId]: payload.activities,
      }));
    } catch {
      setActivityErrorUserId(userId);
    } finally {
      setLoadingActivityUserId((current) =>
        current === userId ? null : current,
      );
    }
  }

  function handleToggle(user: OnlineUserPresence) {
    if (user.activityCount <= 0) return;

    if (expandedUserId === user.userId) {
      expandedUserIdRef.current = null;
      setExpandedUserId(null);
      return;
    }

    expandedUserIdRef.current = user.userId;
    setExpandedUserId(user.userId);
    void loadActivities(user.userId);
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-neutral-950">User Online</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Aktivitas user yang sedang online. Data ini diperbarui secara
            real-time.
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {presence ? `${presence.users.length} online` : "Memuat"}
        </span>
      </div>

      {loadError && !presence ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-center text-xs text-[var(--muted)]">
          Status user online sementara tidak tersedia.
        </div>
      ) : presence && presence.users.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-center text-xs text-[var(--muted)]">
          Belum ada user yang terdeteksi online.
        </div>
      ) : presence ? (
        <div className="scrollbar-clean mt-4 max-h-[560px] space-y-3 overflow-y-auto overscroll-contain pr-1">
          {presence.users.map((user) => {
            const expanded = expandedUserId === user.userId;
            const activities = activityByUser[user.userId] ?? [];
            const loading = loadingActivityUserId === user.userId;
            const activityError = activityErrorUserId === user.userId;

            return (
              <div
                key={user.userId}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/70"
              >
                <UserSummary
                  user={user}
                  expanded={expanded}
                  onToggle={() => handleToggle(user)}
                />

                {expanded ? (
                  <div className="border-t border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3 text-[10px] text-[var(--muted)]">
                      <span>Aktivitas terbaru</span>
                      <span>Maks. 10 terbaru</span>
                    </div>

                    {loading ? (
                      <div className="rounded-xl bg-white p-4 text-center text-xs text-[var(--muted)]">
                        Memuat aktivitas...
                      </div>
                    ) : activityError ? (
                      <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-4 text-center text-xs text-[var(--muted)]">
                        Aktivitas sementara tidak dapat dimuat.
                      </div>
                    ) : activities.length > 0 ? (
                      <div className="scrollbar-clean max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
                        {activities.map((activity) => (
                          <ActivityCard key={activity.id} activity={activity} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[var(--border)] bg-white p-4 text-center text-xs text-[var(--muted)]">
                        Belum ada aktivitas dalam 12 jam terakhir.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
            />
          ))}
        </div>
      )}
    </section>
  );
}
