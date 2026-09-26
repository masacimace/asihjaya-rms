import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  MessageSquareText,
  Send,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import {
  saveTelegramDestinationAction,
  sendTelegramTestMessageAction,
} from "@/app/actions/telegram-settings";
import { TelegramDeliveryHistoryCard } from "@/components/admin/telegram/telegram-delivery-history-card";
import { getTelegramAdminOverview } from "@/features/telegram/admin-queries";
import { requirePermission } from "@/lib/auth/session";
import { getTelegramAdminBotStatus } from "@/server/integrations/telegram/telegram-admin-service";
import { getTelegramRuntimeOutboxConfig } from "@/server/integrations/telegram/telegram-runtime-config";

export const metadata = { title: "Integrasi Telegram" };

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";
const labelClassName = "mb-1.5 block text-xs font-semibold text-neutral-700";

const reportLabels = {
  opening: "Opening",
  closing_daily: "Closing / Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  shift_reopened: "Shift Reopened",
  test: "Test",
} as const;

const statusLabels = {
  pending: "Pending",
  processing: "Processing",
  retry: "Retry",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

function formatDateTime(value: Date | null, timezone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusClassName(status: keyof typeof statusLabels) {
  if (status === "sent")
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "failed") return "bg-red-50 text-red-700 ring-red-100";
  if (status === "retry") return "bg-amber-50 text-amber-800 ring-amber-100";
  if (status === "processing") return "bg-blue-50 text-blue-700 ring-blue-100";
  return "bg-neutral-100 text-neutral-700 ring-neutral-200";
}

function buildHistoryPageHref(page: number) {
  return `/admin/pengaturan/integrasi/telegram?historyPage=${page}#delivery-history`;
}

export default async function TelegramIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    message?: string;
    historyPage?: string;
  }>;
}) {
  const auth = await requirePermission("settings.manage");
  const params = await searchParams;
  const parsedHistoryPage = Number(params.historyPage);
  const historyPage =
    Number.isSafeInteger(parsedHistoryPage) && parsedHistoryPage > 0
      ? parsedHistoryPage
      : 1;

  const [overview, botStatus] = await Promise.all([
    getTelegramAdminOverview(auth.organization.id, { historyPage }),
    getTelegramAdminBotStatus(),
  ]);
  const runtime = getTelegramRuntimeOutboxConfig();
  const message = params.message?.slice(0, 240) ?? null;
  const messageType = params.type === "error" ? "error" : "success";
  const pendingBacklog =
    (overview.statusCounts.pending ?? 0) + (overview.statusCounts.retry ?? 0);
  const historyQueueCount =
    pendingBacklog + (overview.statusCounts.processing ?? 0);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link
          href="/admin/pengaturan"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Pengaturan
        </Link>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <Send className="size-3.5" />
              Outbound-only Telegram
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-neutral-950 sm:text-3xl">
              Telegram Reporting
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Mapping private group per outlet, report schedule, test message,
              dan delivery audit. Bot token tetap hanya berada di environment
              server dan tidak pernah ditampilkan di browser.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="flex items-center gap-2 font-semibold text-neutral-950">
              <ShieldCheck className="size-4 text-emerald-600" />
              Permission: settings.manage
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5">
              POS sales tidak memiliki akses ke halaman ini. Telegram commands,
              webhook, dan input dari Telegram tetap non-scope.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div
          className={
            messageType === "error"
              ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          }
        >
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-neutral-100 text-neutral-700">
              <Settings2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Global integration
              </p>
              <p className="font-semibold text-neutral-950">
                {runtime.enabled ? "Enabled" : "Disabled"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            Flag global berasal dari environment server. Test message admin
            tetap dapat digunakan saat flag OFF untuk rollout aman.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Bot className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Bot status
              </p>
              <p className="font-semibold text-neutral-950">
                {botStatus.username ?? botStatus.state.replaceAll("_", " ")}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            {botStatus.message}
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <History className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                Delivery queue
              </p>
              <p className="font-semibold text-neutral-950">
                {pendingBacklog} pending / retry
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            Failed: {overview.statusCounts.failed ?? 0} · Sent:{" "}
            {overview.statusCounts.sent ?? 0}
          </p>
        </article>
      </section>

      <section className="space-y-4">
        {overview.destinations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">
            Belum ada outlet aktif yang dapat dikonfigurasi.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {overview.destinations.map((destination) => (
              <article
                key={destination.outletId}
                className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--muted)]">
                      {destination.outletCode}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-neutral-950">
                      {destination.outletName}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${destination.isActive && destination.id ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-neutral-100 text-neutral-600 ring-neutral-200"}`}
                  >
                    {destination.id
                      ? destination.isActive
                        ? "Aktif"
                        : "Nonaktif"
                      : "Belum disimpan"}
                  </span>
                </div>

                <form
                  action={saveTelegramDestinationAction}
                  className="mt-5 space-y-4"
                >
                  {destination.id ? (
                    <input
                      type="hidden"
                      name="destinationId"
                      value={destination.id}
                    />
                  ) : null}
                  <input
                    type="hidden"
                    name="outletId"
                    value={destination.outletId}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className={labelClassName}>Nama destination</span>
                      <input
                        name="name"
                        required
                        maxLength={160}
                        defaultValue={destination.name}
                        className={inputClassName}
                      />
                    </label>
                    <label>
                      <span className={labelClassName}>
                        Private group Chat ID
                      </span>
                      <input
                        name="chatId"
                        required
                        maxLength={32}
                        defaultValue={destination.chatId}
                        placeholder="-1001234567890"
                        className={inputClassName}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className={labelClassName}>Timezone report</span>
                    <input
                      name="timezone"
                      required
                      maxLength={64}
                      defaultValue={
                        destination.timezone || auth.organization.timezone
                      }
                      className={inputClassName}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className={labelClassName}>
                        Laporan harian paling awal
                      </span>
                      <input
                        type="time"
                        name="dailyReportNotBefore"
                        required
                        defaultValue={destination.dailyReportNotBefore}
                        className={inputClassName}
                      />
                      <span className="mt-1.5 block text-xs text-[var(--muted)]">
                        Closing sebelum jam ini ditahan agar salah closing tidak
                        langsung terkirim.
                      </span>
                    </label>
                    <label>
                      <span className={labelClassName}>
                        Grace period setelah closing
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          name="dailyReportGraceMinutes"
                          min={0}
                          max={120}
                          step={1}
                          required
                          defaultValue={destination.dailyReportGraceMinutes}
                          className={inputClassName}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[var(--muted)]">
                          menit
                        </span>
                      </div>
                      <span className="mt-1.5 block text-xs text-[var(--muted)]">
                        Memberi waktu untuk reopen sebelum report final dikirim.
                      </span>
                    </label>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      [
                        "openingEnabled",
                        "Opening shift",
                        destination.openingEnabled,
                      ],
                      [
                        "closingDailyEnabled",
                        "Closing + daily",
                        destination.closingDailyEnabled,
                      ],
                      [
                        "weeklyEnabled",
                        "Weekly Senin–Minggu",
                        destination.weeklyEnabled,
                      ],
                      [
                        "monthlyEnabled",
                        "Monthly kalender",
                        destination.monthlyEnabled,
                      ],
                    ].map(([name, label, checked]) => (
                      <label
                        key={String(name)}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 text-sm font-medium text-neutral-800"
                      >
                        <input
                          type="checkbox"
                          name={String(name)}
                          defaultChecked={Boolean(checked)}
                          className="size-4 accent-[var(--accent)]"
                        />
                        {String(label)}
                      </label>
                    ))}
                  </div>

                  <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm font-medium text-neutral-800">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={destination.isActive}
                      className="size-4 accent-[var(--accent)]"
                    />
                    Destination aktif
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
                    >
                      Simpan konfigurasi
                    </button>
                  </div>
                </form>

                {destination.id ? (
                  <form action={sendTelegramTestMessageAction} className="mt-3">
                    <input
                      type="hidden"
                      name="destinationId"
                      value={destination.id}
                    />
                    <button
                      type="submit"
                      disabled={!destination.isActive}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MessageSquareText className="size-4" />
                      Kirim test message
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Delivery history */}
      <TelegramDeliveryHistoryCard
        totalCount={overview.deliveryPagination.totalRows}
        queueCount={historyQueueCount}
        sentCount={overview.statusCounts.sent ?? 0}
        failedCount={overview.statusCounts.failed ?? 0}
        timezone={auth.organization.timezone}
        pageSize={overview.deliveryPagination.pageSize}
      >
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-neutral-950">
                Riwayat pengiriman
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Menampilkan {overview.deliveryPagination.from}–
                {overview.deliveryPagination.to} dari{" "}
                {overview.deliveryPagination.totalRows} delivery.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-600">
              <Clock3 className="size-3.5" />
              Halaman {overview.deliveryPagination.page} /{" "}
              {overview.deliveryPagination.totalPages}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-neutral-50/90 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Dibuat</th>
                    <th className="px-4 py-3 font-semibold">Outlet</th>
                    <th className="px-4 py-3 font-semibold">Report</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Attempt</th>
                    <th className="px-4 py-3 font-semibold">Terkirim</th>
                    <th className="px-4 py-3 font-semibold">Telegram ID</th>
                    <th className="px-4 py-3 font-semibold">Error</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--border)] bg-white">
                  {overview.deliveries.map((delivery) => (
                    <tr
                      key={delivery.id}
                      className="align-top transition-colors hover:bg-neutral-50/70"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-neutral-700">
                        {formatDateTime(
                          delivery.createdAt,
                          auth.organization.timezone,
                        )}
                      </td>

                      <td className="min-w-44 px-4 py-3.5">
                        <p className="font-semibold text-neutral-950">
                          {delivery.outletName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                          {delivery.destinationName}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="inline-flex rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                          {reportLabels[delivery.reportType]}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClassName(delivery.status)}`}
                        >
                          {statusLabels[delivery.status]}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium tabular-nums text-neutral-700">
                        {delivery.attemptCount} / {delivery.maxAttempts}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-neutral-600">
                        {formatDateTime(
                          delivery.sentAt,
                          auth.organization.timezone,
                        )}
                      </td>

                      <td className="max-w-40 px-4 py-3.5">
                        {delivery.telegramMessageId ? (
                          <span
                            title={delivery.telegramMessageId}
                            className="block truncate font-mono text-xs text-neutral-600"
                          >
                            {delivery.telegramMessageId}
                          </span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      <td className="max-w-xs px-4 py-3.5 text-xs text-neutral-600">
                        {delivery.lastErrorCode ? (
                          <div>
                            <span className="font-semibold text-red-700">
                              {delivery.lastErrorCode}
                            </span>
                            {delivery.lastErrorMessage ? (
                              <p
                                title={delivery.lastErrorMessage}
                                className="mt-1 line-clamp-2 leading-5"
                              >
                                {delivery.lastErrorMessage}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <Link
                          href={`/admin/pengaturan/integrasi/telegram/delivery/${delivery.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-2.5 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                        >
                          Detail
                          <ExternalLink className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {overview.deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-neutral-100 text-neutral-500">
                          <History className="size-5" />
                        </div>
                        <p className="mt-3 text-sm font-semibold text-neutral-900">
                          Belum ada delivery Telegram
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          History akan muncul setelah report atau test message
                          diproses.
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {(overview.statusCounts.failed ?? 0) > 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Delivery failed harus diperiksa detail attempt-nya sebelum
                manual retry. Ambiguous stale delivery tidak di-retry otomatis
                untuk mencegah duplicate message.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50/70 px-3 py-2.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="size-4" />
              Tidak ada failed delivery pada history saat ini.
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--muted)]">
              {overview.deliveryPagination.pageSize} delivery per halaman ·{" "}
              {overview.deliveryPagination.totalRows} total
            </p>

            <div className="flex items-center gap-2">
              {overview.deliveryPagination.page > 1 ? (
                <Link
                  href={buildHistoryPageHref(
                    overview.deliveryPagination.page - 1,
                  )}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-xl border border-[var(--border)] bg-neutral-50 px-3 text-xs font-semibold text-neutral-400">
                  ← Previous
                </span>
              )}

              <span className="inline-flex h-9 min-w-20 items-center justify-center rounded-xl bg-neutral-950 px-3 text-xs font-semibold tabular-nums text-white">
                {overview.deliveryPagination.page} /{" "}
                {overview.deliveryPagination.totalPages}
              </span>

              {overview.deliveryPagination.page <
              overview.deliveryPagination.totalPages ? (
                <Link
                  href={buildHistoryPageHref(
                    overview.deliveryPagination.page + 1,
                  )}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950"
                >
                  Next →
                </Link>
              ) : (
                <span className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-xl border border-[var(--border)] bg-neutral-50 px-3 text-xs font-semibold text-neutral-400">
                  Next →
                </span>
              )}
            </div>
          </div>
        </div>
      </TelegramDeliveryHistoryCard>
    </div>
  );
}
