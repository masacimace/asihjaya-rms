"use client";

import {
  Banknote,
  Building2,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  ImagePlus,
  LoaderCircle,
  PackagePlus,
  PiggyBank,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  Wrench,
} from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  completeBuybackAction,
  searchBuybackExistingItemsAction,
} from "@/app/actions/buybacks";
import { createPosQuickCustomerAction } from "@/app/actions/pos";
import { PosQuickCustomerDialog } from "@/components/pos/workspace/pos-quick-customer-dialog";
import {
  normalizeBuybackDecimal,
  normalizeBuybackMoney,
} from "@/features/buybacks/calculations";
import {
  BUYBACK_MAX_ITEMS,
  initialBuybackActionState,
  type BuybackExistingItemOption,
  type BuybackInitialData,
  type BuybackItemSource,
  type BuybackPayoutMethod,
  type BuybackProcessingType,
  type BuybackSubmitPayload,
} from "@/features/buybacks/contracts";
import type { ProductMasterCategoryOption } from "@/features/products/product-master-queries";
import {
  formatCurrency,
  formatRupiahInput,
} from "@/features/pos/payment-draft";
import { formatPosWeightInput } from "@/features/pos/transaction-pricing";
import { usePosCustomer } from "@/features/pos/use-pos-customer";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

const payoutLabels: Record<BuybackPayoutMethod, string> = {
  cash: "Cash",
  bank_transfer: "Transfer Bank",
  customer_deposit: "Simpan ke Dana Titip",
};

const processingLabels: Record<BuybackProcessingType, string> = {
  cleaning: "Cuci",
  recondition: "Rongsok",
};

type DraftItem = {
  clientKey: string;
  source: BuybackItemSource;
  productItemId: string | null;
  displayName: string;
  categoryId: string;
  processingType: BuybackProcessingType;
  sku: string | null;
  weightGram: string;
  purityPercent: string;
  color: string;
  totalAmount: string;
  imageSelected: boolean;
};

type PayoutState = Record<BuybackPayoutMethod, string> & {
  bankTransferReference: string;
};

