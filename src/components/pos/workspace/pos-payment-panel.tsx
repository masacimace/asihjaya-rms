"use client";

import {
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  WalletCards,
  X,
} from "lucide-react";

import type {
  PosCustomerOption,
  PosManualPaymentApproval,
  PosManualPaymentMethod,
  PosManualPaymentPolicy,
  PosManualPaymentProfile,
} from "@/features/pos/contracts";
import {
  formatCurrency,
  formatRupiahInput,
  paymentMethodConfigs,
  type PaymentVerificationFormState,
  type PosPaymentDraft,
} from "@/features/pos/payment-draft";
import { getPosPaymentPanelState } from "@/features/pos/payment-panel-state";
import { cn } from "@/lib/utils";

export type PosPaymentPanelProps = {
  totalAmount: number;
  customerDepositUsedAmount: number;
  customerDepositInAmount: number;
  externalPaymentDueAmount: number;
  paidAmount: number;
  remainingAmount: number;
  totalChangeAmount: number;
  payments: PosPaymentDraft[];
  selectedCustomer: PosCustomerOption | null;
  customerDepositUsedInput: string;
  customerDepositInInput: string;
  paymentProfiles: PosManualPaymentProfile[];
  paymentPolicies: PosManualPaymentPolicy[];
  selectedMethod: PosManualPaymentMethod;
  selectedProfileId: string;
  verificationConfirmed: boolean;
  amountInput: string;
  referenceInput: string;
  noteInput: string;
  verificationForm: PaymentVerificationFormState;
  evidenceFileName: string | null;
  manualPaymentApproval: PosManualPaymentApproval | null;
  paymentFeedback: string | null;
  canFinalizePayment: boolean;
  isCheckoutPending: boolean;
  isAddingPayment: boolean;
  isApprovalChecking: boolean;
  onBackToCart: () => void;
  onMethodChange: (method: PosManualPaymentMethod) => void;
  onProfileChange: (profileId: string) => void;
  onVerificationConfirmedChange: (confirmed: boolean) => void;
  onAmountInputChange: (value: string) => void;
  onCustomerDepositUsedInputChange: (value: string) => void;
  onCustomerDepositInInputChange: (value: string) => void;
  onReferenceInputChange: (value: string) => void;
  onNoteInputChange: (value: string) => void;
  onVerificationFormChange: (
    field: keyof PaymentVerificationFormState,
    value: string,
  ) => void;
  onEvidenceFileChange: (file: File | null) => void;
  onCheckManualPaymentApproval: () => void;
  onAddPayment: () => void;
  onRemovePayment: (paymentId: string) => void;
  onResetPayments: () => void;
  onFinalizePayment: () => void;
};


