import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Landmark,
  MinusCircle,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CashMovementForm } from "@/components/cash-movements/cash-movement-form";
import {
  parseAdminCashMovementFilters,
  type AdminCashMovementFilters,
  type AdminCashMovementRow,
  type AdminCashMovementType,
} from "@/features/cash-movements/contracts";
import {
  getAdminCashMovementListData,
  getCashMovementSignedAmount,
} from "@/features/cash-movements/queries";
import { requirePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Pergerakan Kas",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const movementTypeLabels: Record<AdminCashMovementType, string> = {
  all: "Semua tipe",
  opening_balance: "Modal Awal",
  cash_sale: "Cash Sale",
  cash_refund: "Refund Cash",
  cash_in: "Kas Masuk",
  cash_out: "Kas Keluar",
  closing_adjustment: "Koreksi Closing",
};

function getMovementDisplayLabel(movement: Pick<AdminCashMovementRow, "type" | "referenceType">) {
  if (
    movement.type === "cash_out" &&
    movement.referenceType === "customer_deposit_withdrawal"
  ) {
    return "Tarik Dana Titip";
  }

  return movementTypeLabels[movement.type];
}

const rangeLabels = {
  today: "Hari ini",
  "7d": "7 hari",
  "30d": "30 hari",
  all: "Semua periode",
};

function formatMoney(value: string | number | null) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatSignedMoney(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";

  return `${prefix}${formatMoney(Math.abs(value))}`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function buildCashQueryParams(filters: AdminCashMovementFilters) {
  const params = new URLSearchParams();

  if (filters.search) params.set("q", filters.search);
  if (filters.outletId) params.set("outletId", filters.outletId);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.range !== "today") params.set("range", filters.range);

  return params;
}

function buildCashListUrl(page: number, filters: AdminCashMovementFilters) {
  const params = buildCashQueryParams(filters);

  if (page > 1) params.set("page", String(page));

  const query = params.toString();

  return query ? `/admin/operasional/kas?${query}` : "/admin/operasional/kas";
}

function buildCashExportUrl(
  format: "csv" | "xlsx",
  filters: AdminCashMovementFilters,
) {
  const params = buildCashQueryParams(filters);
  const query = params.toString();
  const basePath =
    format === "xlsx"
      ? "/admin/operasional/kas/export/xlsx"
      : "/admin/operasional/kas/export";

  return query ? `${basePath}?${query}` : basePath;
}

function getMovementTone(type: AdminCashMovementRow["type"]) {
  if (
    type === "cash_in" ||
    type === "cash_sale" ||
    type === "opening_balance"
  ) {
    return {
      badge: "bg-emerald-50 text-emerald-700",
      icon: ArrowUpRight,
      amount: "text-emerald-700",
      dot: "bg-emerald-500",
    };
  }

  if (type === "cash_out" || type === "cash_refund") {
    return {
      badge: "bg-red-50 text-red-700",
      icon: ArrowDownRight,
      amount: "text-red-700",
      dot: "bg-red-500",
    };
  }

  return {
    badge: "bg-amber-50 text-amber-700",
    icon: RefreshCw,
    amount: "text-amber-700",
    dot: "bg-amber-500",
  };
}

function FlashMessage({
  type,
  message,
}: {
  type?: string | string[];
  message?: string | string[];
}) {
  const normalizedType = Array.isArray(type) ? type[0] : type;
  const normalizedMessage = Array.isArray(message) ? message[0] : message;

  if (!normalizedMessage) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-6",
        normalizedType === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {normalizedMessage}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  tone = "default",
}: {
  title: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
  tone?: "default" | "success" | "danger" | "dark";
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5",
        tone === "dark"
          ? "border-neutral-800 bg-neutral-950 text-white"
          : "border-[var(--border)] bg-white text-neutral-950",
      )}
    >
      <div
        className={cn(
          "absolute -right-8 -top-8 size-24 rounded-full opacity-40 blur-2xl",
          tone === "success" && "bg-emerald-100",
          tone === "danger" && "bg-red-100",
          tone === "dark" && "bg-white/20",
          tone === "default" && "bg-[var(--accent-soft)]",
        )}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              tone === "dark" ? "text-white/55" : "text-[var(--muted)]",
            )}
          >
            {title}
          </p>
          <p className="mt-3 truncate text-2xl font-semibold tracking-tight">
            {value}
          </p>
          <p
            className={cn(
              "mt-2 text-xs leading-5",
              tone === "dark" ? "text-white/55" : "text-[var(--muted)]",
            )}
          >
            {helper}
          </p>
        </div>
        <div
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            tone === "success" && "bg-emerald-50 text-emerald-600",
            tone === "danger" && "bg-red-50 text-red-600",
            tone === "dark" && "bg-white/10 text-white",
            tone === "default" &&
              "bg-[var(--accent-soft)] text-[var(--accent)]",
          )}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function MovementBadge({ movement }: { movement: AdminCashMovementRow }) {
  const tone = getMovementTone(movement.type);
  const Icon = tone.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone.badge,
      )}
    >
      <Icon className="size-3" />
      {getMovementDisplayLabel(movement)}
    </span>
  );
}