function BuybackImageInput({
  clientKey,
  error,
  onSelectionChange,
}: {
  clientKey: string;
  error?: string;
  onSelectionChange: (selected: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedPreviewRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (generatedPreviewRef.current) {
        URL.revokeObjectURL(generatedPreviewRef.current);
      }
    },
    [],
  );

  function clearGeneratedPreview() {
    if (generatedPreviewRef.current) {
      URL.revokeObjectURL(generatedPreviewRef.current);
      generatedPreviewRef.current = null;
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    clearGeneratedPreview();

    if (!file) {
      setPreviewUrl(null);
      setFileName(null);
      onSelectionChange(false);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    generatedPreviewRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setFileName(file.name);
    onSelectionChange(true);
  }

  function removeImage() {
    clearGeneratedPreview();
    setPreviewUrl(null);
    setFileName(null);
    onSelectionChange(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <span className="block text-sm font-medium text-neutral-800">
            Foto Barang *
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
            Foto kondisi sebelum Cuci/Rongsok · maksimal 5 MB
          </span>
        </div>
        {previewUrl ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            Siap
          </span>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        name={`itemImage:${clientKey}`}
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="hidden"
      />

      <div
        className={cn(
          "grid gap-3 rounded-2xl border p-3 sm:grid-cols-[112px_minmax(0,1fr)]",
          error
            ? "border-red-200 bg-red-50/40"
            : "border-[var(--border)] bg-neutral-50/70",
        )}
      >
        <div className="aspect-square overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-white">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Preview kondisi barang Buyback"
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center px-3 text-center text-neutral-400">
              <div>
                <Camera className="mx-auto size-6" />
                <p className="mt-1.5 text-[10px]">Belum ada foto</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-center">
          <p className="truncate text-xs font-medium text-neutral-700">
            {fileName ?? "Ambil/pilih foto kondisi barang saat diterima."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <ImagePlus className="size-4" />
              {previewUrl ? "Ganti Foto" : "Pilih Foto"}
            </button>
            {previewUrl ? (
              <button
                type="button"
                onClick={removeImage}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50"
              >
                <Trash2 className="size-4" />
                Hapus
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="mt-2 text-xs font-medium text-red-700">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function createClientKey(prefix: string) {
  const suffix =
    typeof window !== "undefined" && window.crypto?.randomUUID
      ? window.crypto.randomUUID().replaceAll("-", "")
      : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${suffix}`.slice(0, 70);
}

function createExternalDraft(): DraftItem {
  return {
    clientKey: createClientKey("ext"),
    source: "external",
    productItemId: null,
    displayName: "",
    categoryId: "",
    processingType: "cleaning",
    sku: null,
    weightGram: "",
    purityPercent: "",
    color: "",
    totalAmount: "",
    imageSelected: false,
  };
}

function mapExistingItem(item: BuybackExistingItemOption): DraftItem {
  return {
    clientKey: createClientKey("existing"),
    source: "asihjaya",
    productItemId: item.id,
    displayName: item.productName,
    categoryId: item.categoryId,
    processingType: "cleaning",
    sku: item.sku,
    weightGram: item.weightGram ?? "",
    purityPercent: item.purityPercent ?? "",
    color: item.color ?? "",
    totalAmount: "",
    imageSelected: false,
  };
}

function getItemAmount(item: DraftItem) {
  const normalized = normalizeBuybackMoney(item.totalAmount);
  return normalized ? Number(normalized) : 0;
}

function isDraftItemComplete(item: DraftItem) {
  const weight = normalizeBuybackDecimal(item.weightGram);
  const purity = Number(item.purityPercent.replace(",", "."));
  return (
    item.displayName.trim().length >= 2 &&
    Boolean(item.categoryId) &&
    Boolean(weight) &&
    Number.isFinite(purity) &&
    purity > 0 &&
    purity <= 100 &&
    item.color.trim().length > 0 &&
    getItemAmount(item) > 0 &&
    item.imageSelected
  );
}

export function BuybackWorkspace({
  initialData,
  categories,
  initialIdempotencyKey,
  canCreate,
}: {
  initialData: BuybackInitialData;
  categories: ProductMasterCategoryOption[];
  initialIdempotencyKey: string;
  canCreate: boolean;
}) {
  const [state, formAction, isSubmitting] = useActionState(
    completeBuybackAction,
    initialBuybackActionState,
  );
  const [idempotencyKey, setIdempotencyKey] = useState(initialIdempotencyKey);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [existingQuery, setExistingQuery] = useState("");
  const [existingResults, setExistingResults] = useState<
    BuybackExistingItemOption[]
  >([]);
  const [isSearching, startSearchTransition] = useTransition();
  const [payouts, setPayouts] = useState<PayoutState>({
    cash: "",
    bank_transfer: "",
    customer_deposit: "",
    bankTransferReference: "",
  });

  const customer = usePosCustomer({
    customers: initialData.customers,
    createQuickCustomer: createPosQuickCustomerAction,
  });
  const clearCustomerState = customer.clearCustomerState;

  const totalAmount = useMemo(
    () => items.reduce((total, item) => total + getItemAmount(item), 0),
    [items],
  );

  const payoutAmounts = useMemo(
    () => ({
      cash: Number(
        normalizeBuybackMoney(payouts.cash, { allowZero: true }) ?? 0,
      ),
      bank_transfer: Number(
        normalizeBuybackMoney(payouts.bank_transfer, { allowZero: true }) ?? 0,
      ),
      customer_deposit: Number(
        normalizeBuybackMoney(payouts.customer_deposit, { allowZero: true }) ??
          0,
      ),
    }),
    [payouts],
  );

  const payoutTotal =
    payoutAmounts.cash +
    payoutAmounts.bank_transfer +
    payoutAmounts.customer_deposit;
  const payoutDifference = totalAmount - payoutTotal;

  const payload = useMemo<BuybackSubmitPayload>(
    () => ({
      idempotencyKey,
      customerId: customer.selectedCustomer?.id ?? "",
      notes,
      items: items.map((item) => ({
        clientKey: item.clientKey,
        source: item.source,
        productItemId: item.productItemId,
        displayName: item.displayName,
        categoryId: item.categoryId,
        processingType: item.processingType,
        weightGram: item.weightGram,
        purityPercent: item.purityPercent,
        color: item.color,
        totalAmount: item.totalAmount,
      })),
      payouts: (Object.keys(payoutLabels) as BuybackPayoutMethod[])
        .filter((method) => payoutAmounts[method] > 0)
        .map((method) => ({
          method,
          amount: String(payoutAmounts[method]),
          reference:
            method === "bank_transfer"
              ? payouts.bankTransferReference.trim() || null
              : null,
        })),
    }),
    [
      customer.selectedCustomer?.id,
      idempotencyKey,
      items,
      notes,
      payoutAmounts,
      payouts.bankTransferReference,
    ],
  );

  useEffect(() => {
    if (state.status !== "success" || !state.result) return;

    setItems([]);
    setNotes("");
    setPayouts({
      cash: "",
      bank_transfer: "",
      customer_deposit: "",
      bankTransferReference: "",
    });
    setExistingQuery("");
    setExistingResults([]);
    clearCustomerState();
    if (typeof window !== "undefined" && window.crypto?.randomUUID) {
      setIdempotencyKey(window.crypto.randomUUID());
    }
  }, [clearCustomerState, state.result, state.status]);

  function updateItem(clientKey: string, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) =>
        item.clientKey === clientKey ? { ...item, ...patch } : item,
      ),
    );
    setFeedback(null);
  }

  function removeItem(clientKey: string) {
    setItems((current) =>
      current.filter((item) => item.clientKey !== clientKey),
    );
    setFeedback(null);
  }

  function addExternalItem() {
    if (items.length >= BUYBACK_MAX_ITEMS) {
      setFeedback(`Maksimal ${BUYBACK_MAX_ITEMS} item dalam satu Buyback.`);
      return;
    }
    setItems((current) => [...current, createExternalDraft()]);
    setFeedback(null);
  }

  function addExistingItem(item: BuybackExistingItemOption) {
    if (items.length >= BUYBACK_MAX_ITEMS) {
      setFeedback(`Maksimal ${BUYBACK_MAX_ITEMS} item dalam satu Buyback.`);
      return;
    }
    if (items.some((current) => current.productItemId === item.id)) {
      setFeedback(`${item.sku} sudah ada di daftar Buyback.`);
      return;
    }
    setItems((current) => [...current, mapExistingItem(item)]);
    setFeedback(
      `${item.sku} ditambahkan. Pilih Cuci/Rongsok, cek data fisik, isi Total Harga, lalu ambil foto kondisi barang.`,
    );
  }

  function searchExisting() {
    const query = existingQuery.trim();
    if (query.length < 2) {
      setFeedback(
        "Masukkan minimal 2 karakter SKU, barcode, QR, atau nama produk.",
      );
      return;
    }

    startSearchTransition(async () => {
      const result = await searchBuybackExistingItemsAction(query);
      if (result.status === "error") {
        setExistingResults([]);
        setFeedback(result.message);
        return;
      }
      setExistingResults(result.items);
      setFeedback(
        result.items.length > 0
          ? null
          : "Tidak ada produk ASIHJAYA berstatus Terjual/Customer yang cocok.",
      );
    });
  }

  function fillPayoutRemainder(method: BuybackPayoutMethod) {
    const otherTotal = (Object.keys(payoutLabels) as BuybackPayoutMethod[])
      .filter((candidate) => candidate !== method)
      .reduce((sum, candidate) => sum + payoutAmounts[candidate], 0);
    const remainder = Math.max(0, totalAmount - otherTotal);
    setPayouts((current) => ({
      ...current,
      [method]: remainder > 0 ? formatRupiahInput(String(remainder)) : "",
    }));
  }

  function submitQuickCustomer() {
    customer.submitQuickCustomer((created, message) => {
      customer.selectCustomerState(created);
      setFeedback(message);
    });
  }

  function useExistingQuickCustomer(
    existingCustomer: Parameters<typeof customer.selectCustomerState>[0],
  ) {
    customer.useExistingQuickCustomer(existingCustomer, (selected) => {
      customer.selectCustomerState(selected);
      setFeedback("Customer existing dipilih untuk Buyback.");
    });
  }

  const canSubmit =
    canCreate &&
    Boolean(initialData.context.activeShift) &&
    Boolean(customer.selectedCustomer) &&
    items.length > 0 &&
    items.every(isDraftItemComplete) &&
    totalAmount > 0 &&
    payoutDifference === 0;

  return (
    <>
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />

        {state.status === "success" && state.result ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold">{state.message}</p>
                <p className="mt-1 text-sm">
                  {state.result.itemCount} item ·{" "}
                  {formatCurrency(state.result.totalAmount)}. Barang masuk
                  antrean Cuci/Rongsok dan belum tersedia untuk dijual di POS.
                </p>
                <p className="mt-1 text-xs">
                  {state.result.receiptJobId
                    ? "Nota Buyback sudah masuk antrean Document Printer."
                    : state.result.replayed
                      ? "Transaksi ini merupakan replay aman; job nota awal tidak dibuat ulang."
                      : "Nota Buyback dapat dicetak ulang dari detail transaksi."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/pos/buyback?detail=${state.result.buybackId}`}
                    className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800"
                  >
                    Lihat Detail Buyback
                  </a>
                  <a
                    href={`/api/buybacks/${state.result.buybackId}/receipt-certificate`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800"
                  >
                    Buka Nota PDF
                  </a>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {state.status === "error" || feedback ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {state.status === "error" ? state.message : feedback}
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              1. Customer penjual
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Pilih customer yang menyerahkan barang.
            </p>
          </div>

          <div className="relative mt-4">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <UserRound className="pointer-events-none absolute left-3 top-3.5 size-4 text-neutral-400" />
                <input
                  value={customer.customerQuery}
                  onChange={(event) =>
                    customer.changeCustomerQuery(event.target.value)
                  }
                  onFocus={customer.openCustomerSelector}
                  onBlur={customer.closeCustomerSelectorAfterDelay}
                  placeholder="Cari nama, kode customer, atau nomor HP..."
                  className={cn(inputClassName, "pl-10")}
                />
                {customer.isCustomerSelectorOpen &&
                customer.customerSearchResults.length > 0 ? (
                  <div className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-1 shadow-xl">
                    {customer.customerSearchResults
                      .slice(0, 10)
                      .map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => customer.selectCustomerState(option)}
                          className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-neutral-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-neutral-900">
                              {option.fullName}
                            </span>
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">
                              {option.customerCode ?? "Tanpa kode"} ·{" "}
                              {option.phone ?? "Tanpa HP"}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-[var(--accent)]">
                            Saldo{" "}
                            {formatCurrency(option.customerDepositBalance)}
                          </span>
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={customer.openQuickCustomerDialog}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Customer</span>
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-950">
                2. Barang Buyback
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Input dibuat sederhana: nama, Cuci/Rongsok, kategori, warna,
                kadar, berat, total harga, dan foto.
              </p>
            </div>
            <button
              type="button"
              onClick={addExternalItem}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white hover:bg-black/80"
            >
              <PackagePlus className="size-4" />
              Tambah Produk External
            </button>
          </div>

          <div className="mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl bg-[var(--surface-muted)] p-3">
            <p className="mb-2 text-xs font-semibold text-neutral-700">
              Produk ASIHJAYA yang pernah dijual
            </p>
            <div className="flex min-w-0 max-w-full gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-neutral-400" />
                <input
                  value={existingQuery}
                  onChange={(event) => setExistingQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      searchExisting();
                    }
                  }}
                  placeholder="SKU, barcode, serial, atau nama produk"
                  className={cn(inputClassName, "pl-10")}
                />
              </div>
              <button
                type="button"
                onClick={searchExisting}
                disabled={isSearching}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-neutral-700 disabled:opacity-60"
              >
                {isSearching ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Cari
              </button>
            </div>

            {existingResults.length > 0 ? (
              <div className="mt-3 grid min-w-0 w-full max-w-full gap-2 lg:grid-cols-2">
                {existingResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => addExistingItem(result)}
                    className="min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white p-3 text-left transition hover:border-[var(--accent)]"
                  >
                    <div className="flex min-w-0 w-full max-w-full items-start justify-between gap-3 overflow-hidden">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="truncate text-sm font-semibold text-neutral-950">
                          {result.sku} · {result.productName}
                        </p>
                        <p className="mt-1 max-w-full truncate text-xs text-[var(--muted)]">
                          {result.categoryName} · {result.weightGram ?? "-"} gr
                          · Kadar {result.purityPercent ?? "-"}%
                        </p>
                        {result.lastInvoiceNumber ? (
                          <p className="mt-1 max-w-full truncate text-[11px] text-neutral-500">
                            Sale terakhir: {result.lastInvoiceNumber}
                          </p>
                        ) : null}
                      </div>
                      <Plus className="size-4 shrink-0 text-[var(--accent)]" />
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                Belum ada barang Buyback.
              </div>
            ) : null}

            {items.map((item, index) => (
              <article
                key={item.clientKey}
                className="rounded-2xl border border-[var(--border)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                        Item {index + 1}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
                        {item.source === "asihjaya"
                          ? `ASIHJAYA${item.sku ? ` · ${item.sku}` : ""}`
                          : "Barang Luar"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.clientKey)}
                    className="grid size-9 shrink-0 place-items-center rounded-xl text-red-600 hover:bg-red-50"
                    aria-label="Hapus item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <label className="block text-sm lg:col-span-2">
                    <span className="mb-2 block font-medium text-neutral-800">
                      Nama Produk *
                    </span>
                    <input
                      value={item.displayName}
                      onChange={(event) =>
                        updateItem(item.clientKey, {
                          displayName: event.target.value,
                        })
                      }
                      maxLength={220}
                      className={inputClassName}
                      placeholder="Contoh: Cincin Emas Customer"
                    />
                  </label>

                  <div className="lg:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-neutral-800">
                      Status / Kondisi Produk *
                    </span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(
                        ["cleaning", "recondition"] as BuybackProcessingType[]
                      ).map((processingType) => {
                        const selected = item.processingType === processingType;
                        const Icon =
                          processingType === "cleaning" ? Sparkles : Wrench;
                        return (
                          <button
                            key={processingType}
                            type="button"
                            onClick={() =>
                              updateItem(item.clientKey, { processingType })
                            }
                            className={cn(
                              "flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                              selected
                                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                                : "border-[var(--border)] bg-white text-neutral-700 hover:bg-neutral-50",
                            )}
                          >
                            <Icon className="size-5 shrink-0" />
                            <span>
                              <span className="block text-sm font-semibold">
                                {processingLabels[processingType]}
                              </span>
                              <span className="mt-0.5 block text-[11px] opacity-75">
                                {processingType === "cleaning"
                                  ? "Cleaning / servis ringan sebelum dijual lagi"
                                  : "Perlu rekondisi/repair lebih besar"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-neutral-800">
                      Kategori *
                    </span>
                    <select
                      value={item.categoryId}
                      onChange={(event) =>
                        updateItem(item.clientKey, {
                          categoryId: event.target.value,
                        })
                      }
                      className={inputClassName}
                    >
                      <option value="">Pilih kategori</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-neutral-800">
                      Warna *
                    </span>
                    <input
                      value={item.color}
                      onChange={(event) =>
                        updateItem(item.clientKey, {
                          color: event.target.value,
                        })
                      }
                      maxLength={64}
                      className={inputClassName}
                      placeholder="Kuning"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-neutral-800">
                      Kadar % *
                    </span>
                    <input
                      value={item.purityPercent}
                      onChange={(event) =>
                        updateItem(item.clientKey, {
                          purityPercent: formatPosWeightInput(
                            event.target.value,
                          ),
                        })
                      }
                      inputMode="decimal"
                      className={inputClassName}
                      placeholder="40"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-neutral-800">
                      Berat (Gr) *
                    </span>
                    <input
                      value={item.weightGram}
                      onChange={(event) =>
                        updateItem(item.clientKey, {
                          weightGram: formatPosWeightInput(event.target.value),
                        })
                      }
                      inputMode="decimal"
                      className={inputClassName}
                      placeholder="1,000"
                    />
                  </label>

                  <label className="block text-sm lg:col-span-2">
                    <span className="mb-2 block font-medium text-neutral-800">
                      Total Harga Buyback *
                    </span>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-xs font-semibold text-neutral-500">
                        Rp
                      </span>
                      <input
                        value={item.totalAmount}
                        onChange={(event) =>
                          updateItem(item.clientKey, {
                            totalAmount: formatRupiahInput(event.target.value),
                          })
                        }
                        inputMode="numeric"
                        className={cn(inputClassName, "pl-9")}
                        placeholder="500.000"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      Nominal final ditentukan manual oleh staff.
                    </p>
                  </label>

                  <div className="lg:col-span-2">
                    <BuybackImageInput
                      clientKey={item.clientKey}
                      error={
                        state.fieldErrors?.[`items.${item.clientKey}.image`]
                      }
                      onSelectionChange={(imageSelected) =>
                        updateItem(item.clientKey, { imageSelected })
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-neutral-950 px-4 py-3 text-white">
                  <span className="text-xs text-white/60">
                    Total item Buyback
                  </span>
                  <span className="text-base font-bold">
                    {formatCurrency(getItemAmount(item))}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <WalletCards className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-950">
                3. Payout ke Customer
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
                Cash, Transfer Bank, Dana Titip, atau kombinasi. Total payout
                wajib sama dengan Total Buyback.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <PayoutCard
              icon={<Banknote className="size-4" />}
              title="Cash"
              helper="Uang tunai diberikan langsung."
              value={payouts.cash}
              onChange={(value) =>
                setPayouts((current) => ({ ...current, cash: value }))
              }
              onFill={() => fillPayoutRemainder("cash")}
            >
              {initialData.context.activeShift ? (
                <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-[11px] leading-4 text-[var(--muted)]">
                  Kas tercatat{" "}
                  {formatCurrency(
                    Number(initialData.context.activeShift.expectedCash ?? 0),
                  )}
                  {" → "}
                  {formatCurrency(
                    Number(initialData.context.activeShift.expectedCash ?? 0) -
                      payoutAmounts.cash,
                  )}
                </p>
              ) : null}
            </PayoutCard>

            <PayoutCard
              icon={<Building2 className="size-4" />}
              title="Transfer Bank"
              helper="Transfer ke rekening customer."
              value={payouts.bank_transfer}
              onChange={(value) =>
                setPayouts((current) => ({
                  ...current,
                  bank_transfer: value,
                }))
              }
              onFill={() => fillPayoutRemainder("bank_transfer")}
            >
              <input
                value={payouts.bankTransferReference}
                onChange={(event) =>
                  setPayouts((current) => ({
                    ...current,
                    bankTransferReference: event.target.value,
                  }))
                }
                maxLength={160}
                className={cn(inputClassName, "mt-2")}
                placeholder="Referensi transfer (opsional)"
              />
            </PayoutCard>

            <PayoutCard
              icon={<PiggyBank className="size-4" />}
              title="Dana Titip"
              helper="Tambah saldo Dana Titip customer."
              value={payouts.customer_deposit}
              onChange={(value) =>
                setPayouts((current) => ({
                  ...current,
                  customer_deposit: value,
                }))
              }
              onFill={() => fillPayoutRemainder("customer_deposit")}
            >
              {customer.selectedCustomer ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] leading-4 text-emerald-800">
                  Saldo{" "}
                  {formatCurrency(
                    customer.selectedCustomer.customerDepositBalance,
                  )}
                  {" → "}
                  {formatCurrency(
                    customer.selectedCustomer.customerDepositBalance +
                      payoutAmounts.customer_deposit,
                  )}
                </p>
              ) : null}
            </PayoutCard>
          </div>

          <div className="mt-4 grid gap-3 rounded-2xl bg-neutral-950 p-4 text-white sm:grid-cols-3">
            <div>
              <p className="text-xs text-white/60">Total Buyback</p>
              <p className="mt-1 text-lg font-bold">
                {formatCurrency(totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Total Payout</p>
              <p className="mt-1 text-lg font-bold">
                {formatCurrency(payoutTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Selisih</p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold",
                  payoutDifference === 0
                    ? "text-emerald-300"
                    : "text-amber-300",
                )}
              >
                {formatCurrency(Math.abs(payoutDifference))}
                {payoutDifference < 0
                  ? " lebih"
                  : payoutDifference > 0
                    ? " kurang"
                    : ""}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Catatan Buyback (opsional)
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              placeholder="Catatan kondisi barang / kesepakatan harga..."
            />
          </label>

          {!initialData.context.activeShift ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Shift aktif belum dibuka. Buyback belum dapat diselesaikan.
            </p>
          ) : null}
          {!canCreate ? (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              Akun ini belum memiliki permission membuat Buyback.
            </p>
          ) : null}
          {items.length > 0 && !items.every(isDraftItemComplete) ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Lengkapi semua data barang dan foto kondisi sebelum menyelesaikan
              Buyback.
            </p>
          ) : null}
          {state.fieldErrors && Object.keys(state.fieldErrors).length > 0 ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {Object.values(state.fieldErrors)
                .slice(0, 8)
                .map((message, index) => (
                  <p key={`${message}-${index}`}>• {message}</p>
                ))}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {isSubmitting ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <CircleDollarSign className="size-5" />
            )}
            {isSubmitting ? "Memproses Buyback..." : "Selesaikan Buyback"}
          </button>
        </section>
      </form>

      {customer.isQuickCustomerDialogOpen ? (
        <PosQuickCustomerDialog
          form={customer.quickCustomerForm}
          result={customer.quickCustomerResult}
          isPending={customer.isQuickCustomerPending}
          onChange={customer.updateQuickCustomerForm}
          onCancel={customer.closeQuickCustomerDialog}
          onSubmit={submitQuickCustomer}
          onUseDuplicate={useExistingQuickCustomer}
        />
      ) : null}
    </>
  );
}

function PayoutCard({
  icon,
  title,
  helper,
  value,
  onChange,
  onFill,
  children,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  value: string;
  onChange: (value: string) => void;
  onFill: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-950">{title}</p>
            <p className="mt-0.5 !text-xs leading-4 text-[var(--muted)]">
              {helper}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onFill}
          className="shrink-0 !text-xs font-semibold text-[var(--accent)]"
        >
          Isi sisa
        </button>
      </div>
      <div className="relative mt-3">
        <span className="absolute left-3 top-3 text-xs font-semibold text-neutral-500">
          Rp
        </span>
        <input
          value={value}
          onChange={(event) => onChange(formatRupiahInput(event.target.value))}
          inputMode="numeric"
          className={cn(inputClassName, "pl-9")}
          placeholder="0"
        />
      </div>
      {children}
    </div>
  );
}
