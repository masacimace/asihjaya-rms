import { AlertTriangle, ArrowLeft, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { retryTelegramDeliveryAction } from "@/app/actions/telegram-settings";
import { getTelegramDeliveryDetail } from "@/features/telegram/admin-queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata = { title: "Telegram Delivery Detail" };

function formatDateTime(value: Date | null, timezone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(value);
}

export default async function TelegramDeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ deliveryId: string }>;
  searchParams: Promise<{ type?: string; message?: string }>;
}) {
  const auth = await requirePermission("settings.manage");
  const [{ deliveryId }, query] = await Promise.all([params, searchParams]);
  const detail = await getTelegramDeliveryDetail({
    organizationId: auth.organization.id,
    deliveryId,
  });
  if (!detail) notFound();

  const { delivery, attempts } = detail;
  const message = query.message?.slice(0, 240) ?? null;
  const messageType = query.type === "error" ? "error" : "success";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-white p-6 lg:p-7">
        <Link href="/admin/integrasi/telegram" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-[var(--accent)]">
          <ArrowLeft className="size-4" /> Kembali ke Telegram Reporting
        </Link>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <Send className="size-3.5" /> {delivery.reportType}
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-950">Delivery {delivery.id}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{delivery.outletName} · {delivery.destinationName}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 px-4 py-3 text-sm">
            <p className="font-semibold text-neutral-950">Status: {delivery.status}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Attempt {delivery.attemptCount}/{delivery.maxAttempts}</p>
          </div>
        </div>
      </section>

      {message ? (
        <div className={messageType === "error" ? "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"}>{message}</div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="font-semibold text-neutral-950">Delivery metadata</h2>
          <dl className="mt-4 grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--muted)]">Event key</dt><dd className="break-all font-mono text-xs">{delivery.eventKey}</dd>
            <dt className="text-[var(--muted)]">Business date</dt><dd>{delivery.businessDate ?? "—"}</dd>
            <dt className="text-[var(--muted)]">Period</dt><dd>{delivery.periodStart && delivery.periodEnd ? `${delivery.periodStart} — ${delivery.periodEnd}` : "—"}</dd>
            <dt className="text-[var(--muted)]">Created</dt><dd>{formatDateTime(delivery.createdAt, auth.organization.timezone)}</dd>
            <dt className="text-[var(--muted)]">Next attempt</dt><dd>{formatDateTime(delivery.nextAttemptAt, auth.organization.timezone)}</dd>
            <dt className="text-[var(--muted)]">Sent</dt><dd>{formatDateTime(delivery.sentAt, auth.organization.timezone)}</dd>
            <dt className="text-[var(--muted)]">Message ID</dt><dd className="font-mono text-xs">{delivery.telegramMessageId ?? "—"}</dd>
          </dl>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="font-semibold text-neutral-950">Last error</h2>
          {delivery.lastErrorCode || delivery.lastErrorMessage ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">{delivery.lastErrorCode ?? "Telegram delivery error"}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5">{delivery.lastErrorMessage ?? "Tidak ada deskripsi error."}</p>
            </div>
          ) : <p className="mt-4 text-sm text-[var(--muted)]">Tidak ada error tercatat.</p>}

          {delivery.status === "failed" ? (
            <div className="mt-4">
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                Review attempt sebelum retry. Manual retry menggunakan delivery row yang sama dan menunggu worker berikutnya.
              </div>
              <form action={retryTelegramDeliveryAction}>
                <input type="hidden" name="deliveryId" value={delivery.id} />
                <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white hover:bg-neutral-800">
                  <RefreshCw className="size-4" /> Manual retry
                </button>
              </form>
            </div>
          ) : null}
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Message snapshot</h2>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-[var(--border)] bg-neutral-50 p-4 text-xs leading-6 text-neutral-800">{delivery.messageText}</pre>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <h2 className="font-semibold text-neutral-950">Attempt audit</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
              <tr><th className="px-3 py-3">#</th><th className="px-3 py-3">Requested</th><th className="px-3 py-3">Completed</th><th className="px-3 py-3">HTTP</th><th className="px-3 py-3">Telegram</th><th className="px-3 py-3">Message ID</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Error</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="align-top">
                  <td className="px-3 py-3 font-semibold">{attempt.attemptNumber}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDateTime(attempt.requestedAt, auth.organization.timezone)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDateTime(attempt.completedAt, auth.organization.timezone)}</td>
                  <td className="px-3 py-3">{attempt.httpStatus ?? "—"}</td>
                  <td className="px-3 py-3">{attempt.telegramOk === true ? "OK" : attempt.telegramOk === false ? `Error ${attempt.telegramErrorCode ?? ""}` : "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs">{attempt.telegramMessageId ?? "—"}</td>
                  <td className="px-3 py-3">{attempt.durationMs != null ? `${attempt.durationMs} ms` : "—"}</td>
                  <td className="max-w-sm px-3 py-3 text-xs text-neutral-600">{attempt.telegramErrorDescription ?? "—"}</td>
                </tr>
              ))}
              {attempts.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-[var(--muted)]">Belum ada attempt.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
