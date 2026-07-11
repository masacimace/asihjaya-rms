"use client";

import {
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  HardDrive,
  Inbox,
  PackageCheck,
  ReceiptText,
  ShieldAlert,
  Store,
  X,
} from "lucide-react";
import Link from "next/link";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import type {
  AdminNotificationDrawerData,
  AdminNotificationRow,
} from "@/features/notifications/contracts";
import { cn } from "@/lib/utils";

function formatDateTime(isoString: string) {
  const date = new Date(isoString);

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getNotificationTypeMeta(type: AdminNotificationRow["type"]) {
  if (type === "sales") {
    return {
      label: "Transaksi",
      icon: ReceiptText,
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (type === "hardware") {
    return {
      label: "Hardware",
      icon: HardDrive,
      className: "bg-blue-50 text-blue-700",
    };
  }

  if (type === "shift") {
    return {
      label: "Shift",
      icon: Clock3,
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (type === "cash") {
    return {
      label: "Kas",
      icon: CircleDollarSign,
      className: "bg-teal-50 text-teal-700",
    };
  }

  if (type === "inventory") {
    return {
      label: "Stok",
      icon: PackageCheck,
      className: "bg-violet-50 text-violet-700",
    };
  }

  return {
    label: "Sistem",
    icon: ShieldAlert,
    className: "bg-neutral-100 text-neutral-700",
  };
}

function getSeverityClassName(severity: AdminNotificationRow["severity"]) {
  if (severity === "critical") {
    return "border-red-200 bg-red-50/40";
  }

  if (severity === "warning") {
    return "border-amber-200 bg-amber-50/40";
  }

  if (severity === "success") {
    return "border-emerald-200 bg-emerald-50/30";
  }

  return "border-[var(--border)] bg-white";
}

function NotificationCard({
  notification,
}: {
  notification: AdminNotificationRow;
}) {
  const meta = getNotificationTypeMeta(notification.type);
  const Icon = meta.icon;

  return (
    <article
      className={cn(
        "rounded-3xl border p-4 transition",
        getSeverityClassName(notification.severity),
        notification.isRead ? "opacity-75" : "ring-1 ring-[var(--accent-soft)]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-2xl",
            meta.className,
          )}
        >
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="min-w-0 text-sm font-bold text-neutral-950">
                  {notification.title}
                </h3>
                {!notification.isRead ? (
                  <span
                    className="size-2 rounded-full bg-red-600"
                    aria-label="Belum dibaca"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                {notification.message}
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-neutral-600 ring-1 ring-[var(--border)]">
              {meta.label}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>{formatDateTime(notification.createdAtIso)}</span>
            {notification.outletCode ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-semibold text-neutral-700 ring-1 ring-[var(--border)]">
                <Store className="size-3" />
                {notification.outletCode}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {notification.actionUrl ? (
              <Link
                href={notification.actionUrl}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-bold text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                Lihat detail
                <ExternalLink className="size-3.5" />
              </Link>
            ) : null}

            {!notification.isRead ? (
              <form action={markNotificationReadAction}>
                <input
                  type="hidden"
                  name="notificationId"
                  value={notification.id}
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-neutral-900 px-3 !text-xs font-bold text-white transition hover:bg-neutral-800"
                >
                  <CheckCircle2 className="size-3.5" />
                  Tandai dibaca
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function NotificationFooterAction({ unreadCount }: { unreadCount: number }) {
  if (unreadCount <= 0) {
    return (
      <button
        type="button"
        disabled
        className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-neutral-100 px-4 text-sm font-bold text-neutral-400"
      >
        <CheckCircle2 className="size-4" />
        Semua notifikasi sudah dibaca
      </button>
    );
  }

  return (
    <form action={markAllNotificationsReadAction}>
      <button
        type="submit"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
      >
        <CheckCircle2 className="size-4" />
        Tandai semua dibaca
      </button>
    </form>
  );
}

export function NotificationDrawer({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: AdminNotificationDrawerData;
}) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-neutral-950/10 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-white transition-transform">
        <header className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Bell className="size-5" />
              </div>
              <div>
                <h2 className="font-bold text-neutral-950">Notifikasi Admin</h2>
                <p className="text-xs text-[var(--muted)]">
                  {data.unreadCount > 0
                    ? `${data.unreadCount} notifikasi belum dibaca`
                    : "Semua notifikasi sudah dibaca"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 pb-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase text-neutral-500">
              Aktivitas terbaru
            </h3>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-700">
              {data.latest.length}
            </span>
          </div>

          {data.latest.length > 0 ? (
            <div className="space-y-3">
              {data.latest.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--border)] bg-neutral-50 p-6 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-neutral-500 ring-1 ring-[var(--border)]">
                <Inbox className="size-6" />
              </div>
              <h3 className="mt-4 font-bold text-neutral-950">
                Belum ada notifikasi
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Transaksi POS dan alert operasional akan muncul di sini.
              </p>
            </div>
          )}
        </div>

        <footer className="border-t border-[var(--border)] bg-white p-4">
          <NotificationFooterAction unreadCount={data.unreadCount} />
        </footer>
      </aside>
    </>
  );
}