function ReferenceLink({ movement }: { movement: AdminCashMovementRow }) {
  if (
    movement.referenceType === "customer_deposit_withdrawal" &&
    movement.referenceId
  ) {
    return (
      <Link
        href="/admin/operasional/approval"
        className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
      >
        Penarikan Dana Titip
        <ArrowRight className="size-3" />
      </Link>
    );
  }

  if (movement.referenceType === "sale" && movement.referenceId) {
    return (
      <Link
        href={`/admin/penjualan/${movement.referenceId}`}
        className="inline-flex items-center gap-1 font-medium text-[var(--accent)] hover:underline"
      >
        {movement.referenceLabel ?? "Transaksi"}
        <ArrowRight className="size-3" />
      </Link>
    );
  }

  return <span>{movement.referenceLabel ?? "Manual"}</span>;
}

function MovementMobileCard({ movement }: { movement: AdminCashMovementRow }) {
  const signedAmount = getCashMovementSignedAmount(movement);
  const tone = getMovementTone(movement.type);

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <MovementBadge movement={movement} />
          <p className="mt-3 text-sm font-semibold text-neutral-950">
            {movement.reason || "Tanpa catatan"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            {formatDateTime(movement.createdAt)} · {movement.createdByName}
          </p>
        </div>
        <p
          className={cn(
            "shrink-0 text-right text-sm font-semibold",
            tone.amount,
          )}
        >
          {formatSignedMoney(signedAmount)}
        </p>
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl bg-neutral-50 p-3 text-xs text-[var(--muted)]">
        <p className="flex items-center justify-between gap-3">
          <span>Outlet</span>
          <span className="truncate text-right font-medium text-neutral-800">
            {movement.outletName}
          </span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>Register</span>
          <span className="truncate text-right font-medium text-neutral-800">
            {movement.registerName}
          </span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span>Referensi</span>
          <span className="truncate text-right font-medium text-neutral-800">
            <ReferenceLink movement={movement} />
          </span>
        </p>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-500">
        <ReceiptText className="size-7" />
      </div>
      <h3 className="mt-4 font-semibold text-neutral-950">
        Belum ada pergerakan kas
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        Coba ubah filter periode/outlet, atau catat kas masuk/keluar baru pada
        shift aktif.
      </p>
    </div>
  );
}

