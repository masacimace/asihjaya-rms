"use client";

import { ArrowRight, Bell, CheckCheck, Inbox, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  archiveNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
  type NotificationMutationResult,
} from "@/app/actions/notifications";
import { NotificationCard } from "@/components/notifications/notification-card";
import type {
  AdminNotificationDrawerData,
  AdminNotificationRow,
  NotificationDrawerFilter,
} from "@/features/notifications/contracts";
import { cn } from "@/lib/utils";

function EmptyState({ filter }: { filter: NotificationDrawerFilter }) {
  const content =
    filter === "actionable"
      ? {
          title: "Tidak ada tindakan tertunda",
          description:
            "Semua alert operasional yang membutuhkan tindak lanjut sudah selesai.",
        }
      : filter === "unread"
        ? {
            title: "Semua sudah dibaca",
            description: "Notifikasi baru akan muncul kembali di tab ini.",
          }
        : {
            title: "Belum ada notifikasi",
            description:
              "Transaksi POS dan alert operasional akan muncul di sini.",
          };

  return (
    <div className="rounded-3xl border border-dashed border-[var(--border)] bg-neutral-50 p-7 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-neutral-500 ring-1 ring-[var(--border)]">
        <Inbox className="size-6" />
      </div>
      <h3 className="mt-4 font-bold text-neutral-950">{content.title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-600">
        {content.description}
      </p>
    </div>
  );
}

export function NotificationDrawer({
  isOpen,
  onClose,
  onUnreadCountChange,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  data: AdminNotificationDrawerData;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationDrawerFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rows, setRows] = useState(data.latest);
  const [unreadCount, setUnreadCount] = useState(data.unreadCount);
  const [actionableCount, setActionableCount] = useState(data.actionableCount);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  const visibleRows = useMemo(() => {
    if (filter === "unread") {
      return rows.filter((row) => row.status === "unread");
    }
    if (filter === "actionable") {
      return rows.filter((row) => row.isActionable);
    }
    return rows;
  }, [filter, rows]);

  function setNextUnreadCount(nextCount: number) {
    const normalized = Math.max(0, nextCount);
    setUnreadCount(normalized);
    onUnreadCountChange?.(normalized);
  }

  async function executeMutation({
    optimisticUpdate,
    action,
  }: {
    optimisticUpdate: () => void;
    action: () => Promise<NotificationMutationResult>;
  }) {
    if (isMutating) return;

    const previousRows = rows;
    const previousUnreadCount = unreadCount;
    const previousActionableCount = actionableCount;
    setIsMutating(true);
    optimisticUpdate();

    try {
      const result = await action();
      if (!result.ok) throw new Error("Notification mutation rejected");
      router.refresh();
    } catch {
      setRows(previousRows);
      setUnreadCount(previousUnreadCount);
      setActionableCount(previousActionableCount);
      onUnreadCountChange?.(previousUnreadCount);
    } finally {
      setIsMutating(false);
    }
  }

  function recipientFormData(recipientId: string) {
    const formData = new FormData();
    formData.set("notificationId", recipientId);
    return formData;
  }

  function markRead(notification: AdminNotificationRow) {
    void executeMutation({
      optimisticUpdate: () => {
        setRows((current) =>
          current.map((row) =>
            row.id === notification.id
              ? { ...row, status: "read", isRead: true }
              : row,
          ),
        );
        setNextUnreadCount(unreadCount - 1);
      },
      action: () =>
        markNotificationReadAction(recipientFormData(notification.id)),
    });
  }

  function markUnread(notification: AdminNotificationRow) {
    void executeMutation({
      optimisticUpdate: () => {
        setRows((current) =>
          current.map((row) =>
            row.id === notification.id
              ? { ...row, status: "unread", isRead: false }
              : row,
          ),
        );
        setNextUnreadCount(unreadCount + 1);
      },
      action: () =>
        markNotificationUnreadAction(recipientFormData(notification.id)),
    });
  }

  function archive(notification: AdminNotificationRow) {
    void executeMutation({
      optimisticUpdate: () => {
        setRows((current) =>
          current.filter((row) => row.id !== notification.id),
        );
        if (notification.status === "unread") {
          setNextUnreadCount(unreadCount - 1);
        }
        if (notification.isActionable) {
          setActionableCount((current) => Math.max(0, current - 1));
        }
        if (expandedId === notification.id) setExpandedId(null);
      },
      action: () =>
        archiveNotificationAction(recipientFormData(notification.id)),
    });
  }

  function markAllRead() {
    if (unreadCount <= 0) return;

    void executeMutation({
      optimisticUpdate: () => {
        setRows((current) =>
          current.map((row) =>
            row.status === "unread"
              ? { ...row, status: "read", isRead: true }
              : row,
          ),
        );
        setNextUnreadCount(0);
      },
      action: markAllNotificationsReadAction,
    });
  }

  if (!isOpen) return null;

  const tabs: Array<{
    id: NotificationDrawerFilter;
    label: string;
    count?: number;
  }> = [
    { id: "all", label: "Semua", count: rows.length },
    { id: "actionable", label: "Perlu tindakan", count: actionableCount },
    { id: "unread", label: "Belum dibaca", count: unreadCount },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Tutup Notification Center"
        className="fixed inset-0 z-[70] bg-neutral-950/15 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        aria-label="Notification Center"
        className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-lg flex-col border-l border-[var(--border)] bg-white shadow-2xl shadow-black/10"
      >
        <header className="shrink-0 border-b border-[var(--border)] bg-white px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Bell className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-neutral-950">
                  Notification Center
                </h2>
                <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                  {unreadCount > 0
                    ? `${unreadCount} belum dibaca · ${actionableCount} perlu tindakan`
                    : actionableCount > 0
                      ? `${actionableCount} notifikasi perlu tindakan`
                      : "Semua notifikasi sudah ditinjau"}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-4 overflow-x-auto rounded-2xl bg-neutral-100 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition",
                  filter === tab.id
                    ? "bg-white text-neutral-950 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-900",
                )}
              >
                {tab.label}
                {typeof tab.count === "number" ? (
                  <span
                    className={cn(
                      "min-w-5 rounded-full px-1.5 py-0.5 text-[10px]",
                      filter === tab.id
                        ? "bg-neutral-100 text-neutral-700"
                        : "bg-white/70 text-neutral-500",
                    )}
                  >
                    {tab.count > 99 ? "99+" : tab.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50/60 p-4 sm:p-5">
          {visibleRows.length > 0 ? (
            <div className="space-y-3">
              {visibleRows.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  isExpanded={expandedId === notification.id}
                  isMutating={isMutating}
                  onToggle={() =>
                    setExpandedId((current) =>
                      current === notification.id ? null : notification.id,
                    )
                  }
                  onClose={onClose}
                  onMarkRead={() => markRead(notification)}
                  onMarkUnread={() => markUnread(notification)}
                  onArchive={() => archive(notification)}
                />
              ))}
            </div>
          ) : (
            <EmptyState filter={filter} />
          )}
        </div>

        <footer className="shrink-0 border-t border-[var(--border)] bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/admin/notifikasi"
              onClick={onClose}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-bold !text-white transition hover:bg-neutral-800"
            >
              Lihat semua notifikasi
              <ArrowRight className="size-4" />
            </Link>

            <button
              type="button"
              disabled={unreadCount <= 0 || isMutating}
              onClick={markAllRead}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition",
                unreadCount > 0
                  ? "border border-[var(--border)] bg-white text-neutral-800 hover:bg-neutral-50"
                  : "cursor-not-allowed border border-[var(--border)] bg-neutral-100 text-neutral-400",
              )}
            >
              <CheckCheck className="size-4" />
              {unreadCount > 0 ? "Tandai semua dibaca" : "Semua sudah dibaca"}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] leading-4 text-neutral-400">
            Arsip hanya menyembunyikan notifikasi. Audit event tetap tersimpan.
          </p>
        </footer>
      </aside>
    </>
  );
}