export function PosPaymentPanel({
  totalAmount,
  customerDepositUsedAmount,
  customerDepositInAmount,
  externalPaymentDueAmount,
  paidAmount,
  remainingAmount,
  totalChangeAmount,
  payments,
  selectedCustomer,
  customerDepositUsedInput,
  customerDepositInInput,
  paymentProfiles,
  paymentPolicies,
  selectedMethod,
  selectedProfileId,
  verificationConfirmed,
  amountInput,
  referenceInput,
  noteInput,
  verificationForm,
  evidenceFileName,
  manualPaymentApproval,
  paymentFeedback,
  canFinalizePayment,
  isCheckoutPending,
  isAddingPayment,
  isApprovalChecking,
  onBackToCart,
  onMethodChange,
  onProfileChange,
  onVerificationConfirmedChange,
  onAmountInputChange,
  onCustomerDepositUsedInputChange,
  onCustomerDepositInInputChange,
  onReferenceInputChange,
  onNoteInputChange,
  onVerificationFormChange,
  onEvidenceFileChange,
  onCheckManualPaymentApproval,
  onAddPayment,
  onRemovePayment,
  onResetPayments,
  onFinalizePayment,
}: PosPaymentPanelProps) {
  const customerDepositBalance = selectedCustomer?.customerDepositBalance ?? 0;
  const {
    selectedConfig,
    eligibleProfiles,
    selectedProfile,
    parsedInputAmount,
    evidenceRequired,
    coVerificationRequired,
    recognizedCashAmount,
    cashChangeAmount,
    hasPayments,
    paymentProgressPercentage,
    customerDepositUsedIsTooHigh,
    customerDepositControlsDisabled,
    nonCashAmountIsTooHigh,
  } = getPosPaymentPanelState({
    totalAmount,
    customerDepositUsedAmount,
    externalPaymentDueAmount,
    paidAmount,
    remainingAmount,
    paymentsCount: payments.length,
    customerDepositBalance,
    paymentProfiles,
    paymentPolicies,
    selectedMethod,
    selectedProfileId,
    amountInput,
    isCheckoutPending,
    isAddingPayment,
  });

  return (
    <div className="flex min-h-full flex-col bg-white p-4 sm:p-5">
      <div className="border-b border-[var(--border)] pb-4">
        <button
          type="button"
          onClick={onBackToCart}
          disabled={isCheckoutPending || isAddingPayment}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-black px-3 py-1.5 !text-xs font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Keranjang
        </button>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Pembayaran
            </p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-950">
              {remainingAmount > 0
                ? "Selesaikan pembayaran"
                : "Pembayaran lunas"}
            </h2>
          </div>

          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              remainingAmount > 0
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700",
            )}
          >
            {remainingAmount > 0 ? "Belum lunas" : "Lunas"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 border-b border-[var(--border)] py-4">
        <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3">
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3 text-[var(--muted)]">
              <span>Total belanja</span>
              <span className="font-semibold text-neutral-950">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            {customerDepositInAmount > 0 ? (
              <div className="flex items-center justify-between gap-3 text-[#9a681d]">
                <span>Deposit Dana Titip</span>
                <span className="font-semibold">
                  +{formatCurrency(customerDepositInAmount)}
                </span>
              </div>
            ) : null}
            {customerDepositUsedAmount > 0 ? (
              <div className="flex items-center justify-between gap-3 text-emerald-700">
                <span>Gunakan Saldo</span>
                <span className="font-semibold">
                  -{formatCurrency(customerDepositUsedAmount)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 text-[var(--muted)]">
              <span>Tagihan eksternal</span>
              <span className="font-semibold text-neutral-950">
                {formatCurrency(externalPaymentDueAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[var(--muted)]">
              <span>Sudah dibayar</span>
              <span className="font-semibold text-neutral-950">
                {formatCurrency(paidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[var(--accent)]">
              <span className="font-semibold">Sisa bayar</span>
              <span className="text-lg font-bold">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${paymentProgressPercentage}%` }}
            />
          </div>
        </div>

        {selectedCustomer ? (
          <div className="rounded-2xl border border-[#ead7ad] bg-[#fffaf0] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  Dana Titip {selectedCustomer.fullName}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#815618]">
                  Saldo di outlet ini {formatCurrency(customerDepositBalance)}.
                  Dana Titip hanya berlaku untuk customer dan outlet ini.
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-neutral-700">
                Deposit Dana Titip
                <input
                  value={customerDepositInInput}
                  disabled={customerDepositControlsDisabled}
                  onChange={(event) =>
                    onCustomerDepositInInputChange(
                      formatRupiahInput(event.target.value),
                    )
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  className="mt-2 h-11 w-full rounded-2xl border border-[#ead7ad] bg-white px-3 text-sm font-semibold text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
              </label>

              <label className="block text-xs font-semibold text-neutral-700">
                Gunakan Saldo
                <input
                  value={customerDepositUsedInput}
                  disabled={
                    customerDepositControlsDisabled ||
                    customerDepositBalance <= 0
                  }
                  onChange={(event) =>
                    onCustomerDepositUsedInputChange(
                      formatRupiahInput(event.target.value),
                    )
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  className={cn(
                    "mt-2 h-11 w-full rounded-2xl border bg-white px-3 text-sm font-semibold text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:ring-4",
                    customerDepositUsedIsTooHigh
                      ? "border-red-300 focus:border-red-400 focus:ring-red-50"
                      : "border-[#ead7ad] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]",
                  )}
                />
              </label>
            </div>

            {customerDepositUsedIsTooHigh ? (
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                Gunakan saldo tidak boleh melebihi saldo customer atau total
                belanja.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-3 py-3 text-xs leading-5 text-[var(--muted)]">
            Pilih customer terdaftar untuk deposit atau menggunakan saldo.
          </div>
        )}

        {totalChangeAmount > 0 ? (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-emerald-700">
            <span className="text-sm font-semibold">Total kembalian</span>
            <span className="text-base font-bold">
              {formatCurrency(totalChangeAmount)}
            </span>
          </div>
        ) : null}
      </div>

      {paymentFeedback ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {paymentFeedback}
        </div>
      ) : null}

      {manualPaymentApproval ? (
        <div
          className={cn(
            "mt-4 rounded-2xl border p-3 text-xs leading-5",
            manualPaymentApproval.status === "approved"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : manualPaymentApproval.status === "rejected"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-800",
          )}
        >
          <p className="font-semibold">
            Co-verification:{" "}
            {manualPaymentApproval.status === "approved"
              ? "Disetujui"
              : manualPaymentApproval.status === "rejected"
                ? "Ditolak"
                : "Menunggu"}
          </p>
          <p className="mt-1">{manualPaymentApproval.reason}</p>
          {manualPaymentApproval.responseNotes ? (
            <p className="mt-1">
              Catatan: {manualPaymentApproval.responseNotes}
            </p>
          ) : null}
          {manualPaymentApproval.status === "pending" ? (
            <button
              type="button"
              onClick={onCheckManualPaymentApproval}
              disabled={isApprovalChecking || isCheckoutPending}
              className="mt-2 inline-flex h-9 items-center justify-center rounded-xl bg-neutral-950 px-3 font-semibold text-white disabled:opacity-50"
            >
              {isApprovalChecking ? "Mengecek..." : "Cek status verifikasi"}
            </button>
          ) : null}
        </div>
      ) : null}

      {remainingAmount > 0 ? (
        <>
          <div className="border-b border-[var(--border)] py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-950">
                Metode pembayaran
              </p>
              <span className="text-xs font-medium text-[var(--muted)]">
                {selectedConfig.shortLabel}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {paymentMethodConfigs.map((config) => (
                <button
                  key={config.method}
                  type="button"
                  onClick={() => onMethodChange(config.method)}
                  disabled={isCheckoutPending || isAddingPayment}
                  className={cn(
                    "h-7 rounded-lg border px-3 !text-xs !font-semibold transition",
                    selectedMethod === config.method
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-white text-neutral-700 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
                  )}
                >
                  {config.shortLabel}
                </button>
              ))}
            </div>

            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {selectedConfig.description}
            </p>
          </div>

          <div className="border-b border-[var(--border)] py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-950">
                Tambah pembayaran
              </p>
              <p className="text-xs font-medium text-[var(--muted)]">
                Sisa {formatCurrency(remainingAmount)}
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  {selectedConfig.amountLabel}
                </span>
                <input
                  value={amountInput}
                  disabled={isCheckoutPending || isAddingPayment}
                  onChange={(event) =>
                    onAmountInputChange(formatRupiahInput(event.target.value))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Contoh: 1.350.000"
                  className={cn(
                    "h-12 w-full rounded-2xl border bg-white px-4 text-base font-semibold text-neutral-950 outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-neutral-400 focus:ring-4",
                    nonCashAmountIsTooHigh
                      ? "border-red-300 focus:border-red-400 focus:ring-red-50"
                      : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]",
                  )}
                />
              </label>

              {selectedMethod === "cash" && parsedInputAmount > 0 ? (
                <div className="rounded-2xl bg-neutral-50 p-3 text-xs leading-5 text-[var(--muted)]">
                  <div className="flex items-center justify-between gap-3">
                    <span>Diakui sebagai pembayaran</span>
                    <span className="font-semibold text-neutral-950">
                      {formatCurrency(recognizedCashAmount)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span>Kembalian</span>
                    <span
                      className={cn(
                        "font-semibold",
                        cashChangeAmount > 0
                          ? "text-emerald-700"
                          : "text-neutral-950",
                      )}
                    >
                      {formatCurrency(cashChangeAmount)}
                    </span>
                  </div>
                </div>
              ) : null}

              {nonCashAmountIsTooHigh ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                  {selectedConfig.label} tidak boleh lebih besar dari sisa
                  bayar.
                </div>
              ) : null}

              {selectedMethod !== "cash" ? (
                <div>
                  <label className="block text-sm">
                    <span className="mb-2 flex items-center justify-between gap-3 font-medium text-neutral-800">
                      Akun / terminal pembayaran
                      <span className="text-xs font-semibold text-[var(--accent)]">
                        Wajib
                      </span>
                    </span>
                    <select
                      value={selectedProfileId}
                      disabled={isCheckoutPending || isAddingPayment}
                      onChange={(event) => onProfileChange(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                    >
                      <option value="">Pilih preset pembayaran</option>
                      {eligibleProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedProfile ? (
                    <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                      <p className="font-semibold text-neutral-950">
                        {selectedProfile.provider}
                      </p>
                      <p>Terminal: {selectedProfile.terminalId ?? "-"}</p>
                    </div>
                  ) : eligibleProfiles.length === 0 ? (
                    <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                      Belum ada preset aktif untuk metode ini. Manager perlu
                      menambahkannya dari Pengaturan → Pembayaran Manual.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {selectedConfig.referenceLabel ? (
                <label className="block text-sm">
                  <span className="mb-2 flex items-center justify-between gap-3 font-medium text-neutral-800">
                    {selectedConfig.referenceLabel}
                    {selectedConfig.requiresReference ? (
                      <span className="text-xs font-semibold text-[var(--accent)]">
                        Wajib
                      </span>
                    ) : null}
                  </span>
                  <input
                    value={referenceInput}
                    disabled={isCheckoutPending || isAddingPayment}
                    onChange={(event) =>
                      onReferenceInputChange(event.target.value)
                    }
                    maxLength={160}
                    required={selectedConfig.requiresReference}
                    placeholder={
                      selectedConfig.referencePlaceholder ?? "Nomor referensi"
                    }
                    className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  />
                </label>
              ) : null}

              {selectedMethod !== "cash" ? (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-950">
                      Konfirmasi pembayaran
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      Pastikan status berhasil terlihat di terminal EDC outlet,
                      bukan hanya dari screenshot customer.
                    </p>
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      checked={verificationConfirmed}
                      disabled={isCheckoutPending || isAddingPayment}
                      onChange={(event) =>
                        onVerificationConfirmedChange(event.target.checked)
                      }
                      className="mt-0.5 size-4 accent-[var(--accent)]"
                    />
                    <span>
                      <span className="block font-semibold text-neutral-950">
                        Pembayaran sudah terlihat berhasil
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                        Sumber verifikasi dan waktu transaksi diisi otomatis
                        dari preset serta waktu perangkat POS.
                      </span>
                    </span>
                  </label>

                  {evidenceRequired || coVerificationRequired ? (
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      {evidenceRequired ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                          Bukti wajib
                        </span>
                      ) : null}
                      {coVerificationRequired ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                          Approval manager/finance
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <details className="rounded-xl border border-[var(--border)] bg-white p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-neutral-700 marker:content-none">
                      Detail tambahan & bukti
                    </summary>

                    <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                      <label className="block text-sm">
                        <span className="mb-2 block font-medium text-neutral-800">
                          Waktu berhasil di provider
                        </span>
                        <input
                          type="datetime-local"
                          value={verificationForm.providerPaidAtLocal}
                          disabled={isCheckoutPending || isAddingPayment}
                          onChange={(event) =>
                            onVerificationFormChange(
                              "providerPaidAtLocal",
                              event.target.value,
                            )
                          }
                          className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                        />
                      </label>

                      {selectedMethod === "debit_card" ||
                      selectedMethod === "credit_card" ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm">
                            <span className="mb-2 block font-medium text-neutral-800">
                              Trace / STAN
                            </span>
                            <input
                              value={verificationForm.traceNumber}
                              disabled={isCheckoutPending || isAddingPayment}
                              onChange={(event) =>
                                onVerificationFormChange(
                                  "traceNumber",
                                  event.target.value,
                                )
                              }
                              maxLength={40}
                              placeholder="Opsional"
                              className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                            />
                          </label>
                          <label className="block text-sm">
                            <span className="mb-2 block font-medium text-neutral-800">
                              Batch number
                            </span>
                            <input
                              value={verificationForm.batchNumber}
                              disabled={isCheckoutPending || isAddingPayment}
                              onChange={(event) =>
                                onVerificationFormChange(
                                  "batchNumber",
                                  event.target.value,
                                )
                              }
                              maxLength={40}
                              placeholder="Opsional"
                              className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                            />
                          </label>
                          <label className="block text-sm sm:col-span-2">
                            <span className="mb-2 block font-medium text-neutral-800">
                              Network & last 4 kartu
                            </span>
                            <div className="grid gap-3">
                              <input
                                value={verificationForm.cardNetwork}
                                disabled={isCheckoutPending || isAddingPayment}
                                onChange={(event) =>
                                  onVerificationFormChange(
                                    "cardNetwork",
                                    event.target.value,
                                  )
                                }
                                maxLength={40}
                                placeholder="Visa / GPN (opsional)"
                                className="h-11 rounded-2xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                              />
                              <input
                                value={verificationForm.cardLast4}
                                disabled={isCheckoutPending || isAddingPayment}
                                onChange={(event) =>
                                  onVerificationFormChange(
                                    "cardLast4",
                                    event.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 4),
                                  )
                                }
                                inputMode="numeric"
                                maxLength={4}
                                placeholder="1234"
                                className="h-11 rounded-2xl border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--accent)]"
                              />
                            </div>
                          </label>
                        </div>
                      ) : null}

                      <label className="block text-sm">
                        <span className="mb-2 block font-medium text-neutral-800">
                          Foto bukti pembayaran
                          {evidenceRequired ? (
                            <span className="ml-1 text-xs font-semibold text-[var(--accent)]">
                              Wajib
                            </span>
                          ) : (
                            <span className="ml-1 text-xs text-[var(--muted)]">
                              Opsional
                            </span>
                          )}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isCheckoutPending || isAddingPayment}
                          onChange={(event) =>
                            onEvidenceFileChange(
                              event.target.files?.[0] ?? null,
                            )
                          }
                          className="block w-full rounded-2xl border border-dashed border-amber-300 bg-white px-3 py-2 text-xs text-neutral-700 file:mr-3 file:rounded-xl file:border-0 file:bg-neutral-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                        />
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {evidenceFileName
                            ? `Dipilih: ${evidenceFileName}`
                            : evidenceRequired
                              ? "Bukti diperlukan karena nominal melewati threshold."
                              : "Gunakan hanya jika pembayaran perlu bukti tambahan."}
                        </p>
                      </label>
                    </div>
                  </details>
                </div>
              ) : null}

              <label className="block text-sm">
                <span className="mb-2 block font-medium text-neutral-800">
                  Catatan / referensi tambahan
                </span>
                <input
                  value={noteInput}
                  disabled={isCheckoutPending || isAddingPayment}
                  onChange={(event) => onNoteInputChange(event.target.value)}
                  maxLength={160}
                  placeholder="Opsional"
                  className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                />
              </label>

              <button
                type="button"
                onClick={onAddPayment}
                disabled={isCheckoutPending || isAddingPayment}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <WalletCards className="size-4" />
                Tambahkan {selectedConfig.shortLabel}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="border-b border-[var(--border)] py-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  Pembayaran sudah pas
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  Form tambah pembayaran disembunyikan. Periksa daftar
                  pembayaran, lalu selesaikan transaksi.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-neutral-950">
            Daftar pembayaran
          </p>
          {hasPayments ? (
            <button
              type="button"
              onClick={onResetPayments}
              disabled={isCheckoutPending || isAddingPayment}
              className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
          ) : null}
        </div>

        {hasPayments ? (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-950">
                      {payment.methodLabel}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {payment.reference
                        ? `Ref: ${payment.reference}`
                        : payment.provider
                          ? payment.provider
                          : "Manual verified"}
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-neutral-950">
                        {formatCurrency(payment.amount)}
                      </p>
                      {payment.changeAmount > 0 ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          Kembali {formatCurrency(payment.changeAmount)}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label={`Hapus pembayaran ${payment.methodLabel}`}
                      onClick={() => onRemovePayment(payment.id)}
                      disabled={isCheckoutPending || isAddingPayment}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-neutral-50 px-4 py-5 text-center text-xs leading-5 text-[var(--muted)]">
            Belum ada pembayaran masuk. Tambahkan minimal satu pembayaran untuk
            menyelesaikan transaksi.
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-[var(--border)] pt-4">
        <button
          type="button"
          disabled={!canFinalizePayment || isCheckoutPending || isAddingPayment}
          onClick={onFinalizePayment}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold transition",
            canFinalizePayment && !isCheckoutPending && !isAddingPayment
              ? "bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
              : "cursor-not-allowed bg-neutral-200 text-neutral-500",
          )}
        >
          {isCheckoutPending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Memproses transaksi...
            </>
          ) : (
            <>
              Selesaikan Transaksi
              <ChevronRight className="size-4" />
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[11px] leading-5 text-[var(--muted)]">
          {canFinalizePayment
            ? "Payment sudah lunas. Transaksi siap disimpan dan stok akan otomatis terjual."
            : remainingAmount > 0
              ? "Tambahkan pembayaran sampai sisa bayar Rp0."
              : "Payment belum siap divalidasi."}
        </p>
      </div>
    </div>
  );
}
