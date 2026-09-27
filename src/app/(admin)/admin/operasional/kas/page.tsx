import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Landmark,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
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

function getMovementDisplayLabel(
  movement: Pick<AdminCashMovementRow, "type" | "referenceType">,
) {
  if (
    movement.type === "cash_out" &&
    movement.referenceType === "customer_deposit_withdrawal"
  ) {
    return "Tarik Dana Titip";
  }

  if (movement.type === "cash_out" && movement.referenceType === "buyback") {
    return "Payout Buyback";
  }

  if (
    movement.type === "cash_in" &&
    movement.referenceType === "buyback_funding"
  ) {
    return "Dana Tambahan Buyback";
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

function buildCashExportUrl(filters: AdminCashMovementFilters) {
  const params = buildCashQueryParams(filters);
  const query = params.toString();
  const basePath = "/admin/operasional/kas/export/xlsx";

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
  if (movement.referenceType === "customer_deposit_withdrawal") {
    return (
      <span className="font-medium text-neutral-700">Penarikan Dana Titip</span>
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

function MovementCompactRow({ movement }: { movement: AdminCashMovementRow }) {
  const signedAmount = getCashMovementSignedAmount(movement);
  const tone = getMovementTone(movement.type);

  return (
    <article
      data-cash-layout="compact-row-card"
      className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm shadow-neutral-950/[0.02] transition hover:border-neutral-300 hover:shadow-md hover:shadow-neutral-950/[0.04] sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
            "shrink-0 text-left text-base font-semibold sm:text-right",
            tone.amount,
          )}
        >
          {formatSignedMoney(signedAmount)}
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-neutral-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Outlet
          </p>
          <p className="mt-1.5 truncate text-xs font-semibold text-neutral-800">
            {movement.outletName}
          </p>
        </div>
        <div className="rounded-xl bg-neutral-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Register
          </p>
          <p className="mt-1.5 truncate text-xs font-semibold text-neutral-800">
            {movement.registerName}
          </p>
        </div>
        <div className="rounded-xl bg-neutral-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Referensi
          </p>
          <div className="mt-1.5 min-w-0 truncate text-xs font-semibold text-neutral-800">
            <ReferenceLink movement={movement} />
          </div>
        </div>
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
  const activeFilterCount = [
    filters.search || null,
    filters.outletId,
    filters.type !== "all" ? filters.type : null,
    filters.range !== "today" ? filters.range : null,
  ].filter(Boolean).length;
  const selectedOutlet = data.outlets.find(
    (outlet) => outlet.id === filters.outletId,
  );
  const startItem =
    data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const endItem = Math.min(data.page * data.pageSize, data.total);

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

      <section
        data-cash-summary-layout="two-column-compact"
        className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-stretch"
      >
        <article className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                <Banknote className="size-3.5" />
                Arus Kas Fisik
              </div>
              <h2 className="mt-3 text-lg font-semibold text-neutral-950">
                Ringkasan Kas
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Arus kas fisik outlet pada periode terpilih.
              </p>
            </div>

            <div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white sm:min-w-52 sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                Net Movement
              </p>
              <p
                className={cn(
                  "mt-2 text-2xl font-semibold tracking-tight",
                  data.summary.netMovement > 0
                    ? "text-emerald-300"
                    : data.summary.netMovement < 0
                      ? "text-red-300"
                      : "text-white",
                )}
              >
                {formatSignedMoney(data.summary.netMovement)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Cash Sale
              </p>
              <p className="mt-2 text-lg font-semibold text-neutral-950">
                {formatMoney(data.summary.cashSales)}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Buyback
                </p>
                <span className="text-[11px] font-semibold text-neutral-500">
                  Net{" "}
                  {formatSignedMoney(
                    data.summary.buybackCashFunding -
                      data.summary.buybackCashPayouts,
                  )}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Pendanaan</span>
                  <span className="font-semibold text-emerald-700">
                    +{formatMoney(data.summary.buybackCashFunding)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Payout</span>
                  <span className="font-semibold text-red-700">
                    -{formatMoney(data.summary.buybackCashPayouts)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Kas Manual
                </p>
                <span className="text-[11px] font-semibold text-neutral-500">
                  Net{" "}
                  {formatSignedMoney(
                    data.summary.manualCashIn - data.summary.manualCashOut,
                  )}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Masuk</span>
                  <span className="font-semibold text-emerald-700">
                    +{formatMoney(data.summary.manualCashIn)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Keluar</span>
                  <span className="font-semibold text-red-700">
                    -{formatMoney(data.summary.manualCashOut)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-x-5 gap-y-2 border-t border-[var(--border)] pt-4 text-xs sm:grid-cols-3">
            <div className="flex items-center justify-between gap-3 sm:block">
              <span className="text-[var(--muted)]">Modal awal</span>
              <p className="font-semibold text-neutral-800 sm:mt-1">
                {formatMoney(data.summary.openingBalance)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <span className="text-[var(--muted)]">Refund cash</span>
              <p className="font-semibold text-red-700 sm:mt-1">
                -{formatMoney(data.summary.cashRefunds)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <span className="text-[var(--muted)]">Koreksi closing</span>
              <p
                className={cn(
                  "font-semibold sm:mt-1",
                  data.summary.closingAdjustments >= 0
                    ? "text-emerald-700"
                    : "text-red-700",
                )}
              >
                {formatSignedMoney(data.summary.closingAdjustments)}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:flex-col 2xl:flex-row">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                <WalletCards className="size-3.5" />
                Liability Dana Titip
              </div>
              <h2 className="mt-3 text-lg font-semibold text-neutral-950">
                Rekap Dana Titip
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Saldo titipan customer adalah liability outlet, bukan omzet.
              </p>
            </div>

            <div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white sm:min-w-52 sm:text-right xl:w-full xl:text-left 2xl:w-auto 2xl:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                Saldo Akhir
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-[#f1ce80]">
                {formatMoney(data.customerDepositSummary.closingBalance)}
              </p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-neutral-100 rounded-2xl border border-[var(--border)] px-4">
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-neutral-600">Saldo awal</span>
              <span className="text-sm font-semibold text-neutral-950">
                {formatMoney(data.customerDepositSummary.openingBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-neutral-600">Deposit saldo</span>
              <span className="text-sm font-semibold text-emerald-700">
                +{formatMoney(data.customerDepositSummary.depositIn)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-neutral-600">Gunakan saldo</span>
              <span className="text-sm font-semibold text-red-700">
                -{formatMoney(data.customerDepositSummary.depositUsed)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-neutral-600">Tarik tunai</span>
              <span className="text-sm font-semibold text-red-700">
                -{formatMoney(data.customerDepositSummary.depositWithdrawals)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm text-neutral-600">Adjustment</span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  data.customerDepositSummary.adjustmentIn -
                    data.customerDepositSummary.adjustmentOut >=
                  0
                    ? "text-emerald-700"
                    : "text-red-700",
                )}
              >
                {formatSignedMoney(
                  data.customerDepositSummary.adjustmentIn -
                    data.customerDepositSummary.adjustmentOut,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="text-sm font-semibold text-neutral-950">
                Net change
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  data.customerDepositSummary.netChange >= 0
                    ? "text-emerald-700"
                    : "text-red-700",
                )}
              >
                {formatSignedMoney(data.customerDepositSummary.netChange)}
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
        <div className="space-y-6">
          <details className="group overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:px-5 [&::-webkit-details-marker]:hidden">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-neutral-50 text-neutral-600">
                <Search className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-950">
                    Filter Buku Kas
                  </p>
                  {activeFilterCount > 0 ? (
                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      {activeFilterCount} filter aktif
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-500">
                      Opsional
                    </span>
                  )}
                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {rangeLabels[filters.range]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                  {selectedOutlet?.name ?? "Semua outlet"} ·{" "}
                  {movementTypeLabels[filters.type]} ·{" "}
                  {formatInteger(data.total)} movement.
                </p>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="hidden text-xs font-semibold text-neutral-500 sm:inline group-open:hidden">
                  Buka filter
                </span>
                <span className="hidden text-xs font-semibold text-neutral-500 sm:group-open:inline">
                  Tutup filter
                </span>
                <ChevronDown className="size-4 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />
              </div>
            </summary>

            <div className="border-t border-[var(--border)] p-4 sm:p-5">
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
            </div>
          </details>

          <section className="overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-neutral-950">Riwayat Buku Kas</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Menampilkan {formatInteger(startItem)}–
                  {formatInteger(endItem)} dari {formatInteger(data.total)}{" "}
                  movement.
                </p>
              </div>
              <Link
                href={buildCashExportUrl(filters)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                <Download className="size-4" />
                Export Excel
              </Link>
            </div>

            {data.rows.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-3 p-4">
                {data.rows.map((movement) => (
                  <MovementCompactRow key={movement.id} movement={movement} />
                ))}
              </div>
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
