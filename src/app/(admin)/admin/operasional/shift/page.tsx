import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  PlayCircle,
  StopCircle,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { closeShiftFromDashboardAction } from "@/app/actions/shifts";
import type { ShiftSummary } from "@/features/shifts/contracts";
import { getShiftDashboard } from "@/features/shifts/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";

type PageProps = {
  searchParams: Promise<{
    type?: string;
    message?: string;
  }>;
};

function formatMoney(value: string | number | null) {
  const parsedValue = typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(parsedValue) ? parsedValue : 0);
}

function formatSignedMoney(value: string | number | null) {
  const parsedValue = typeof value === "number" ? value : Number(value ?? 0);
  const safeValue = Number.isFinite(parsedValue) ? parsedValue : 0;
  const prefix = safeValue > 0 ? "+" : safeValue < 0 ? "-" : "";

  return `${prefix}${formatMoney(Math.abs(safeValue))}`;
}

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function StatusPill({ status }: { status: ShiftSummary["status"] }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Aktif
      </span>
    );
  }

  if (status === "closing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <Clock className="size-3" />
        Closing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
      <CheckCircle2 className="size-3" />
      Selesai
    </span>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{helper}</p>
        </div>
        <div className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </div>
      </div>
    </article>
  );
}

function CloseShiftForm({ shift }: { shift: ShiftSummary }) {
  return (
    <form
      action={closeShiftFromDashboardAction}
      className="mt-5 rounded-2xl border border-red-100 bg-red-50/50 p-4"
    >
      <input type="hidden" name="shiftId" value={shift.id} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-neutral-800">
            Kas fisik aktual
          </span>
          <input
            name="actualCash"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Contoh: 2500000"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Expected: {formatMoney(shift.cashSummary.expectedCash)}
          </p>
        </label>

        <label className="block text-sm">
          <span className="mb-2 block font-medium text-neutral-800">
            Catatan selisih
          </span>
          <input
            name="varianceReason"
            maxLength={500}
            placeholder="Wajib jika kas fisik berbeda dari expected cash"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
          />
        </label>

        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <StopCircle className="size-4" />
          Tutup Shift
        </button>
      </div>
    </form>
  );
}

function ActiveShiftCard({ shift }: { shift: ShiftSummary }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <PlayCircle className="size-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-950">
                {shift.registerName}
              </h2>
              <StatusPill status={shift.status} />
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {shift.outletName} · Dibuka oleh {shift.openedByName ?? "-"} pada {formatDate(shift.openedAt)}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              Expected cash dihitung dari modal awal, pembayaran cash, kas masuk/keluar, dan refund cash yang tercatat di shift ini.
            </p>
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[420px]">
          <div className="rounded-2xl bg-neutral-50 p-3">
            <p className="text-xs text-[var(--muted)]">Modal awal</p>
            <p className="mt-1 font-semibold text-neutral-950">
              {formatMoney(shift.cashSummary.openingBalance)}
            </p>
          </div>
          <div className="rounded-2xl bg-neutral-50 p-3">
            <p className="text-xs text-[var(--muted)]">Cash sale</p>
            <p className="mt-1 font-semibold text-neutral-950">
              {formatMoney(shift.cashSummary.cashSales)}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]">
            <p className="text-xs text-current/70">Expected cash</p>
            <p className="mt-1 font-semibold">
              {formatMoney(shift.cashSummary.expectedCash)}
            </p>
          </div>
        </div>
      </div>

      <CloseShiftForm shift={shift} />
    </article>
  );
}

function FlashMessage({ type, message }: { type?: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        type === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      {message}
    </div>
  );
}

export default async function ShiftPage({ searchParams }: PageProps) {
  const auth = await requirePermission("shifts.manage");
  const params = await searchParams;
  const dashboard = await getShiftDashboard(auth);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2">
            <Link
              href="/admin/operasional"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-[var(--accent)]"
            >
              <ArrowLeft className="size-4" />
              Kembali
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Shift Closing & Cash Reconciliation
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Pantau shift aktif, hitung expected cash, input kas fisik aktual, dan tutup shift dengan audit log.
          </p>
        </div>
      </header>

      <FlashMessage type={params.type} message={params.message} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Shift Aktif"
          value={dashboard.totals.activeShifts}
          helper="Register yang masih bisa menerima transaksi POS."
          icon={<Clock className="size-5" />}
        />
        <SummaryCard
          title="Expected Cash Aktif"
          value={formatMoney(dashboard.totals.expectedCashActive)}
          helper="Total kas sistem dari seluruh shift aktif."
          icon={<WalletCards className="size-5" />}
        />
        <SummaryCard
          title="Cash Sale Aktif"
          value={formatMoney(dashboard.totals.cashSalesActive)}
          helper="Pembayaran tunai yang masuk ke shift aktif."
          icon={<PlayCircle className="size-5" />}
        />
        <SummaryCard
          title="Selisih Shift Closed"
          value={formatSignedMoney(dashboard.totals.totalVarianceClosed)}
          helper="Akumulasi variance dari 40 shift terakhir."
          icon={<CheckCircle2 className="size-5" />}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">
              Shift Aktif
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Tutup shift dari sini setelah kasir menghitung uang fisik di laci.
            </p>
          </div>
        </div>

        {dashboard.activeShifts.length > 0 ? (
          <div className="space-y-4">
            {dashboard.activeShifts.map((shift) => (
              <ActiveShiftCard key={shift.id} shift={shift} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-8 text-center">
            <Clock className="mx-auto size-12 text-neutral-300" />
            <h2 className="mt-3 text-lg font-semibold text-neutral-950">
              Tidak ada shift aktif
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Buka shift dari POS sebelum mulai transaksi penjualan.
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold text-neutral-950">Riwayat Shift Terakhir</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Menampilkan 40 shift terakhir dari outlet yang bisa kamu akses.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50/50 text-xs text-neutral-500">
              <tr>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Outlet / Register</th>
                <th className="px-5 py-4 font-medium">Dibuka</th>
                <th className="px-5 py-4 font-medium">Ditutup</th>
                <th className="px-5 py-4 font-medium text-right">Expected</th>
                <th className="px-5 py-4 font-medium text-right">Aktual</th>
                <th className="px-5 py-4 font-medium text-right">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {dashboard.recentShifts.map((shift) => {
                const variance = Number(shift.cashVariance ?? 0);

                return (
                  <tr key={shift.id} className="transition-colors hover:bg-neutral-50/50">
                    <td className="px-5 py-4 align-top">
                      <StatusPill status={shift.status} />
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-neutral-900">{shift.outletName}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {shift.registerCode} · {shift.registerName}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p>{formatDate(shift.openedAt)}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {shift.openedByName ?? "-"}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p>{formatDate(shift.closedAt)}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {shift.closedByName ?? "-"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right align-top font-medium text-neutral-900">
                      {formatMoney(
                        shift.status === "closed"
                          ? shift.expectedCash
                          : shift.cashSummary.expectedCash,
                      )}
                    </td>
                    <td className="px-5 py-4 text-right align-top font-medium text-neutral-900">
                      {shift.actualCash ? formatMoney(shift.actualCash) : "-"}
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      {shift.status === "closed" ? (
                        <span
                          className={cn(
                            "font-semibold",
                            variance > 0 && "text-emerald-700",
                            variance < 0 && "text-red-700",
                            variance === 0 && "text-neutral-700",
                          )}
                        >
                          {formatSignedMoney(shift.cashVariance)}
                        </span>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                      {shift.varianceReason ? (
                        <p className="mt-1 max-w-52 text-xs leading-5 text-[var(--muted)]">
                          {shift.varianceReason}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
