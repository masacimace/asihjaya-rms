"use client";

import {
  Archive,
  CheckCheck,
  CheckSquare2,
  Inbox,
  Mail,
  MailOpen,
  Square,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  archiveNotificationsAction,
  markNotificationsReadAction,
  markNotificationsUnreadAction,
  type NotificationMutationResult,
} from "@/app/actions/notifications";
import { NotificationCard } from "@/components/notifications/notification-card";
import type { AdminNotificationRow } from "@/features/notifications/contracts";
import { cn } from "@/lib/utils";

type MutationKind = "read" | "unread" | "archive";

function createRecipientFormData(recipientIds: string[]) {
  const formData = new FormData();
  for (const recipientId of recipientIds) {
    formData.append("notificationIds", recipientId);
  }
  return formData;
}

export function NotificationCenterPage({
  initialRows,
}: {
  initialRows: AdminNotificationRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const allSelected =
    rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds],
  );
  const canBulkMarkRead = selectedRows.some((row) => row.status === "unread");
  const canBulkMarkUnread = selectedRows.some(
    (row) =>
      row.resolvedAtIso == null &&
      (row.status === "read" || row.status === "acknowledged"),
  );
  const canBulkArchive = selectedRows.some((row) => row.status !== "archived");

  function toggleSelection(recipientId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recipientId)) next.delete(recipientId);
      else next.add(recipientId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(rows.map((notification) => notification.id)),
    );
  }

  async function runMutation({
    kind,
    recipientIds,
    action,
  }: {
    kind: MutationKind;
    recipientIds: string[];
    action: (formData: FormData) => Promise<NotificationMutationResult>;
  }) {
    if (isMutating || recipientIds.length === 0) return;

    const previousRows = rows;
    const previousSelectedIds = selectedIds;
    setIsMutating(true);
    setFeedback(null);

    if (kind === "archive") {
      setRows((current) =>
        current.filter((row) => !recipientIds.includes(row.id)),
      );
      if (expandedId && recipientIds.includes(expandedId)) setExpandedId(null);
    } else {
      setRows((current) =>
        current.map((row) => {
          if (!recipientIds.includes(row.id)) return row;
          if (kind === "read" && row.status === "unread") {
            return { ...row, status: "read", isRead: true };
          }
          if (
            kind === "unread" &&
            row.resolvedAtIso == null &&
            (row.status === "read" || row.status === "acknowledged")
          ) {
            return { ...row, status: "unread", isRead: false };
          }
          return row;
        }),
      );
    }
    setSelectedIds(new Set());

    try {
      const result = await action(createRecipientFormData(recipientIds));
      if (!result.ok) throw new Error("Notification mutation rejected");
      setFeedback(
        result.affectedCount > 0
          ? `${result.affectedCount} notifikasi berhasil diperbarui.`
          : "Tidak ada notifikasi yang memenuhi aksi tersebut.",
      );
      router.refresh();
    } catch {
      setRows(previousRows);
      setSelectedIds(previousSelectedIds);
      setFeedback("Perubahan gagal disimpan. Silakan coba lagi.");
    } finally {
      setIsMutating(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-10 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-500">
          <Inbox className="size-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-neutral-950">
          Tidak ada notifikasi ditemukan
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-600">
          Ubah filter atau periode pencarian untuk melihat event operasional lain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-20 rounded-2xl border border-[var(--border)] bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
          >
            {allSelected ? (
              <CheckSquare2 className="size-4 text-[var(--accent)]" />
            ) : (
              <Square className="size-4" />
            )}
            {allSelected ? "Batalkan semua" : "Pilih halaman ini"}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-neutral-500">
              {selectedIds.size} dipilih
            </span>
            <button
              type="button"
              disabled={!canBulkMarkRead || isMutating}
              onClick={() =>
                void runMutation({
                  kind: "read",
                  recipientIds: Array.from(selectedIds),
                  action: markNotificationsReadAction,
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MailOpen className="size-4" />
              Tandai dibaca
            </button>
            <button
              type="button"
              disabled={!canBulkMarkUnread || isMutating}
              onClick={() =>
                void runMutation({
                  kind: "unread",
                  recipientIds: Array.from(selectedIds),
                  action: markNotificationsUnreadAction,
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Mail className="size-4" />
              Belum dibaca
            </button>
            <button
              type="button"
              disabled={!canBulkArchive || isMutating}
              onClick={() =>
                void runMutation({
                  kind: "archive",
                  recipientIds: Array.from(selectedIds),
                  action: archiveNotificationsAction,
                })
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-3 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <Archive className="size-4" />
              Arsipkan
            </button>
          </div>
        </div>

        {feedback ? (
          <p className="mt-2 border-t border-[var(--border)] pt-2 text-xs font-medium text-neutral-600">
            {feedback}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {rows.map((notification) => {
          const selected = selectedIds.has(notification.id);

          return (
            <div
              key={notification.id}
              className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-2"
            >
              <button
                type="button"
                aria-label={
                  selected
                    ? `Batalkan pilihan ${notification.title}`
                    : `Pilih ${notification.title}`
                }
                aria-pressed={selected}
                onClick={() => toggleSelection(notification.id)}
                className={cn(
                  "mt-4 grid size-9 place-items-center rounded-xl border transition",
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-white text-neutral-400 hover:text-neutral-700",
                )}
              >
                {selected ? (
                  <CheckSquare2 className="size-4" />
                ) : (
                  <Square className="size-4" />
                )}
              </button>

              <NotificationCard
                notification={notification}
                isExpanded={expandedId === notification.id}
                isMutating={isMutating}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === notification.id ? null : notification.id,
                  )
                }
                onClose={() => undefined}
                onMarkRead={() =>
                  void runMutation({
                    kind: "read",
                    recipientIds: [notification.id],
                    action: markNotificationsReadAction,
                  })
                }
                onMarkUnread={() =>
                  void runMutation({
                    kind: "unread",
                    recipientIds: [notification.id],
                    action: markNotificationsUnreadAction,
                  })
                }
                onArchive={
                  notification.status === "archived"
                    ? undefined
                    : () =>
                        void runMutation({
                          kind: "archive",
                          recipientIds: [notification.id],
                          action: archiveNotificationsAction,
                        })
                }
              />
            </div>
          );
        })}
      </div>

      {isMutating ? (
        <div className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-bold text-white">
          <CheckCheck className="size-3.5 animate-pulse" />
          Menyimpan perubahan…
        </div>
      ) : null}
    </div>
  );
}
