"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Gem,
  MapPin,
  ReceiptText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import Image from "next/image";
import { type ReactNode, useMemo, useState } from "react";

import { PublicHistoryLocalAvatar } from "@/components/customers/public-history-local-avatar";
import { PublicHistorySecurityMenu } from "@/components/customers/public-history-security-menu";
import { ImageLightbox } from "@/components/media/image-lightbox";
import type {
  PublicCustomerHistoryData,
  PublicCustomerHistoryTransaction,
} from "@/features/customers/public-history";

type ValidPublicHistoryData = Extract<PublicCustomerHistoryData, { status: "valid" }>;
type HistoryFilter = "all" | "sale" | "buyback";


function getPublicCustomerHistoryImageUrl({
  imageKey,
  token,
}: {
  imageKey: string | null;
  token: string;
}) {
  if (!imageKey) return null;

  const normalizedKey = imageKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/v/${encodeURIComponent(token)}/image/${normalizedKey}`;
}

function formatAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "Rp 0";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatSignedAmount(
  transaction: PublicCustomerHistoryTransaction,
) {
  return transaction.kind === "buyback"
    ? `+ ${formatAmount(transaction.totalAmount)}`
    : `- ${formatAmount(transaction.totalAmount)}`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatGram(value: string | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  return `${amount.toLocaleString("id-ID", { maximumFractionDigits: 3 })} gr`;
}

function formatPercent(value: string | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  return `${amount.toLocaleString("id-ID", { maximumFractionDigits: 3 })}%`;
}

function transactionTime(transaction: PublicCustomerHistoryTransaction) {
  return transaction.completedAt ?? transaction.createdAt;
}

function transactionKey(transaction: PublicCustomerHistoryTransaction) {
  return `${transaction.kind}:${transaction.id}`;
}

function GlassPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-white/60 bg-white/[0.45] shadow-[0_24px_80px_rgba(74,48,24,0.14)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </div>
  );
}

function FinancialCard({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-11 place-items-center rounded-2xl border border-white/60 bg-white/50 shadow-sm">
          {icon}
        </div>
        {onClick ? <ChevronRight className="mt-2 size-5 text-neutral-500" /> : null}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</p>
    </>
  );

  const className =
    "min-h-[170px] rounded-[26px] border border-white/[0.65] bg-white/[0.43] p-4 text-left shadow-[0_18px_55px_rgba(75,52,29,.12)] backdrop-blur-2xl transition sm:p-5";

  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:bg-white/[0.55]`}>
      {content}
    </button>
  ) : (
    <article className={className}>{content}</article>
  );
}

