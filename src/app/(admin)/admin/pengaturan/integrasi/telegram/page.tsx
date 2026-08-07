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
  if (status === "sent") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "failed") return "bg-red-50 text-red-700 ring-red-100";
  if (status === "retry") return "bg-amber-50 text-amber-800 ring-amber-100";
  if (status === "processing") return "bg-blue-50 text-blue-700 ring-blue-100";
  return "bg-neutral-100 text-neutral-700 ring-neutral-200";
}

export default async function TelegramIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("settings.manage");
  const [overview, botStatus, params] = await Promise.all([
    getTelegramAdminOverview(auth.organization.id),
    getTelegramAdminBotStatus(),
    searchParams,
  ]);
  const runtime = getTelegramRuntimeOutboxConfig();
  const message = params.message?.slice(0, 240) ?? null;
  const messageType = params.type === "error" ? "error" : "success";
  const pendingBacklog =
    (overview.statusCounts.pending ?? 0) + (overview.statusCounts.retry ?? 0);

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
              Mapping private group per outlet, report schedule, test message, dan delivery audit.
              Bot token tetap hanya berada di environment server dan tidak pernah ditampilkan di browser.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="flex items-center gap-2 font-semibold text-neutral-950">
              <ShieldCheck className="size-4 text-emerald-600" />
              Permission: settings.manage
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5">
              POS sales tidak memiliki akses ke halaman ini. Telegram commands, webhook, dan input dari Telegram tetap non-scope.
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
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Global integration</p>
              <p className="font-semibold text-neutral-950">{runtime.enabled ? "Enabled" : "Disabled"}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            Flag global berasal dari environment server. Test message admin tetap dapat digunakan saat flag OFF untuk rollout aman.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Bot className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Bot status</p>
              <p className="font-semibold text-neutral-950">{botStatus.username ?? botStatus.state.replaceAll("_", " ")}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{botStatus.message}</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <History className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--muted)]">Delivery queue</p>
              <p className="font-semibold text-neutral-950">{pendingBacklog} pending / retry</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            Failed: {overview.statusCounts.failed ?? 0} · Sent: {overview.statusCounts.sent ?? 0}
          </p>
        </article>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-950">Destination per outlet</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Fase pertama mengizinkan satu destination aktif per outlet. Gunakan private Telegram group development selama development.
          </p>
        </div>

        {overview.destinations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">
            Belum ada outlet aktif yang dapat dikonfigurasi.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {overview.destinations.map((destination) => (
              <article key={destination.outletId} className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[var(--muted)]">{destination.outletCode}</p>
                    <h3 className="mt-1 text-lg font-semibold text-neutral-950">{destination.outletName}</h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${destination.isActive && destination.id ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-neutral-100 text-neutral-600 ring-neutral-200"}`}>
                    {destination.id ? (destination.isActive ? "Aktif" : "Nonaktif") : "Belum disimpan"}
                  </span>
                </div>

                <form action={saveTelegramDestinationAction} className="mt-5 space-y-4">
                  {destination.id ? <input type="hidden" name="destinationId" value={destination.id} /> : null}
                  <input type="hidden" name="outletId" value={destination.outletId} />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className={labelClassName}>Nama destination</span>
                      <input name="name" required maxLength={160} defaultValue={destination.name} className={inputClassName} />
                    </label>
                    <label>
                      <span className={labelClassName}>Private group Chat ID</span>
                      <input name="chatId" required maxLength={32} defaultValue={destination.chatId} placeholder="-1001234567890" className={inputClassName} />
                    </label>
                  </div>

                  <label className="block">
                    <span className={labelClassName}>Timezone report</span>
                    <input name="timezone" required maxLength={64} defaultValue={destination.timezone || auth.organization.timezone} className={inputClassName} />
                  </label>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["openingEnabled", "Opening shift", destination.openingEnabled],
                      ["closingDailyEnabled", "Closing + daily", destination.closingDailyEnabled],
                      ["weeklyEnabled", "Weekly Senin–Minggu", destination.weeklyEnabled],
                      ["monthlyEnabled", "Monthly kalender", destination.monthlyEnabled],
                    ].map(([name, label, checked]) => (
                      <label key={String(name)} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-3 text-sm font-medium text-neutral-800">
                        <input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} className="size-4 accent-[var(--accent)]" />
                        {String(label)}
                      </label>
                    ))}
                  </div>

                  <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm font-medium text-neutral-800">
                    <input type="checkbox" name="isActive" defaultChecked={destination.isActive} className="size-4 accent-[var(--accent)]" />
                    Destination aktif
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800">
                      Simpan konfigurasi
                    </button>
                  </div>
                </form>

                {destination.id ? (
                  <form action={sendTelegramTestMessageAction} className="mt-3">
                    <input type="hidden" name="destinationId" value={destination.id} />
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

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-neutral-950">Delivery history</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">50 delivery terbaru, termasuk admin test message dan attempt audit.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
            <Clock3 className="size-4" />
            Timezone tampilan: {auth.organization.timezone}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-3 py-3 font-semibold">Created</th>
                <th className="px-3 py-3 font-semibold">Outlet</th>
                <th className="px-3 py-3 font-semibold">Report</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Attempts</th>
                <th className="px-3 py-3 font-semibold">Sent</th>
                <th className="px-3 py-3 font-semibold">Message ID</th>
                <th className="px-3 py-3 font-semibold">Last error</th>
                <th className="px-3 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {overview.deliveries.map((delivery) => (
                <tr key={delivery.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3 text-neutral-700">{formatDateTime(delivery.createdAt, auth.organization.timezone)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-neutral-950">{delivery.outletName}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-neutral-700">{reportLabels[delivery.reportType]}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClassName(delivery.status)}`}>{statusLabels[delivery.status]}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-neutral-700">{delivery.attemptCount}/{delivery.maxAttempts}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-neutral-700">{formatDateTime(delivery.sentAt, auth.organization.timezone)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-neutral-600">{delivery.telegramMessageId ?? "—"}</td>
                  <td className="max-w-xs px-3 py-3 text-xs text-neutral-600">
                    {delivery.lastErrorCode ? <span className="font-semibold text-red-700">{delivery.lastErrorCode}</span> : "—"}
                    {delivery.lastErrorMessage ? <p className="mt-1 line-clamp-2">{delivery.lastErrorMessage}</p> : null}
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/admin/pengaturan/integrasi/telegram/delivery/${delivery.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline">
                      View <ExternalLink className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
              {overview.deliveries.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-[var(--muted)]">Belum ada delivery Telegram.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {(overview.statusCounts.failed ?? 0) > 0 ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Delivery failed harus diperiksa detail attempt-nya sebelum manual retry. Ambiguous stale delivery tidak di-retry otomatis untuk mencegah duplicate message.</p>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="size-4" /> Tidak ada failed delivery pada history saat ini.
          </div>
        )}
      </section>
    </div>
  );
}