export default async function KasPage({ searchParams }: PageProps) {
  const auth = await requirePermission("admin.access");
  const query = await searchParams;
  const filters = parseAdminCashMovementFilters(query);
  const data = await getAdminCashMovementListData(auth, filters);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
        <div className="grid gap-5 border-b border-neutral-100 bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-[var(--accent)]"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Dashboard
            </Link>

            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              Pergerakan Kas
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
              Pantau arus kas fisik outlet dari modal awal, cash sale, kas
              masuk/keluar manual, refund cash, penarikan Dana Titip, sampai
              koreksi closing shift.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 sm:min-w-72">
            <div className="flex items-center justify-between gap-3 text-neutral-500">
              <p className="text-xs font-semibold uppercase">Periode aktif</p>
              <CalendarDays className="size-4" />
            </div>
            <p className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">
              {data.periodLabel}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {formatInteger(data.summary.totalMovements)} movement tercatat ·{" "}
              {formatInteger(data.summary.activeShiftCount)} shift aktif
            </p>
          </div>
        </div>
      </header>

      <FlashMessage type={query.type} message={query.message} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Net Movement"
          value={formatSignedMoney(data.summary.netMovement)}
          helper="Modal awal + cash sale + kas masuk - kas keluar/refund/Dana Titip."
          icon={<WalletCards className="size-5" />}
          tone="dark"
        />
        <SummaryCard
          title="Cash Sale"
          value={formatMoney(data.summary.cashSales)}
          helper="Pembayaran tunai dari transaksi POS pada periode ini."
          icon={<ReceiptText className="size-5" />}
          tone="success"
        />
        <SummaryCard
          title="Deposit Saldo"
          value={formatMoney(data.customerDepositSummary.depositIn)}
          helper="Penambahan saldo Dana Titip customer pada periode ini."
          icon={<PlusCircle className="size-5" />}
          tone="success"
        />
        <SummaryCard
          title="Tarik Dana Titip"
          value={formatMoney(data.summary.customerDepositCashWithdrawals)}
          helper="Kas keluar dari approval penarikan Dana Titip."
          icon={<MinusCircle className="size-5" />}
          tone="danger"
        />
        <SummaryCard
          title="Kas Keluar Manual"
          value={formatMoney(data.summary.manualCashOut)}
          helper="Kas keluar operasional non-Dana Titip."
          icon={<MinusCircle className="size-5" />}
          tone="danger"
        />
      </section>

      <section className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              <WalletCards className="size-3.5" />
              Liability Dana Titip
            </div>
            <h2 className="mt-3 text-lg font-semibold text-neutral-950">
              Rekap Dana Titip periode ini
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Saldo ini adalah kewajiban outlet ke customer, bukan omzet. Deposit
              Saldo menambah liability, sedangkan Gunakan saldo dan penarikan
              tunai mengurangi liability.
            </p>
          </div>
          <div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white lg:min-w-64 lg:text-right">
            <p className="text-xs font-semibold uppercase text-white/55">
              Saldo akhir Dana Titip
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[#f1ce80]">
              {formatMoney(data.customerDepositSummary.closingBalance)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="rounded-2xl bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Saldo awal
            </p>
            <p className="mt-2 font-semibold text-neutral-950">
              {formatMoney(data.customerDepositSummary.openingBalance)}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">
              Deposit Saldo
            </p>
            <p className="mt-2 font-semibold text-emerald-700">
              +{formatMoney(data.customerDepositSummary.depositIn)}
            </p>
          </div>
          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase text-red-700">
              Gunakan saldo
            </p>
            <p className="mt-2 font-semibold text-red-700">
              -{formatMoney(data.customerDepositSummary.depositUsed)}
            </p>
          </div>
          <div className="rounded-2xl bg-red-50 p-4">
            <p className="text-xs font-semibold uppercase text-red-700">
              Tarik tunai
            </p>
            <p className="mt-2 font-semibold text-red-700">
              -{formatMoney(data.customerDepositSummary.depositWithdrawals)}
            </p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase text-amber-700">
              Adjustment
            </p>
            <p className="mt-2 font-semibold text-amber-700">
              {formatSignedMoney(
                data.customerDepositSummary.adjustmentIn -
                  data.customerDepositSummary.adjustmentOut,
              )}
            </p>
          </div>
          <div className="rounded-2xl bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Net change
            </p>
            <p
              className={cn(
                "mt-2 font-semibold",
                data.customerDepositSummary.netChange >= 0
                  ? "text-emerald-700"
                  : "text-red-700",
              )}
            >
              {formatSignedMoney(data.customerDepositSummary.netChange)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-[var(--border)] bg-white p-4 sm:p-5">
            <form className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_180px_180px_180px_auto] lg:items-end">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Cari movement
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    name="q"
                    defaultValue={filters.search}
                    placeholder="Catatan, invoice, outlet, staff..."
                    className="h-11 w-full rounded-xl border border-[var(--border)] bg-white pl-10 pr-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  />
                </div>
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Outlet
                </span>
                <select
                  name="outletId"
                  defaultValue={filters.outletId ?? ""}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                >
                  <option value="">Semua outlet</option>
                  {data.outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Tipe
                </span>
                <select
                  name="type"
                  defaultValue={filters.type}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                >
                  {Object.entries(movementTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Periode
                </span>
                <select
                  name="range"
                  defaultValue={filters.range}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                >
                  {Object.entries(rangeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 lg:flex-none"
                >
                  <Search className="size-4" />
                  Filter
                </button>
                <Link
                  href="/admin/operasional/kas"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  aria-label="Reset filter"
                >
                  <RefreshCw className="size-4" />
                </Link>
              </div>
            </form>
          </section>

          <section className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-neutral-950">Buku Kas</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Menampilkan {formatInteger(data.rows.length)} dari{" "}
                  {formatInteger(data.total)} movement.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                <Link
                  href={buildCashExportUrl("csv", filters)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Download className="size-4" />
                  CSV
                </Link>
                <Link
                  href={buildCashExportUrl("xlsx", filters)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Download className="size-4" />
                  XLSX
                </Link>
              </div>
            </div>

            {data.rows.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-left text-sm text-neutral-600">
                    <thead className="bg-neutral-50/80 text-xs text-neutral-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Waktu</th>
                        <th className="px-5 py-4 font-semibold">Movement</th>
                        <th className="px-5 py-4 font-semibold">
                          Outlet / Register
                        </th>
                        <th className="px-5 py-4 font-semibold">
                          Dicatat Oleh
                        </th>
                        <th className="px-5 py-4 font-semibold">Referensi</th>
                        <th className="px-5 py-4 text-right font-semibold">
                          Nominal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {data.rows.map((movement) => {
                        const signedAmount =
                          getCashMovementSignedAmount(movement);
                        const tone = getMovementTone(movement.type);

                        return (
                          <tr
                            key={movement.id}
                            className="align-top transition-colors hover:bg-neutral-50/70"
                          >
                            <td className="whitespace-nowrap px-5 py-4 text-neutral-800">
                              {formatDateTime(movement.createdAt)}
                            </td>
                            <td className="px-5 py-4">
                              <MovementBadge movement={movement} />
                              <p className="mt-2 max-w-xs text-xs leading-5 text-[var(--muted)]">
                                {movement.reason || "Tanpa catatan"}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <p className="font-medium text-neutral-950">
                                {movement.outletName}
                              </p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {movement.registerName}
                              </p>
                            </td>
                            <td className="px-5 py-4 font-medium text-neutral-900">
                              {movement.createdByName}
                            </td>
                            <td className="px-5 py-4 text-xs text-[var(--muted)]">
                              <ReferenceLink movement={movement} />
                            </td>
                            <td
                              className={cn(
                                "whitespace-nowrap px-5 py-4 text-right font-semibold",
                                tone.amount,
                              )}
                            >
                              {formatSignedMoney(signedAmount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 p-4 lg:hidden">
                  {data.rows.map((movement) => (
                    <MovementMobileCard key={movement.id} movement={movement} />
                  ))}
                </div>
              </>
            )}

            {data.pageCount > 1 ? (
              <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[var(--muted)]">
                  Halaman {formatInteger(data.page)} dari{" "}
                  {formatInteger(data.pageCount)}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={buildCashListUrl(Math.max(1, data.page - 1), filters)}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 font-semibold transition hover:bg-neutral-50",
                      data.page <= 1 && "pointer-events-none opacity-40",
                    )}
                  >
                    <ChevronLeft className="size-4" />
                    Sebelumnya
                  </Link>
                  <Link
                    href={buildCashListUrl(
                      Math.min(data.pageCount, data.page + 1),
                      filters,
                    )}
                    className={cn(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 font-semibold transition hover:bg-neutral-50",
                      data.page >= data.pageCount &&
                        "pointer-events-none opacity-40",
                    )}
                  >
                    Berikutnya
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <CashMovementForm activeShifts={data.activeShifts} />

          <section className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-950">
                  Kontrol Audit
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Semua kas manual disimpan append-only, memperbarui expected
                  cash shift aktif, dan masuk ke audit log. Edit/delete movement
                  sengaja tidak disediakan pada fase ini.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
                <Store className="size-4 text-neutral-500" />
                <span className="text-[var(--muted)]">Outlet aktif:</span>
                <span className="ml-auto font-semibold text-neutral-950">
                  {formatInteger(data.outlets.length)}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
                <Clock3 className="size-4 text-neutral-500" />
                <span className="text-[var(--muted)]">Shift aktif:</span>
                <span className="ml-auto font-semibold text-neutral-950">
                  {formatInteger(data.summary.activeShiftCount)}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
                <Landmark className="size-4 text-neutral-500" />
                <span className="text-[var(--muted)]">Modal awal:</span>
                <span className="ml-auto font-semibold text-neutral-950">
                  {formatMoney(data.summary.openingBalance)}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
                <Banknote className="size-4 text-neutral-500" />
                <span className="text-[var(--muted)]">Refund cash:</span>
                <span className="ml-auto font-semibold text-neutral-950">
                  {formatMoney(data.summary.cashRefunds)}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3">
                <WalletCards className="size-4 text-neutral-500" />
                <span className="text-[var(--muted)]">Ledger Dana Titip:</span>
                <span className="ml-auto font-semibold text-neutral-950">
                  {formatInteger(data.customerDepositSummary.ledgerEntryCount)}
                </span>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