function TransactionPreviewImage({
  token,
  transaction,
}: {
  token: string;
  transaction: PublicCustomerHistoryTransaction;
}) {
  const firstItem = transaction.itemSummary[0] ?? null;
  const imageUrl = getPublicCustomerHistoryImageUrl({
    imageKey: firstItem?.imageKey ?? null,
    token,
  });

  return (
    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/80 bg-[#f8f2e8]/75 text-[#a26d25] shadow-sm sm:size-[72px]">
      {imageUrl && firstItem ? (
        <Image
          src={imageUrl}
          alt={firstItem.productName}
          width={80}
          height={80}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        <Gem className="size-6" />
      )}
    </div>
  );
}

function TransactionDetailItems({
  token,
  transaction,
}: {
  token: string;
  transaction: PublicCustomerHistoryTransaction;
}) {
  if (transaction.itemSummary.length === 0) {
    return (
      <p className="rounded-2xl bg-white/[0.45] p-4 text-sm text-neutral-600">
        Detail item transaksi tidak tersedia.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {transaction.itemSummary.map((item) => {
        const imageUrl = getPublicCustomerHistoryImageUrl({
          imageKey: item.imageKey,
          token,
        });

        return (
          <article
            key={`${transaction.kind}-${transaction.id}-${item.lineNumber}`}
            className="grid grid-cols-[74px_minmax(0,1fr)] gap-3 rounded-2xl border border-white/70 bg-white/[0.48] p-3 backdrop-blur-lg"
          >
            <div className="grid size-[74px] place-items-center overflow-hidden rounded-xl bg-[#f8f1e6] text-[#9a681d]">
              {imageUrl ? (
                <ImageLightbox
                  src={imageUrl}
                  alt={`Foto ${item.productName}`}
                  caption={item.productName}
                  triggerClassName="size-full overflow-hidden rounded-xl"
                >
                  <Image
                    src={imageUrl}
                    alt={item.productName}
                    width={90}
                    height={90}
                    unoptimized
                    className="size-full object-cover"
                  />
                </ImageLightbox>
              ) : (
                <Gem className="size-6" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-950">
                    {item.productName}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">
                    {item.productCode}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black text-neutral-950">
                  {formatAmount(item.finalAmount)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-neutral-600">
                <span>{item.categoryName ?? "Perhiasan"}</span>
                <span>{formatGram(item.weightGram)}</span>
                <span>
                  Kadar {formatPercent(
                    transaction.kind === "sale"
                      ? item.exchangePurityPercent ?? item.purityPercent
                      : item.purityPercent,
                  )}
                </span>
                {item.source ? (
                  <span>{item.source === "asihjaya" ? "Barang ASIHJAYA" : "Barang Luar"}</span>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TransactionAccordion({
  token,
  transaction,
  open,
  onToggle,
}: {
  token: string;
  transaction: PublicCustomerHistoryTransaction;
  open: boolean;
  onToggle: () => void;
}) {
  const firstItem = transaction.itemSummary[0] ?? null;
  const moreItems = Math.max(0, transaction.totalItems - 1);
  const isBuyback = transaction.kind === "buyback";
  const settlementMethods = isBuyback
    ? transaction.payoutMethods
    : transaction.paymentMethods;
  const depositIn = Number(transaction.customerDeposit.inAmount) || 0;
  const depositUsed = Number(transaction.customerDeposit.usedAmount) || 0;

  return (
    <article
      className={`overflow-hidden rounded-[24px] border bg-white/[0.58] shadow-[0_12px_38px_rgba(61,43,26,.08)] transition ${
        open || transaction.isScannedTransaction
          ? "border-[#d5aa63]/75"
          : "border-white/75"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left sm:p-4"
        aria-expanded={open}
      >
        <TransactionPreviewImage token={token} transaction={transaction} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {transaction.isScannedTransaction ? (
              <span className="rounded-full bg-[#f9e9c6]/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#8a5b19]">
                Dipindai
              </span>
            ) : null}
            <span className="truncate text-[15px] font-black text-slate-950 sm:text-base">
              {firstItem?.productName ?? transaction.transactionNumber}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500 sm:text-sm">
            {isBuyback ? "Buyback" : "Pembelian"} · {transaction.outlet.name}
            {transaction.status === "partially_refunded"
              ? " · Retur Sebagian"
              : transaction.status === "refunded"
                ? " · Diretur"
                : ""}
          </p>
          {moreItems > 0 ? (
            <p className="mt-0.5 text-[11px] font-semibold text-[#94631f]">
              + {moreItems} item lainnya
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p
              className={`whitespace-nowrap text-sm font-black sm:text-base ${
                isBuyback ? "text-emerald-700" : "text-slate-950"
              }`}
            >
              {formatSignedAmount(transaction)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {formatTime(transactionTime(transaction))}
            </p>
          </div>
          <ChevronDown
            className={`size-5 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open ? (
        <div className="border-t border-white/70 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
            <div>
              <div className="grid gap-2 rounded-2xl border border-white/[0.65] bg-white/[0.38] p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                    No. Transaksi
                  </p>
                  <p className="mt-1 break-all font-mono text-xs font-bold text-neutral-950">
                    {transaction.transactionNumber}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                    Tanggal
                  </p>
                  <p className="mt-1 text-xs font-bold text-neutral-950">
                    {formatDateTime(transactionTime(transaction))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                    Outlet
                  </p>
                  <p className="mt-1 text-xs font-bold text-neutral-950">
                    {transaction.outlet.name}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                    Status
                  </p>
                  <p className="mt-1 text-xs font-bold text-neutral-950">
                    {transaction.status === "partially_refunded"
                      ? "Retur Sebagian"
                      : transaction.status === "refunded"
                        ? "Diretur"
                        : "Selesai"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-neutral-950">
                    {isBuyback ? "Barang Buyback" : "Barang Dibeli"}
                  </p>
                  <span className="text-xs font-semibold text-neutral-500">
                    {transaction.totalItems} item
                  </span>
                </div>
                <TransactionDetailItems token={token} transaction={transaction} />
              </div>
            </div>

            <div className="h-fit rounded-2xl border border-white/70 bg-white/[0.45] p-4 backdrop-blur-lg">
              <dl className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-600">{isBuyback ? "Nilai dasar" : "Subtotal"}</dt>
                  <dd className="font-bold text-neutral-950">
                    {formatAmount(isBuyback ? transaction.baseAmount : transaction.subtotalAmount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-600">{isBuyback ? "Potongan" : "Diskon"}</dt>
                  <dd className="font-bold text-neutral-950">
                    {formatAmount(isBuyback ? transaction.deductionAmount : transaction.discountAmount)}
                  </dd>
                </div>
                {depositUsed > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-neutral-600">Dana Titip digunakan</dt>
                    <dd className="font-bold text-[#9a681d]">-{formatAmount(depositUsed)}</dd>
                  </div>
                ) : null}
                {depositIn > 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-neutral-600">Masuk Dana Titip</dt>
                    <dd className="font-bold text-emerald-700">+{formatAmount(depositIn)}</dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3 border-t border-white/70 pt-3">
                  <dt className="text-neutral-600">{isBuyback ? "Pencairan" : "Pembayaran"}</dt>
                  <dd className="max-w-[160px] text-right font-bold text-neutral-950">
                    {settlementMethods.length > 0 ? settlementMethods.join(" + ") : "Tercatat"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/70 pt-3">
                  <dt className="font-bold text-neutral-950">{isBuyback ? "Total Buyback" : "Total Pembelian"}</dt>
                  <dd className={`text-lg font-black ${isBuyback ? "text-emerald-700" : "text-neutral-950"}`}>
                    {formatAmount(transaction.totalAmount)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function matchesSearch(transaction: PublicCustomerHistoryTransaction, rawSearch: string) {
  const search = rawSearch.trim().toLocaleLowerCase("id-ID");
  if (!search) return true;

  const searchable = [
    transaction.transactionNumber,
    transaction.outlet.name,
    transaction.outlet.code,
    transaction.kind === "buyback" ? "buyback" : "pembelian",
    ...transaction.itemSummary.flatMap((item) => [
      item.productName,
      item.productCode,
      item.categoryName ?? "",
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID");

  return searchable.includes(search);
}

export function PublicHistoryPortal({ data }: { data: ValidPublicHistoryData }) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [outletId, setOutletId] = useState("all");
  const [depositOpen, setDepositOpen] = useState(false);
  const [openTransactionKey, setOpenTransactionKey] = useState(
    transactionKey(data.scannedTransaction),
  );
  const avatarStorageKey = `${data.organizationId}:${data.customer.id}`;

  const outlets = useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>();
    for (const transaction of data.transactions) {
      unique.set(transaction.outlet.id, {
        id: transaction.outlet.id,
        name: transaction.outlet.name,
      });
    }
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
  }, [data.transactions]);

  const visibleTransactions = useMemo(
    () =>
      data.transactions.filter((transaction) => {
        if (filter !== "all" && transaction.kind !== filter) return false;
        if (outletId !== "all" && transaction.outlet.id !== outletId) return false;
        return matchesSearch(transaction, search);
      }),
    [data.transactions, filter, outletId, search],
  );

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, PublicCustomerHistoryTransaction[]>();

    for (const transaction of visibleTransactions) {
      const dateLabel = formatDate(transactionTime(transaction));
      const current = groups.get(dateLabel) ?? [];
      current.push(transaction);
      groups.set(dateLabel, current);
    }

    return Array.from(groups.entries());
  }, [visibleTransactions]);

  function chooseFilter(nextFilter: HistoryFilter) {
    setFilter(nextFilter);
    setOpenTransactionKey("");
  }

  function chooseOutlet(nextOutletId: string) {
    setOutletId(nextOutletId);
    setFilterOpen(false);
    setOpenTransactionKey("");
  }

  function updateSearch(nextSearch: string) {
    setSearch(nextSearch);
    if (openTransactionKey) {
      const active = data.transactions.find(
        (transaction) => transactionKey(transaction) === openTransactionKey,
      );
      if (active && !matchesSearch(active, nextSearch)) {
        setOpenTransactionKey("");
      }
    }
  }

  return (
    <>
      <main className="relative min-h-screen overflow-x-hidden text-slate-950">
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-30 bg-[url('/customer-history/background-mobile.webp')] bg-cover bg-center bg-no-repeat lg:bg-[url('/customer-history/background-desktop.webp')]"
        />
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-20 bg-[linear-gradient(180deg,rgba(255,250,242,.13),rgba(245,235,220,.28)_42%,rgba(232,219,198,.44))] lg:bg-[linear-gradient(90deg,rgba(255,252,247,.14),rgba(255,248,238,.22)_48%,rgba(229,211,188,.18))]"
        />
        <div aria-hidden="true" className="fixed inset-0 -z-10 bg-white/5 backdrop-saturate-150" />

        <div className="mx-auto w-full max-w-6xl px-3 pb-8 pt-5 sm:px-5 sm:pb-10 sm:pt-7 lg:px-6 lg:pt-9">
          <header className="flex items-center justify-between gap-4 px-1 sm:px-2">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <PublicHistoryLocalAvatar
                customerName={data.customer.name}
                storageKey={avatarStorageKey}
              />
              <div className="min-w-0 ">
                <p className="text-sm font-medium text-slate-800 sm:text-base">Halo,</p>
                <h1 className="truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  {data.customer.name}
                </h1>
                <p className="mt-0.5 text-sm text-slate-600 sm:text-base">
                  Selamat datang kembali <span aria-hidden="true">◆</span>
                </p>
              </div>
            </div>

            <PublicHistorySecurityMenu token={data.token} />
          </header>

          <GlassPanel className="mt-5 overflow-hidden rounded-[30px] sm:mt-7">
            <div className="relative min-h-[190px] p-5 sm:min-h-[220px] sm:p-7 lg:min-h-[250px] lg:p-9">
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_30%,rgba(220,164,71,.18),transparent_58%)]" />
              <div className="relative max-w-md">
                <Image
                  src="/logo/asihjaya-brand-text.png"
                  alt="ASIHJAYA"
                  width={146}
                  height={34}
                  className="h-7 w-auto object-contain"
                  priority
                />
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.35em] text-[#8f6427]">
                  Jewelry
                </p>
                <h2 className="mt-2 max-w-sm font-serif text-[2rem] leading-[1.08] text-slate-950 sm:text-[2.65rem]">
                  Keindahan<br />Selalu Bernilai
                </h2>
                <div className="mt-4 h-px w-14 bg-[#b88943]" />
                <p className="mt-3 max-w-xs text-xs leading-5 text-slate-600 sm:text-sm">
                  Setiap transaksi, bagian dari cerita berharga Anda.
                </p>
              </div>
              <div className="absolute bottom-5 right-5 hidden text-right text-xs font-medium tracking-wide text-white/90 drop-shadow-md sm:block lg:bottom-8 lg:right-8">
                <Sparkles className="ml-auto mb-2 size-4" />
                More Than Value<br />A Part of Your Story
              </div>
            </div>
          </GlassPanel>

          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <FinancialCard
              icon={<WalletCards className="size-5 text-[#8b5b18]" />}
              label="Saldo Dana Titip"
              value={formatAmount(data.customerDeposit.totalBalanceAmount)}
              hint="Total saldo di seluruh outlet"
              onClick={() => setDepositOpen((value) => !value)}
            />
            <FinancialCard
              icon={<ArrowUpRight className="size-5 text-rose-600" />}
              label="Uang Keluar"
              value={formatAmount(data.summary.totalPurchases)}
              hint={`${data.summary.totalSaleTransactions} transaksi pembelian`}
            />
            <FinancialCard
              icon={<ArrowDownLeft className="size-5 text-emerald-700" />}
              label="Uang Masuk"
              value={formatAmount(data.summary.totalBuybacks)}
              hint={`${data.summary.totalBuybackTransactions} transaksi Buyback`}
            />
          </section>

          {depositOpen ? (
            <GlassPanel className="mt-3 rounded-[26px] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#93651f]">
                    Dana Titip per Outlet
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Saldo hanya dapat digunakan atau dicairkan di outlet tempat saldo tersebut tersimpan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDepositOpen(false)}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-white/70 bg-white/[0.45]"
                  aria-label="Tutup detail Dana Titip"
                >
                  <X className="size-4" />
                </button>
              </div>

              {data.customerDeposit.balances.length > 0 ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.customerDeposit.balances.map((balance) => (
                    <div
                      key={balance.outletId}
                      className="rounded-2xl border border-white/70 bg-white/[0.45] p-4 backdrop-blur-lg"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <MapPin className="size-3.5 text-[#9b6b28]" />
                        {balance.outletName}
                      </div>
                      <p className="mt-2 text-lg font-black text-slate-950">
                        {formatAmount(balance.balanceAmount)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">Dapat dicairkan di outlet ini</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white/40 p-4 text-sm text-slate-600">
                  Saat ini tidak ada saldo Dana Titip aktif.
                </p>
              )}
            </GlassPanel>
          ) : null}

          <GlassPanel className="mt-5 rounded-[30px] p-4 sm:mt-6 sm:p-6 lg:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  Riwayat Transaksi
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Semua pembelian dan Buyback jewelry Anda.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSearchOpen((value) => !value)}
                  className={`grid size-11 place-items-center rounded-2xl border border-white/75 bg-white/[0.48] shadow-sm backdrop-blur transition hover:bg-white/[0.65] ${searchOpen ? "text-[#8d5e1d]" : "text-slate-950"}`}
                  aria-label="Cari transaksi"
                >
                  <Search className="size-5" />
                </button>
                <div className="relative">
                  {filterOpen ? (
                    <button
                      type="button"
                      className="fixed inset-0 z-20 cursor-default"
                      onClick={() => setFilterOpen(false)}
                      aria-label="Tutup filter outlet"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setFilterOpen((value) => !value)}
                    className={`relative z-30 grid size-11 place-items-center rounded-2xl border border-white/75 bg-white/[0.48] shadow-sm backdrop-blur transition hover:bg-white/[0.65] ${outletId !== "all" ? "text-[#8d5e1d]" : "text-slate-950"}`}
                    aria-label="Filter outlet"
                    aria-expanded={filterOpen}
                  >
                    <SlidersHorizontal className="size-5" />
                  </button>
                  {filterOpen ? (
                    <GlassPanel className="absolute right-0 top-[52px] z-40 w-64 rounded-2xl p-2">
                      <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        Outlet
                      </p>
                      <button
                        type="button"
                        onClick={() => chooseOutlet("all")}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/[0.55] ${outletId === "all" ? "bg-white/[0.55] text-[#8c5d1d]" : "text-slate-700"}`}
                      >
                        Semua Outlet
                      </button>
                      {outlets.map((outlet) => (
                        <button
                          key={outlet.id}
                          type="button"
                          onClick={() => chooseOutlet(outlet.id)}
                          className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/[0.55] ${outletId === outlet.id ? "bg-white/[0.55] text-[#8c5d1d]" : "text-slate-700"}`}
                        >
                          {outlet.name}
                        </button>
                      ))}
                    </GlassPanel>
                  ) : null}
                </div>
              </div>
            </div>

            {searchOpen ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/75 bg-white/[0.48] px-3 backdrop-blur-xl">
                <Search className="size-4 shrink-0 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => updateSearch(event.currentTarget.value)}
                  placeholder="Cari nota, barang, kode, atau outlet..."
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => updateSearch("")}
                    className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-white/[0.55]"
                    aria-label="Hapus pencarian"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-3 rounded-full border border-white/70 bg-white/30 p-1 backdrop-blur-lg">
              {([
                ["all", "Semua"],
                ["sale", "Pembelian"],
                ["buyback", "Buyback"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseFilter(value)}
                  className={`rounded-full px-2 py-2.5 text-xs font-bold transition sm:text-sm ${
                    filter === value
                      ? "bg-neutral-950 text-white shadow-lg"
                      : "text-slate-600 hover:bg-white/[0.35]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-5">
              {groupedTransactions.length > 0 ? (
                groupedTransactions.map(([dateLabel, transactions]) => (
                  <section key={dateLabel}>
                    <div className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-slate-700">
                      <CalendarDays className="size-4 text-[#966721]" />
                      {dateLabel}
                    </div>
                    <div className="grid gap-2.5">
                      {transactions.map((transaction) => {
                        const key = transactionKey(transaction);
                        return (
                          <TransactionAccordion
                            key={key}
                            token={data.token}
                            transaction={transaction}
                            open={openTransactionKey === key}
                            onToggle={() =>
                              setOpenTransactionKey((current) =>
                                current === key ? "" : key,
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-[24px] border border-white/70 bg-white/[0.42] p-7 text-center backdrop-blur-xl">
                  <ReceiptText className="mx-auto size-7 text-[#9b6a27]" />
                  <p className="mt-3 font-bold text-slate-950">Transaksi tidak ditemukan</p>
                  <p className="mt-1 text-sm text-slate-600">Coba ubah pencarian atau filter transaksi.</p>
                </div>
              )}
            </div>
          </GlassPanel>

          <GlassPanel className="mt-4 rounded-[26px] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/70 bg-white/[0.45] text-[#9b6a27]">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-950">
                    Riwayat resmi & terlindungi PIN
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">
                    Dana Titip tetap tersimpan dan dapat dicairkan hanya pada outlet pemilik saldo.
                  </p>
                </div>
              </div>
              <div className="text-left font-serif text-sm italic tracking-wide text-slate-600 sm:text-right">
                Precious Today,<br />Brighter Tomorrow
              </div>
            </div>
          </GlassPanel>
        </div>
      </main>

    </>
  );
}
