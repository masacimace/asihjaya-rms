"use client";

import {
  BadgePercent,
  ChevronRight,
  Pause,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";

import { PosItemImage } from "@/components/pos/workspace/pos-item-image";
import { getPosItemDetail } from "@/features/pos/catalog-state";
import type {
  PosAvailableItem,
  PosCustomerOption,
  PosDiscountApproval,
} from "@/features/pos/contracts";
import {
  getCustomerCode,
  getCustomerContactLabel,
} from "@/features/pos/customer-state";
import { formatCurrency } from "@/features/pos/payment-draft";
import { cn } from "@/lib/utils";

export type PosCartContentProps = {
  cartItems: PosAvailableItem[];
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  discountApproval: PosDiscountApproval | null;
  isDiscountPending: boolean;
  discountFeedback: string | null;
  canRequestDiscount: boolean;
  discountDisabledReason: string;
  canCheckout: boolean;
  checkoutDisabledReason: string;
  customers: PosCustomerOption[];
  selectedCustomer: PosCustomerOption | null;
  customerQuery: string;
  customerSearchResults: PosCustomerOption[];
  isCustomerSelectorOpen: boolean;
  onCustomerQueryChange: (value: string) => void;
  onCustomerInputFocus: () => void;
  onCustomerInputBlur: () => void;
  onOpenQuickCustomer: () => void;
  onSelectCustomer: (customer: PosCustomerOption) => void;
  onClearCustomer: () => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onOpenDiscountDialog: () => void;
  onRefreshDiscountApproval: () => void;
  onClearDiscountApproval: () => void;
  onContinueToPayment: () => void;
  canHoldCart: boolean;
  holdCartDisabledReason: string;
  onOpenHoldDialog: () => void;
};

export function PosCartContent({
  cartItems,
  subtotalAmount,
  discountAmount,
  totalAmount,
  discountApproval,
  isDiscountPending,
  discountFeedback,
  canRequestDiscount,
  discountDisabledReason,
  canCheckout,
  checkoutDisabledReason,
  customers,
  selectedCustomer,
  customerQuery,
  customerSearchResults,
  isCustomerSelectorOpen,
  onCustomerQueryChange,
  onCustomerInputFocus,
  onCustomerInputBlur,
  onOpenQuickCustomer,
  onSelectCustomer,
  onClearCustomer,
  onRemoveItem,
  onClearCart,
  onOpenDiscountDialog,
  onRefreshDiscountApproval,
  onClearDiscountApproval,
  onContinueToPayment,
  canHoldCart,
  holdCartDisabledReason,
  onOpenHoldDialog,
}: PosCartContentProps) {
  const hasCartItems = cartItems.length > 0;
  const hasCustomers = customers.length > 0;
  const hasCustomerSearchQuery = customerQuery.trim().length > 0;

  void isDiscountPending;
  void onRefreshDiscountApproval;

  return (
    <div className="flex min-h-full flex-col bg-white p-4 sm:p-5">
      {hasCartItems ? (
        <div className="max-h-[38vh] space-y-3 overflow-y-auto pb-4 lg:max-h-none">
          {cartItems.map((item, index) => (
            <div
              key={item.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-3"
            >
              <div className="flex gap-3">
                <div className="relative shrink-0">
                  <PosItemImage
                    item={item}
                    alt={`${item.productName} ${item.sku}`}
                    className="size-14 rounded-xl"
                    iconClassName="size-7"
                  />
                  <span className="absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
                    {index + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold leading-5 text-neutral-950">
                        {item.productName}
                      </p>

                      <p className="mt-1 truncate text-[11px] text-[var(--muted)]">
                        {item.sku} · {item.barcode}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label={`Hapus ${item.productName}`}
                      onClick={() => onRemoveItem(item.id)}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    {getPosItemDetail(item)}
                  </p>

                  <p className="mt-2 text-sm font-semibold text-neutral-950">
                    {formatCurrency(item.sellingAmount)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-h-56 place-items-center border-b border-[var(--border)] py-8 text-center">
          <div>
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <ShoppingBag className="size-7" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-neutral-950">
              Belum ada item di keranjang
            </h3>
            <p className="mt-2 max-w-64 text-xs leading-5 text-[var(--muted)]">
              Pilih item dari katalog atau scan barcode lama maupun internal.
              Satu barcode mewakili satu item fisik jewelry.
            </p>
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-[var(--border)] pt-4">
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Customer
            </p>
            <button
              type="button"
              onClick={onOpenQuickCustomer}
              className="inline-flex items-center gap-1.5 !text-xs font-semibold text-[var(--accent)] transition hover:text-[var(--accent)]/80"
            >
              <Plus className="size-3.5" />
              Tambah baru
            </button>
          </div>

          {selectedCustomer ? (
            <div className="mt-3 rounded-xl border border-[var(--accent-soft)] bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <UserRound className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-950">
                    {selectedCustomer.fullName}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">
                    {getCustomerCode(selectedCustomer)} ·{" "}
                    {getCustomerContactLabel(selectedCustomer)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClearCustomer}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Hapus customer dari transaksi"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative mt-3">
              <label className="flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent-soft)]">
                <Search className="size-4 shrink-0 text-neutral-400" />

                <input
                  type="search"
                  value={customerQuery}
                  onChange={(event) =>
                    onCustomerQueryChange(event.target.value)
                  }
                  onFocus={onCustomerInputFocus}
                  onBlur={onCustomerInputBlur}
                  placeholder="Cari nama, kode, atau nomor telepon"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
                />

                <UserRound className="size-4 text-neutral-400" />
              </label>

              {isCustomerSelectorOpen ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl">
                  {customerSearchResults.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto p-1.5">
                      {customerSearchResults.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => onSelectCustomer(customer)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-neutral-50"
                        >
                          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                            <UserRound className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-neutral-950">
                              {customer.fullName}
                            </p>
                            <p className="mt-1 truncate text-xs text-[var(--muted)]">
                              {getCustomerCode(customer)} ·{" "}
                              {getCustomerContactLabel(customer)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm text-neutral-700">
                      <p className="font-medium text-neutral-950">
                        Customer tidak ditemukan
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                        Tambahkan customer tanpa meninggalkan transaksi ini.
                      </p>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={onOpenQuickCustomer}
                        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]/70"
                      >
                        <Plus className="size-4" />
                        Tambah customer baru
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {!selectedCustomer ? (
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {hasCustomers
                ? hasCustomerSearchQuery
                  ? "Pilih customer dari hasil pencarian, atau lanjutkan sebagai walk-in customer."
                  : "Opsional. Kosongkan untuk walk-in customer."
                : "Belum ada customer aktif. Transaksi tetap bisa dilanjutkan sebagai walk-in customer."}
            </p>
          ) : null}
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 text-[var(--muted)]">
            <span>Jumlah item</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-800">
                {cartItems.length} item
              </span>

              {hasCartItems ? (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between text-[var(--muted)]">
            <span>Subtotal</span>
            <span className="font-medium text-neutral-800">
              {formatCurrency(subtotalAmount)}
            </span>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Diskon</span>
              <span
                className={cn(
                  "font-semibold",
                  discountAmount > 0 ? "text-red-600" : "text-neutral-800",
                )}
              >
                {discountAmount > 0
                  ? `-${formatCurrency(discountAmount)}`
                  : formatCurrency(0)}
              </span>
            </div>

            {discountApproval ? (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-3 text-xs leading-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-emerald-700">
                      Diskon aktif
                    </p>
                    <p className="mt-1 text-[var(--muted)]">
                      {discountApproval.reason || "Tanpa catatan tambahan."}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                    AKTIF
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onClearDiscountApproval}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Hapus Diskon
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!canRequestDiscount}
                onClick={onOpenDiscountDialog}
                title={discountDisabledReason}
                className={cn(
                  "mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                  canRequestDiscount
                    ? "border-[var(--accent)] bg-white text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                    : "cursor-not-allowed border-[var(--border)] bg-neutral-100 text-neutral-400",
                )}
              >
                <BadgePercent className="size-4" />
                Tambah Diskon
              </button>
            )}

            {discountFeedback ? (
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                {discountFeedback}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <span className="text-base font-semibold text-neutral-950">
              Total
            </span>

            <span className="text-xl font-semibold text-neutral-950">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            disabled={!canCheckout}
            onClick={onContinueToPayment}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 font-semibold transition",
              canCheckout
                ? "bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
                : "cursor-not-allowed bg-neutral-200 text-neutral-500",
            )}
          >
            Lanjut ke Pembayaran
            <ChevronRight className="size-4" />
          </button>

          <button
            type="button"
            disabled={!canHoldCart}
            onClick={onOpenHoldDialog}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
              canHoldCart
                ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100"
                : "cursor-not-allowed border-[var(--border)] bg-neutral-100 text-neutral-400",
            )}
          >
            <Pause className="size-4" />
            Tahan Transaksi
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] leading-5 text-[var(--muted)]">
          {canCheckout
            ? selectedCustomer
              ? `Checkout untuk ${selectedCustomer.fullName}.`
              : "Lanjutkan sebagai walk-in customer."
            : checkoutDisabledReason}
          {hasCartItems ? (
            <>
              <br />
              {canHoldCart
                ? "Atau tahan transaksi untuk dilanjutkan nanti."
                : holdCartDisabledReason}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
