import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  PlayCircle,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CloseShiftForm } from "@/components/shifts/close-shift-form";
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

function getExpectedCash(shift: ShiftSummary) {
  if (shift.status === "closed") {
    return shift.expectedCash;
  }

  return shift.cashSummary.expectedCash;
}

function StatusPill({ status }: { status: ShiftSummary["status"] }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Aktif
      </span>
    );
  }

  if (status === "closing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <Clock className="size-3" />
        Closing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
      <CheckCircle2 className="size-3" />
      Selesai
    </span>
  );
}

function SectionBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
      {children}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <article
      className={cn(
        "rounded-3xl border bg-white p-5",
        tone === "success" && "border-emerald-200 bg-emerald-50/40",
        tone === "warning" && "border-amber-200 bg-amber-50/40",
        tone === "neutral" && "border-[var(--border)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--muted)]">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{helper}</p>
        </div>
        <div
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl border",
            tone === "success" &&
              "border-emerald-200 bg-white text-emerald-700",
            tone === "warning" && "border-amber-200 bg-white text-amber-700",
            tone === "neutral" &&
              "border-[var(--border)] bg-neutral-50 text-neutral-700",
          )}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function CashStat({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        highlighted
          ? "border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] bg-neutral-50/70 text-neutral-950",
      )}
    >
      <p
        className={cn(
          "text-xs",
          highlighted ? "text-current/70" : "text-[var(--muted)]",
        )}
      >
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function ActiveShiftCard({ shift }: { shift: ShiftSummary }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)] lg:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SectionBadge>
              <PlayCircle className="size-3.5" />
              Shift aktif
            </SectionBadge>
            <StatusPill status={shift.status} />
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="grid size-14 shrink-0 place-items-center rounded-3xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <WalletCards className="size-7" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-neutral-950">
                {shift.registerName}
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                {shift.outletName} · {shift.registerCode}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Dibuka oleh{" "}
                <span className="font-medium text-neutral-800">
                  {shift.openedByName ?? "-"}
                </span>{" "}
                pada {formatDate(shift.openedAt)}. Expected cash dihitung dari
                modal awal, cash sale, kas masuk/keluar, dan refund cash.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <CashStat
            label="Modal awal"
            value={formatMoney(shift.cashSummary.openingBalance)}
          />
          <CashStat
            label="Cash sale"
            value={formatMoney(shift.cashSummary.cashSales)}
          />
          <CashStat
            label="Expected cash"
            value={formatMoney(shift.cashSummary.expectedCash)}
            highlighted
          />
        </div>
      </div>

      <div className="border-t border-[var(--border)] bg-neutral-50/50 p-4 sm:p-5 lg:p-6">
        <CloseShiftForm
          shiftId={shift.id}
          expectedCashLabel={formatMoney(shift.cashSummary.expectedCash)}
        />
      </div>
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

function VarianceText({ shift }: { shift: ShiftSummary }) {
  const variance = Number(shift.cashVariance ?? 0);

  if (shift.status !== "closed") {
    return <span className="text-neutral-400">-</span>;
  }

  return (
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
  );
}

function RecentShiftMobileCard({ shift }: { shift: ShiftSummary }) {
  return (
    <article className="rounded-3xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-950">{shift.outletName}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {shift.registerCode} · {shift.registerName}
          </p>
        </div>
        <StatusPill status={shift.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-3">
          <p className="text-xs text-[var(--muted)]">Dibuka</p>
          <p className="mt-1 font-medium text-neutral-950">
            {formatDate(shift.openedAt)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {shift.openedByName ?? "-"}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-3">
          <p className="text-xs text-[var(--muted)]">Ditutup</p>
          <p className="mt-1 font-medium text-neutral-950">
            {formatDate(shift.closedAt)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {shift.closedByName ?? "-"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Expected</p>
          <p className="mt-1 font-semibold text-neutral-950">
            {formatMoney(getExpectedCash(shift))}
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Aktual</p>
          <p className="mt-1 font-semibold text-neutral-950">
            {shift.actualCash ? formatMoney(shift.actualCash) : "-"}
          </p>
        </div>
        <div className="rounded-2xl bg-neutral-50 p-3">
          <p className="text-xs text-[var(--muted)]">Selisih</p>
          <p className="mt-1">
            <VarianceText shift={shift} />
          </p>
        </div>
      </div>

      {shift.varianceReason ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {shift.varianceReason}
        </p>
      ) : null}
    </article>
  );
}

export default async function ShiftPage({ searchParams }: PageProps) {
  const auth = await requirePermission("shifts.manage");
  const params = await searchParams;
  const dashboard = await getShiftDashboard(auth);
  const hasScrollableHistory = dashboard.recentShifts.length >= 6;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-[var(--accent)]"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Shift Kasir
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Pantau shift aktif, rekonsiliasi expected cash, tutup shift kasir,
              dan cek riwayat variance dari outlet yang kamu kelola.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4">
              <p className="text-xs font-medium text-[var(--muted)]">
                Shift aktif
              </p>
              <p className="mt-1 text-2xl font-semibold text-neutral-950">
                {dashboard.totals.activeShifts}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-4">
              <p className="text-xs font-medium text-[var(--muted)]">
                40 shift terakhir
              </p>
              <p className="mt-1 text-2xl font-semibold text-neutral-950">
                {dashboard.recentShifts.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <FlashMessage type={params.type} message={params.message} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Shift Aktif"
          value={dashboard.totals.activeShifts}
          helper="Register yang masih bisa menerima transaksi POS."
          icon={<Clock className="size-5" />}
          tone="success"
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
          tone={
            dashboard.totals.totalVarianceClosed === 0 ? "neutral" : "warning"
          }
        />
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 sm:p-6">
        <div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">
            Shift yang sedang berjalan
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Tutup shift dari sini setelah kasir menghitung uang fisik di laci.
          </p>
        </div>

        {dashboard.activeShifts.length > 0 ? (
          <div className="mt-5 space-y-4">
            {dashboard.activeShifts.map((shift) => (
              <ActiveShiftCard key={shift.id} shift={shift} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-3xl border border-dashed border-[var(--border)] bg-neutral-50/60 p-8 text-center">
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

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <SectionBadge>
              <CheckCircle2 className="size-3.5" />
              Ledger shift
            </SectionBadge>
            <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-950">
              Riwayat shift terakhir
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Menampilkan 40 shift terakhir dari outlet yang bisa kamu akses.
            </p>
          </div>
          {hasScrollableHistory ? (
            <p className="rounded-full border border-[var(--border)] bg-neutral-50 px-3 py-1 text-xs font-medium text-[var(--muted)]">
              Scroll daftar untuk melihat shift lainnya.
            </p>
          ) : null}
        </div>

        {dashboard.recentShifts.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <div className="min-w-[1180px]">
                <div className="grid grid-cols-[130px_minmax(240px,1fr)_170px_170px_150px_150px_150px] gap-4 border-b border-[var(--border)] bg-neutral-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
                  <div>Status</div>
                  <div>Outlet / Register</div>
                  <div>Dibuka</div>
                  <div>Ditutup</div>
                  <div className="text-right">Expected</div>
                  <div className="text-right">Aktual</div>
                  <div className="text-right">Selisih</div>
                </div>
                <div
                  className={cn(
                    "divide-y divide-[var(--border)]",
                    hasScrollableHistory && "max-h-[520px] overflow-y-auto",
                  )}
                >
                  {dashboard.recentShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="grid grid-cols-[130px_minmax(240px,1fr)_170px_170px_150px_150px_150px] gap-4 px-6 py-4 text-sm text-neutral-700 transition-colors hover:bg-neutral-50/60"
                    >
                      <div className="min-w-0">
                        <StatusPill status={shift.status} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-neutral-950">
                          {shift.outletName}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">
                          {shift.registerCode} · {shift.registerName}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p>{formatDate(shift.openedAt)}</p>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">
                          {shift.openedByName ?? "-"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p>{formatDate(shift.closedAt)}</p>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">
                          {shift.closedByName ?? "-"}
                        </p>
                      </div>
                      <div className="text-right font-semibold text-neutral-950">
                        {formatMoney(getExpectedCash(shift))}
                      </div>
                      <div className="text-right font-semibold text-neutral-950">
                        {shift.actualCash ? formatMoney(shift.actualCash) : "-"}
                      </div>
                      <div className="text-right">
                        <VarianceText shift={shift} />
                        {shift.varianceReason ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                            {shift.varianceReason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={cn(
                "space-y-3 p-4 lg:hidden",
                hasScrollableHistory && "max-h-[620px] overflow-y-auto",
              )}
            >
              {dashboard.recentShifts.map((shift) => (
                <RecentShiftMobileCard key={shift.id} shift={shift} />
              ))}
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto size-12 text-neutral-300" />
            <h3 className="mt-3 text-lg font-semibold text-neutral-950">
              Belum ada riwayat shift
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Riwayat akan muncul setelah shift POS dibuka atau ditutup.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
