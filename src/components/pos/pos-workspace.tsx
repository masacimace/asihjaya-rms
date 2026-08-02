"use client";

import {
  BadgePercent,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LoaderCircle,
  Mail,
  Pause,
  Phone,
  Plus,
  ShoppingBag,
  StopCircle,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import {
  closePosShiftAction,
  completePosCheckoutAction,
  createPosQuickCustomerAction,
  getPosDiscountApprovalStatusAction,
  getPosManualPaymentApprovalStatusAction,
  holdPosCartAction,
  lookupPosScanValueAction,
  openPosShiftAction,
  requestPosDiscountApprovalAction,
  uploadPosPaymentEvidenceAction,
} from "@/app/actions/pos";
import { CameraScannerModal } from "@/components/scanner/camera-scanner-modal";
import { PosCartContent } from "@/components/pos/workspace/pos-cart-content";
import { PosCatalogPanel } from "@/components/pos/workspace/pos-catalog-panel";
import {
  initialPosShiftActionState,
  type PosAvailableItem,
  type PosCategoryOption,
  type PosCheckoutActionResult,
  type PosCustomerOption,
  type PosDiscountApprovalActionResult,
  type PosManualPaymentApproval,
  type PosManualPaymentMethod,
  type PosManualPaymentPolicy,
  type PosManualPaymentProfile,
  type PosOperationalContext,
  type PosQuickCustomerActionResult,
  type PosShiftActionState,
} from "@/features/pos/contracts";
import {
  getCheckoutSubmissionValidationMessage,
  type ActiveDiscountApproval,
  type StoredCheckoutAttemptState,
} from "@/features/pos/checkout-client-state";
import {
  getPosCartAddIssue,
  removePosCartItem,
} from "@/features/pos/cart-state";
import {
  getStoredPosCartState,
  removeStoredPosCartState,
  saveStoredPosCartState,
} from "@/features/pos/cart-storage";
import {
  getCustomerCode,
  getCustomerContactLabel,
  type QuickCustomerFormState,
} from "@/features/pos/customer-state";
import {
  getHeldCartAvailability,
  getPendingHeldCartResumeState,
  removePendingHeldCartResumeState,
} from "@/features/pos/held-cart-state";
import {
  createPaymentDraftId,
  formatCurrency,
  formatRupiahInput,
  getPaymentConfig,
  getPaymentDraftValidationMessage,
  getProfilesForMethod,
  parseAmount,
  parsePaymentAmountInput,
  paymentMethodConfigs,
  profileSupportsMethod,
  type PaymentVerificationFormState,
  type PosPaymentDraft,
} from "@/features/pos/payment-draft";
import { usePosCart } from "@/features/pos/use-pos-cart";
import { usePosCheckout } from "@/features/pos/use-pos-checkout";
import { usePosCustomer } from "@/features/pos/use-pos-customer";
import { usePosHeldCart } from "@/features/pos/use-pos-held-cart";
import { usePosPayment } from "@/features/pos/use-pos-payment";
import { usePosScanner } from "@/features/pos/use-pos-scanner";
import { cn } from "@/lib/utils";

type PosWorkspaceProps = {
  categories: PosCategoryOption[];
  items: PosAvailableItem[];
  customers: PosCustomerOption[];
  paymentProfiles: PosManualPaymentProfile[];
  paymentPolicies: PosManualPaymentPolicy[];
  context: PosOperationalContext;
  canManageShifts: boolean;
};

type PaymentContentProps = {
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

type CheckoutSuccessContentProps = {
  sale: Extract<PosCheckoutActionResult, { status: "success" }>["sale"];
  onStartNewTransaction: () => void;
};

type PosPanelMode = "cart" | "payment" | "success";

function getDiscountApprovalErrorMessage(
  result: Extract<PosDiscountApprovalActionResult, { status: "error" }>,
) {
  const fieldErrorMessages = Object.values(result.fieldErrors ?? {}).filter(
    Boolean,
  );

  if (fieldErrorMessages.length === 0) {
    return result.message;
  }

  return `${result.message} ${fieldErrorMessages.join(" ")}`;
}

function formatVarianceAmount(amount: number) {
  if (amount > 0) {
    return `+${formatCurrency(amount)}`;
  }

  if (amount < 0) {
    return `-${formatCurrency(Math.abs(amount))}`;
  }

  return formatCurrency(0);
}

function ActionMessage({ state }: { state: PosShiftActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        state.status === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {state.message}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-1.5 text-xs text-red-600">{message}</p>;
}

function CurrencyFormInput({
  name,
  placeholder,
  className,
  onValueChange,
}: {
  name: string;
  placeholder: string;
  className?: string;
  onValueChange?: (numericValue: number | null) => void;
}) {
  const [displayValue, setDisplayValue] = useState("");

  function handleChange(value: string) {
    const nextDisplayValue = formatRupiahInput(value);
    const numericValue = nextDisplayValue.replace(/[^0-9]/g, "");

    setDisplayValue(nextDisplayValue);
    onValueChange?.(numericValue ? Number(numericValue) : null);
  }

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={displayValue.replace(/[^0-9]/g, "")}
      />
      <input
        value={displayValue}
        onChange={(event) => handleChange(event.target.value)}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={className}
      />
    </>
  );
}

function OpenShiftSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Membuka shift...
        </>
      ) : (
        <>
          <Clock3 className="size-4" />
          Buka Shift
        </>
      )}
    </button>
  );
}

function CloseShiftSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" />
          Menutup shift...
        </>
      ) : (
        <>
          <StopCircle className="size-4" />
          Closing Shift
        </>
      )}
    </button>
  );
}

function formatOpenedAt(value: Date | string) {
  const openedAt = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(openedAt.getTime())) {
    return "waktu tidak diketahui";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(openedAt);
}

type QuickCustomerDialogProps = {
  form: QuickCustomerFormState;
  result: PosQuickCustomerActionResult | null;
  isPending: boolean;
  onChange: (field: keyof QuickCustomerFormState, value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onUseDuplicate: (customer: PosCustomerOption) => void;
};

function QuickCustomerDialog({
  form,
  result,
  isPending,
  onChange,
  onCancel,
  onSubmit,
  onUseDuplicate,
}: QuickCustomerDialogProps) {
  const fieldErrors = result?.status === "error" ? result.fieldErrors : null;
  const duplicateCustomer =
    result?.status === "duplicate" ? result.customer : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Tutup form tambah customer"
        onClick={onCancel}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      />

      <section className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-white sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-neutral-950">
                  Tambah customer cepat
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  Customer langsung dipilih tanpa meninggalkan transaksi.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Tutup form tambah customer"
            onClick={onCancel}
            disabled={isPending}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-neutral-500 transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-800">
                Nama lengkap <span className="text-red-600">*</span>
              </span>
              <div
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl border bg-white px-3 focus-within:ring-4",
                  fieldErrors?.fullName
                    ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-50"
                    : "border-[var(--border)] focus-within:border-[var(--accent)] focus-within:ring-[var(--accent-soft)]",
                )}
              >
                <UserRound className="size-4 shrink-0 text-neutral-400" />
                <input
                  autoFocus
                  value={form.fullName}
                  onChange={(event) => onChange("fullName", event.target.value)}
                  maxLength={180}
                  autoComplete="name"
                  placeholder="Contoh: Rosalia Manda"
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                />
              </div>
              {fieldErrors?.fullName ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.fullName}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-800">
                Nomor telepon <span className="text-red-600">*</span>
              </span>
              <div
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl border bg-white px-3 focus-within:ring-4",
                  fieldErrors?.phone
                    ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-50"
                    : "border-[var(--border)] focus-within:border-[var(--accent)] focus-within:ring-[var(--accent-soft)]",
                )}
              >
                <Phone className="size-4 shrink-0 text-neutral-400" />
                <input
                  value={form.phone}
                  onChange={(event) => onChange("phone", event.target.value)}
                  maxLength={32}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Contoh: 081234567890"
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Dipakai untuk mencegah customer tercatat dua kali.
              </p>
              {fieldErrors?.phone ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.phone}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-800">
                Email <span className="text-[var(--muted)]">(opsional)</span>
              </span>
              <div
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl border bg-white px-3 focus-within:ring-4",
                  fieldErrors?.email
                    ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-50"
                    : "border-[var(--border)] focus-within:border-[var(--accent)] focus-within:ring-[var(--accent-soft)]",
                )}
              >
                <Mail className="size-4 shrink-0 text-neutral-400" />
                <input
                  value={form.email}
                  onChange={(event) => onChange("email", event.target.value)}
                  maxLength={254}
                  inputMode="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  className="min-w-0 flex-1 bg-transparent text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
                />
              </div>
              {fieldErrors?.email ? (
                <p className="mt-1.5 text-xs text-red-600">
                  {fieldErrors.email}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-neutral-800">
                Catatan singkat{" "}
                <span className="text-[var(--muted)]">(opsional)</span>
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => onChange("notes", event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Contoh: Customer baru dari kunjungan outlet."
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
            </label>

            {result ? (
              <div
                role="status"
                className={cn(
                  "rounded-2xl border p-3 text-sm leading-6",
                  result.status === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : result.status === "duplicate"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                <p className="font-medium">{result.message}</p>

                {duplicateCustomer ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                        <UserRound className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-neutral-950">
                          {duplicateCustomer.fullName}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--muted)]">
                          {getCustomerCode(duplicateCustomer)} ·{" "}
                          {getCustomerContactLabel(duplicateCustomer)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUseDuplicate(duplicateCustomer)}
                      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90"
                    >
                      <Check className="size-4" />
                      Gunakan customer ini
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <footer className="grid gap-2 border-t border-[var(--border)] bg-white p-4 sm:p-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="flex h-11 items-center justify-center bg-black rounded-xl px-4 !text-sm font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-50"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 !text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Tambahkan customer
                </>
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

type DiscountApprovalDialogProps = {
  cartItems: PosAvailableItem[];
  subtotalAmount: number;
  selectedCustomer: PosCustomerOption | null;
  amountInput: string;
  reasonInput: string;
  feedback: string | null;
  isPending: boolean;
  onAmountInputChange: (value: string) => void;
  onReasonInputChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

function DiscountApprovalDialog({
  cartItems,
  subtotalAmount,
  selectedCustomer,
  amountInput,
  reasonInput,
  feedback,
  isPending,
  onAmountInputChange,
  onReasonInputChange,
  onCancel,
  onSubmit,
}: DiscountApprovalDialogProps) {
  const parsedDiscountAmount = parsePaymentAmountInput(amountInput);
  const projectedTotalAmount = Math.max(
    subtotalAmount - parsedDiscountAmount,
    0,
  );
  const discountIsTooHigh =
    parsedDiscountAmount >= subtotalAmount && subtotalAmount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--accent)]">
                Approval Diskon POS
              </p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-950">
                Minta diskon manager/owner
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Request akan masuk ke Riwayat Approval. Diskon baru bisa dipakai
                setelah status disetujui.
              </p>
            </div>

            <button
              type="button"
              aria-label="Tutup form request diskon"
              onClick={onCancel}
              disabled={isPending}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5">
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Subtotal cart</span>
              <span className="font-semibold text-neutral-950">
                {formatCurrency(subtotalAmount)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Jumlah item</span>
              <span className="font-semibold text-neutral-950">
                {cartItems.length} item
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Customer</span>
              <span className="truncate font-semibold text-neutral-950">
                {selectedCustomer?.fullName ?? "Walk-in customer"}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Nominal diskon diminta
              </span>
              <input
                value={amountInput}
                onChange={(event) =>
                  onAmountInputChange(formatRupiahInput(event.target.value))
                }
                inputMode="numeric"
                autoComplete="off"
                placeholder="Contoh: 100.000"
                className={cn(
                  "h-12 w-full rounded-2xl border bg-white px-4 text-base font-semibold text-neutral-950 outline-none transition placeholder:text-sm placeholder:font-normal placeholder:text-neutral-400 focus:ring-4",
                  discountIsTooHigh
                    ? "border-red-300 focus:border-red-400 focus:ring-red-50"
                    : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]",
                )}
              />
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Total setelah diskon: {formatCurrency(projectedTotalAmount)}.
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Alasan diskon
              </span>
              <textarea
                value={reasonInput}
                onChange={(event) => onReasonInputChange(event.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Contoh: Customer langganan, pembelian ulang, sudah disetujui negosiasi harga."
                className="w-full resize-none rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Minimal 5 karakter. Catatan ini akan terlihat di halaman
                approval.
              </p>
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-3">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Item dalam request
            </p>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {cartItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-950">
                      {index + 1}. {item.productName}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {item.sku} · {item.barcode}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-neutral-950">
                    {formatCurrency(item.sellingAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {feedback ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {feedback}
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 border-t border-[var(--border)] p-4 sm:grid-cols-[1fr_1.4fr] sm:p-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending || discountIsTooHigh}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Mengirim request...
              </>
            ) : (
              <>
                <BadgePercent className="size-4" />
                Kirim Request Diskon
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type HoldCartDialogProps = {
  cartItems: PosAvailableItem[];
  totalAmount: number;
  selectedCustomer: PosCustomerOption | null;
  titleInput: string;
  noteInput: string;
  feedback: string | null;
  isPending: boolean;
  onTitleInputChange: (value: string) => void;
  onNoteInputChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

function HoldCartDialog({
  cartItems,
  totalAmount,
  selectedCustomer,
  titleInput,
  noteInput,
  feedback,
  isPending,
  onTitleInputChange,
  onNoteInputChange,
  onCancel,
  onSubmit,
}: HoldCartDialogProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-3 backdrop-blur-xs sm:items-center sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-[var(--border)] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">
                Hold Cart
              </p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-950">
                Tahan transaksi ini?
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Item akan dikunci sementara dan tidak muncul di katalog POS
                sampai hold di-resume atau dibatalkan.
              </p>
            </div>

            <button
              type="button"
              aria-label="Tutup form hold cart"
              onClick={onCancel}
              disabled={isPending}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5">
          <div className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Total sementara</span>
              <span className="font-semibold text-neutral-950">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Jumlah item</span>
              <span className="font-semibold text-neutral-950">
                {cartItems.length} item
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[var(--muted)]">Customer</span>
              <span className="truncate font-semibold text-neutral-950">
                {selectedCustomer?.fullName ?? "Walk-in customer"}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Nama hold / catatan singkat
              </span>
              <input
                value={titleInput}
                onChange={(event) => onTitleInputChange(event.target.value)}
                maxLength={160}
                placeholder="Contoh: Bu Sari tunggu suami"
                className="h-11 w-full rounded-2xl border border-[var(--border)] bg-white px-4 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
              <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
                Opsional, tapi sangat membantu saat mencari transaksi ditahan.
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-neutral-800">
                Catatan internal
              </span>
              <textarea
                value={noteInput}
                onChange={(event) => onNoteInputChange(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Contoh: Customer cek saldo, item jangan dijual dulu."
                className="w-full resize-none rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-3">
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              Item yang dikunci
            </p>
            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
              {cartItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-950">
                      {index + 1}. {item.productName}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--muted)]">
                      {item.sku} · {item.barcode}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-neutral-950">
                    {formatCurrency(item.sellingAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {feedback ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {feedback}
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 border-t border-[var(--border)] p-4 sm:grid-cols-[1fr_1.4fr] sm:p-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Menahan transaksi...
              </>
            ) : (
              <>
                <Pause className="size-4" />
                Simpan Hold
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutSuccessContent({
  sale,
  onStartNewTransaction,
}: CheckoutSuccessContentProps) {
  return (
    <div className="flex min-h-full flex-col bg-white p-4 sm:p-5">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <div className="grid size-14 place-items-center rounded-2xl bg-white text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase text-emerald-700">
          Transaksi Berhasil
        </p>
        <h2 className="mt-2 text-xl font-semibold text-neutral-950">
          {sale.invoiceNumber}
        </h2>
        <p className="mt-2 text-sm leading-6 text-emerald-800">
          Transaksi POS sudah tersimpan, payment tercatat, dan item otomatis
          berubah menjadi terjual.
        </p>
      </div>

      <div className="mt-4 rounded-3xl border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-[var(--muted)]">Total transaksi</span>
          <span className="text-lg font-semibold text-neutral-950">
            {formatCurrency(sale.totalAmount)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-3 text-neutral-700">
            <FileText className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="font-medium text-neutral-900">
                Nota/certificate masuk antrean print
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Dokumen A4 landscape sudah dibuat dari data transaksi real
                {sale.receiptCertificateJobId
                  ? " dan dikirim ke Hardware Hub untuk silent print."
                  : ". PDF tetap bisa dibuka manual dari tombol di bawah."}
              </p>
              {sale.receiptCertificateJobId ? (
                <p className="mt-2 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
                  Job print:{" "}
                  {sale.receiptCertificateJobId.slice(0, 8).toUpperCase()}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-3 text-neutral-700">
            <ShoppingBag className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
            <div>
              <p className="font-medium text-neutral-900">
                Stok sudah diperbarui
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Item yang terjual tidak akan muncul lagi sebagai stok available
                di POS.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-[var(--border)] pt-4">
        <button
          type="button"
          onClick={onStartNewTransaction}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 font-semibold text-white transition hover:bg-[var(--accent)]/90"
        >
          Transaksi Baru
          <ChevronRight className="size-4" />
        </button>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a
            href={`/api/sales/${sale.id}/receipt-certificate`}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Buka PDF A4
          </a>
          <a
            href={`/api/sales/${sale.id}/receipt-certificate`}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Preview Cetak
          </a>
        </div>

        <p className="mt-3 text-center text-[11px] leading-5 text-[var(--muted)]">
          Jika Document Printer belum dikonfigurasi di Hardware Hub, job print
          akan terlihat failed di dashboard hardware dan PDF tetap bisa dibuka
          manual.
        </p>
      </div>
    </div>
  );
}

function PaymentContent({
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
}: PaymentContentProps) {
  const selectedConfig = getPaymentConfig(selectedMethod);
  const eligibleProfiles = getProfilesForMethod(
    paymentProfiles,
    selectedMethod,
  );
  const selectedProfile =
    eligibleProfiles.find((profile) => profile.id === selectedProfileId) ??
    null;
  const selectedPolicy = paymentPolicies.find(
    (policy) => policy.method === selectedMethod,
  );
  const parsedInputAmount = parsePaymentAmountInput(amountInput);
  const evidenceRequired = Boolean(
    selectedPolicy && parsedInputAmount >= selectedPolicy.evidenceThreshold,
  );
  const coVerificationRequired = Boolean(
    selectedPolicy &&
    parsedInputAmount >= selectedPolicy.coVerificationThreshold,
  );
  const recognizedCashAmount =
    selectedMethod === "cash"
      ? Math.min(Math.max(parsedInputAmount, 0), remainingAmount)
      : parsedInputAmount;
  const cashChangeAmount =
    selectedMethod === "cash"
      ? Math.max(parsedInputAmount - remainingAmount, 0)
      : 0;
  const hasPayments = payments.length > 0;
  const paymentProgressPercentage =
    externalPaymentDueAmount > 0
      ? Math.min((paidAmount / externalPaymentDueAmount) * 100, 100)
      : 100;
  const customerDepositBalance = selectedCustomer?.customerDepositBalance ?? 0;
  const customerDepositUsedIsTooHigh =
    customerDepositUsedAmount > Math.min(totalAmount, customerDepositBalance);
  const customerDepositControlsDisabled =
    isCheckoutPending || isAddingPayment || payments.length > 0;
  const nonCashAmountIsTooHigh =
    !selectedConfig.allowOverpayment && parsedInputAmount > remainingAmount;

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
function PosContextNotice({
  context,
  canManageShifts,
  onCloseShiftClick,
  isCloseShiftPanelOpen = false,
}: {
  context: PosOperationalContext;
  canManageShifts: boolean;
  onCloseShiftClick?: () => void;
  isCloseShiftPanelOpen?: boolean;
}) {
  if (!context.outlet) {
    return (
      <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Outlet aktif tidak ditemukan. Hubungi manager/admin untuk mengatur akses
        outlet staff ini.
      </div>
    );
  }

  if (!context.register) {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Register aktif untuk {context.outlet.name} belum tersedia. POS bisa
        menampilkan katalog, tapi transaksi belum bisa diproses.
      </div>
    );
  }

  if (!context.activeShift) {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Shift untuk register {context.register.name} belum aktif. Sales masih
        bisa melihat katalog, tetapi checkout akan diblokir sampai shift dibuka.
        {canManageShifts
          ? " Buka shift terlebih dahulu sebelum menerima pembayaran."
          : " Hubungi manager untuk membuka shift."}
      </div>
    );
  }

  const expectedCash =
    context.activeShift.expectedCash ?? context.activeShift.openingCash;

  return (
    <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600">
            <Clock3 className="size-4" />
          </div>

          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-950">
              Shift aktif · {context.register.name}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-emerald-800">
              <span>
                Jam buka: {formatOpenedAt(context.activeShift.openedAt)}
              </span>
              <span>
                Saldo Cash: {formatCurrency(context.activeShift.openingCash)}
              </span>
              <span>Expected: {formatCurrency(expectedCash)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Katalog real-time
          </span>

          {canManageShifts ? (
            <button
              type="button"
              onClick={onCloseShiftClick}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition",
                isCloseShiftPanelOpen
                  ? "bg-black text-white hover:bg-black/80"
                  : "bg-red-600 text-white hover:bg-red-700",
              )}
            >
              <StopCircle className="size-3.5" />
              {isCloseShiftPanelOpen ? "Sembunyikan" : "Menu Shift"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OpenShiftCard({ context }: { context: PosOperationalContext }) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    openPosShiftAction,
    initialPosShiftActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  if (!context.outlet || !context.register || context.activeShift) {
    return null;
  }

  return (
    <section className="mb-4 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <WalletCards className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-neutral-950">Buka Shift POS</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Shift akan dibuka untuk {context.register.name} di{" "}
            {context.outlet.name}. Semua transaksi sales HP dan Mini PC akan
            masuk ke shift aktif ini.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="registerId" value={context.register.id} />

        <ActionMessage state={state} />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Modal (Opening)
            </span>
            <CurrencyFormInput
              name="openingCash"
              placeholder="Contoh: 500.000"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <FieldError message={state.fieldErrors?.openingCash} />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Kosongkan jika tidak ada modal awal.
            </p>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Catatan (Opsional)
            </span>
            <input
              name="note"
              maxLength={240}
              placeholder="Contoh: Shift pagi outlet utama"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <FieldError message={state.fieldErrors?.note} />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Setelah shift aktif, cart bisa dilanjutkan ke payment pada phase
            berikutnya.
          </p>
          <OpenShiftSubmitButton />
        </div>
      </form>
    </section>
  );
}

function CloseShiftCard({
  context,
  onCancel,
}: {
  context: PosOperationalContext;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    closePosShiftAction,
    initialPosShiftActionState,
  );
  const [actualCashAmount, setActualCashAmount] = useState<number | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      onCancel?.();
      router.refresh();
    }
  }, [onCancel, router, state.status]);

  if (!context.outlet || !context.register || !context.activeShift) {
    return null;
  }

  const expectedCash =
    context.activeShift.expectedCash ?? context.activeShift.openingCash;
  const expectedCashAmount = parseAmount(expectedCash);
  const cashVarianceAmount =
    actualCashAmount === null ? null : actualCashAmount - expectedCashAmount;
  const cashVarianceLabel =
    cashVarianceAmount === null
      ? "Input nominal uang cash aktual untuk melihat selisih."
      : formatVarianceAmount(cashVarianceAmount);

  return (
    <section className="mb-4 rounded-2xl border border-red-100 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
          <StopCircle className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-neutral-950">
                Closing Shift POS
              </h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Rekonsiliasi kas untuk {context.register.name}. Expected cash
                sistem saat ini {formatCurrency(expectedCash)}. Setelah ditutup,
                checkout akan diblokir sampai shift baru dibuka.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="shiftId" value={context.activeShift.id} />
        <input type="hidden" name="registerId" value={context.register.id} />

        <ActionMessage state={state} />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Nominal Uang (Closing)
            </span>
            <CurrencyFormInput
              name="actualCash"
              placeholder="Contoh: 2.500.000"
              onValueChange={setActualCashAmount}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <FieldError message={state.fieldErrors?.actualCash} />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Hitung uang di laci (Cash Drawer), lalu input nominal aktual.
            </p>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-medium text-neutral-800">
              Alasan / Catatan Selisih
            </span>
            <input
              name="varianceReason"
              maxLength={500}
              placeholder="Berikan alasan jika total cash kurang / lebih dari expected cash"
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <FieldError message={state.fieldErrors?.varianceReason} />
          </label>
        </div>

        <div
          className={cn(
            "grid gap-3 rounded-2xl border p-3 text-sm sm:grid-cols-3",
            cashVarianceAmount === null
              ? "border-[var(--border)] bg-neutral-50 text-neutral-700"
              : cashVarianceAmount === 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : cashVarianceAmount > 0
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          <div>
            <p className="text-[10px] !font-medium uppercase text-current/60">
              Nominal Seharusnya
            </p>
            <p className="mt-1 !font-medium text-neutral-950">
              {formatCurrency(expectedCashAmount)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase text-current/60">
              Total Uang (Closing)
            </p>
            <p className="mt-1 !font-medium text-neutral-950">
              {actualCashAmount === null
                ? "-----"
                : formatCurrency(actualCashAmount)}
            </p>
          </div>

          <div>
            <p className="text-[10px] !font-medium uppercase text-current/60">
              Selisih Uang
            </p>
            <p className="mt-1 !font-medium text-neutral-950">
              {cashVarianceLabel}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            Expected cash dihitung dari modal awal, cash sale, kas masuk/keluar,
            dan refund cash.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:w-auto"
              >
                Batal
              </button>
            ) : null}
            <CloseShiftSubmitButton />
          </div>
        </div>
      </form>
    </section>
  );
}

export function PosWorkspace({
  categories,
  items,
  customers,
  paymentProfiles,
  paymentPolicies,
  context,
  canManageShifts,
}: PosWorkspaceProps) {
  const router = useRouter();
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isCloseShiftPanelOpen, setIsCloseShiftPanelOpen] = useState(false);
  const {
    cartItems,
    setCartItems,
    cartItemIds,
    subtotalAmount,
    setCartFeedback,
  } = usePosCart();
  const {
    selectedCustomer,
    customerQuery,
    customerOptions,
    customerSearchResults,
    isCustomerSelectorOpen,
    isQuickCustomerDialogOpen,
    quickCustomerForm,
    quickCustomerResult,
    isQuickCustomerPending,
    restoreCustomer,
    selectCustomerState,
    clearCustomerState,
    changeCustomerQuery,
    openCustomerSelector,
    closeCustomerSelectorAfterDelay,
    openQuickCustomerDialog,
    closeQuickCustomerDialog,
    updateQuickCustomerForm,
    submitQuickCustomer: submitQuickCustomerState,
    useExistingQuickCustomer: useExistingQuickCustomerState,
  } = usePosCustomer({
    customers,
    createQuickCustomer: createPosQuickCustomerAction,
  });
  const {
    searchQuery,
    setSearchQuery,
    isScannerOpen,
    setIsScannerOpen,
    isScanLookupPending,
    lookupScannedItem,
  } = usePosScanner({
    lookupScanValue: lookupPosScanValueAction,
    onItemFound: addItemToCart,
    onFeedback: setCartFeedback,
  });
  const [panelMode, setPanelMode] = useState<PosPanelMode>("cart");
  const {
    payments,
    setPayments,
    selectedMethod,
    selectedPaymentProfileId,
    paymentVerificationConfirmed,
    setPaymentVerificationConfirmed,
    paymentAmountInput,
    setPaymentAmountInput,
    customerDepositUsedInput,
    setCustomerDepositUsedInput,
    customerDepositInInput,
    setCustomerDepositInInput,
    paymentProviderInput,
    setPaymentProviderInput,
    paymentReferenceInput,
    setPaymentReferenceInput,
    paymentNoteInput,
    setPaymentNoteInput,
    paymentVerificationForm,
    paymentEvidenceFile,
    setPaymentEvidenceFile,
    manualPaymentApproval,
    setManualPaymentApproval,
    paymentFeedback,
    setPaymentFeedback,
    isAddingPayment,
    startAddingPaymentTransition,
    resetCustomerDepositDraft,
    resetPaymentForm,
    resetPaymentState,
    restoreCheckoutPaymentState,
    selectPaymentProfile,
    changePaymentMethod,
    updatePaymentVerificationForm,
  } = usePosPayment({ paymentProfiles });
  const [discountApproval, setDiscountApproval] =
    useState<ActiveDiscountApproval | null>(null);
  const [discountFeedback, setDiscountFeedback] = useState<string | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountAmountInput, setDiscountAmountInput] = useState("");
  const [discountReasonInput, setDiscountReasonInput] = useState("");
  const [isDiscountPending, startDiscountTransition] = useTransition();
  const {
    isHoldDialogOpen,
    holdTitleInput,
    setHoldTitleInput,
    holdNoteInput,
    setHoldNoteInput,
    holdFeedback,
    isHoldPending,
    openHoldDialog: openHoldDialogState,
    closeHoldDialog,
    holdCurrentCart: holdCurrentCartState,
  } = usePosHeldCart({ holdCart: holdPosCartAction });

  const restoreCheckoutAttempt = useCallback(
    (attempt: StoredCheckoutAttemptState) => {
      setDiscountApproval(attempt.discountApproval);
      restoreCheckoutPaymentState({
        payments: attempt.payments,
        customerDepositUsedAmount:
          attempt.payload.customerDepositUsedAmount,
        customerDepositInAmount: attempt.payload.customerDepositInAmount,
        manualPaymentApproval: attempt.manualPaymentApproval,
      });
      setPanelMode("payment");
      setIsMobileCartOpen(true);
    },
    [
      restoreCheckoutPaymentState,
      setDiscountApproval,
      setIsMobileCartOpen,
      setPanelMode,
    ],
  );

  const handleCheckoutSuccess = useCallback(() => {
    setPaymentFeedback(null);
    setCartFeedback(null);
    resetCustomerDepositDraft();
    setCartItems([]);
    clearCustomerState();
    resetPaymentState();
    setDiscountApproval(null);
    setDiscountFeedback(null);
    setPanelMode("success");
    setIsMobileCartOpen(true);
    router.refresh();
  }, [
    clearCustomerState,
    resetCustomerDepositDraft,
    resetPaymentState,
    router,
    setCartFeedback,
    setCartItems,
    setDiscountApproval,
    setDiscountFeedback,
    setIsMobileCartOpen,
    setPanelMode,
    setPaymentFeedback,
  ]);

  useEffect(() => {
    const pendingResumeState = getPendingHeldCartResumeState();
    const storedCartState = pendingResumeState ? null : getStoredPosCartState();

    if (!pendingResumeState && !storedCartState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (pendingResumeState) {
        removePendingHeldCartResumeState();
        removeStoredPosCartState();
        setCartItems(pendingResumeState.items);
        restoreCustomer(pendingResumeState.heldCart.customer);
        setPayments([]);
        setPaymentFeedback(null);
        setPaymentAmountInput("");
        resetCustomerDepositDraft();
        setPaymentProviderInput("");
        setPaymentReferenceInput("");
        setPaymentNoteInput("");
        setPanelMode("cart");
        setIsMobileCartOpen(true);
        setCartFeedback(
          `Hold ${pendingResumeState.heldCart.holdNumber} berhasil dimasukkan kembali ke cart.`,
        );
        router.refresh();
        return;
      }

      if (!storedCartState) {
        return;
      }

      setCartItems(storedCartState.items);
      restoreCustomer(storedCartState.customer);

      if (storedCartState.items.length > 0) {
        setCartFeedback("Cart POS terakhir dipulihkan dari sesi browser ini.");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    resetCustomerDepositDraft,
    restoreCustomer,
    router,
    setCartFeedback,
    setCartItems,
    setPaymentAmountInput,
    setPaymentFeedback,
    setPaymentNoteInput,
    setPaymentProviderInput,
    setPaymentReferenceInput,
    setPayments,
  ]);

  useEffect(() => {
    if (panelMode === "success") {
      removeStoredPosCartState();
      return;
    }

    saveStoredPosCartState({
      items: cartItems,
      customer: selectedCustomer,
    });
  }, [cartItems, panelMode, selectedCustomer]);

  const {
    checkoutResult,
    isCheckoutPending,
    isCheckoutRecovering,
    isManualApprovalChecking,
    clearCheckoutResult,
    invalidateCheckoutAttempt,
    processCheckout,
    checkManualPaymentApproval: checkManualPaymentApprovalState,
  } = usePosCheckout({
    completeCheckout: completePosCheckoutAction,
    getManualPaymentApprovalStatus:
      getPosManualPaymentApprovalStatusAction,
    restoreCheckoutAttempt,
    onCheckoutSuccess: handleCheckoutSuccess,
    setManualPaymentApproval,
    setPaymentFeedback,
  });

  const approvedDiscountAmount =
    discountApproval?.status === "approved"
      ? discountApproval.discountAmount
      : 0;
  const totalAmount = Math.max(subtotalAmount - approvedDiscountAmount, 0);
  const hasPendingDiscountApproval = discountApproval?.status === "pending";
  const canRequestDiscount =
    panelMode === "cart" &&
    cartItems.length > 0 &&
    payments.length === 0 &&
    subtotalAmount > 0 &&
    !discountApproval &&
    Boolean(context.register) &&
    Boolean(context.activeShift);
  const discountDisabledReason = !cartItems.length
    ? "Tambahkan item sebelum meminta diskon."
    : payments.length > 0
      ? "Diskon harus diajukan sebelum payment ditambahkan."
      : !context.register
        ? "Register aktif belum tersedia untuk outlet ini."
        : !context.activeShift
          ? "Shift aktif belum dibuka, request diskon belum bisa dibuat."
          : discountApproval
            ? "Selesaikan atau reset request diskon yang sedang aktif."
            : "Minta approval diskon manager/owner.";
  const customerDepositBalance = selectedCustomer?.customerDepositBalance ?? 0;
  const rawCustomerDepositUsedAmount = parsePaymentAmountInput(
    customerDepositUsedInput,
  );
  const rawCustomerDepositInAmount = parsePaymentAmountInput(
    customerDepositInInput,
  );
  const customerDepositUsedAmount = selectedCustomer
    ? Math.min(
        rawCustomerDepositUsedAmount,
        totalAmount,
        customerDepositBalance,
      )
    : 0;
  const customerDepositInAmount = selectedCustomer
    ? rawCustomerDepositInAmount
    : 0;
  const externalPaymentDueAmount = Math.max(
    totalAmount - customerDepositUsedAmount + customerDepositInAmount,
    0,
  );
  const paidAmount = useMemo(
    () => payments.reduce((total, payment) => total + payment.amount, 0),
    [payments],
  );
  const remainingAmount = Math.max(externalPaymentDueAmount - paidAmount, 0);
  const totalChangeAmount = useMemo(
    () => payments.reduce((total, payment) => total + payment.changeAmount, 0),
    [payments],
  );
  const canCheckout =
    cartItems.length > 0 &&
    Boolean(context.register) &&
    Boolean(context.activeShift) &&
    !hasPendingDiscountApproval;
  const checkoutDisabledReason = !cartItems.length
    ? "Tambahkan minimal satu item sebelum lanjut ke pembayaran."
    : !context.register
      ? "Register aktif belum tersedia untuk outlet ini."
      : !context.activeShift
        ? "Shift aktif belum dibuka, checkout belum bisa dilanjutkan."
        : hasPendingDiscountApproval
          ? "Request diskon masih pending. Cek status approval atau reset request."
          : "Lanjutkan ke pembayaran manual.";
  const canFinalizePayment =
    canCheckout &&
    remainingAmount === 0 &&
    (payments.length > 0 || customerDepositUsedAmount > 0) &&
    rawCustomerDepositUsedAmount === customerDepositUsedAmount;
  const {
    canHoldCart,
    disabledReason: holdCartDisabledReason,
  } = getHeldCartAvailability({
    panelMode,
    itemCount: cartItems.length,
    paymentCount: payments.length,
    hasDiscountApproval: Boolean(discountApproval),
    hasRegister: Boolean(context.register),
    hasActiveShift: Boolean(context.activeShift),
  });

  function resetPayments() {
    invalidateCheckoutAttempt();
    resetPaymentState();
    clearCheckoutResult();
  }

  function resetPaymentFlow() {
    setPanelMode("cart");
    resetPayments();
    resetCustomerDepositDraft();
  }

  function clearDiscountApproval(message?: string) {
    setDiscountApproval(null);
    setDiscountAmountInput("");
    setDiscountReasonInput("");
    setDiscountFeedback(message ?? null);
    resetPaymentFlow();
  }

  function openDiscountDialog() {
    if (!canRequestDiscount) {
      setDiscountFeedback(discountDisabledReason);
      return;
    }

    setDiscountAmountInput("");
    setDiscountReasonInput("");
    setDiscountFeedback(null);
    setIsDiscountDialogOpen(true);
  }

  function closeDiscountDialog() {
    if (isDiscountPending) {
      return;
    }

    setIsDiscountDialogOpen(false);
  }

  function requestDiscountApproval() {
    if (!canRequestDiscount) {
      setDiscountFeedback(discountDisabledReason);
      return;
    }

    const discountAmount = parsePaymentAmountInput(discountAmountInput);
    const reason = discountReasonInput.trim();

    if (!Number.isSafeInteger(discountAmount) || discountAmount <= 0) {
      setDiscountFeedback("Nominal diskon harus lebih dari Rp0.");
      return;
    }

    if (discountAmount >= subtotalAmount) {
      setDiscountFeedback(
        "Nominal diskon harus lebih kecil dari subtotal transaksi.",
      );
      return;
    }

    if (reason.length < 5) {
      setDiscountFeedback("Alasan diskon minimal 5 karakter.");
      return;
    }

    setDiscountFeedback("Mengirim request diskon...");

    startDiscountTransition(async () => {
      const result = await requestPosDiscountApprovalAction({
        itemIds: cartItems.map((item) => item.id),
        discountAmount,
        reason,
        customerId: selectedCustomer?.id ?? null,
      });

      if (result.status === "error") {
        setDiscountFeedback(getDiscountApprovalErrorMessage(result));
        return;
      }

      setDiscountApproval(result.approval);
      setDiscountFeedback(result.message);
      setIsDiscountDialogOpen(false);
      resetPaymentFlow();
      router.refresh();
    });
  }

  function refreshDiscountApprovalStatus() {
    if (!discountApproval) {
      setDiscountFeedback("Belum ada approval diskon yang perlu dicek.");
      return;
    }

    setDiscountFeedback("Mengecek status approval diskon...");

    startDiscountTransition(async () => {
      const result = await getPosDiscountApprovalStatusAction(
        discountApproval.id,
      );

      if (result.status !== "found") {
        setDiscountFeedback(result.message);
        return;
      }

      setDiscountApproval(result.approval);
      setDiscountFeedback(result.message);
      resetPaymentFlow();
      router.refresh();
    });
  }

  function selectCustomer(customer: PosCustomerOption) {
    selectCustomerState(customer);
    clearCheckoutResult();
    resetPaymentFlow();
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback(
        "Request diskon direset karena customer transaksi berubah.",
      );
    }
    setCartFeedback(
      `Customer ${customer.fullName} dipilih untuk transaksi ini.`,
    );
  }

  function submitQuickCustomer() {
    submitQuickCustomerState((customer, message) => {
      selectCustomer(customer);
      setCartFeedback(message);
    });
  }

  function useExistingQuickCustomer(customer: PosCustomerOption) {
    useExistingQuickCustomerState(customer, selectCustomer);
    setCartFeedback(
      `Customer ${customer.fullName} yang sudah terdaftar dipilih untuk transaksi ini.`,
    );
  }

  function clearSelectedCustomer() {
    const customerName = selectedCustomer?.fullName;

    clearCustomerState();
    clearCheckoutResult();
    resetPaymentFlow();
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback(
        "Request diskon direset karena customer transaksi berubah.",
      );
    }

    if (customerName) {
      setCartFeedback(`Customer ${customerName} dihapus dari transaksi.`);
    }
  }

  function handleCustomerQueryChange(value: string) {
    const customerWasCleared = changeCustomerQuery(value);

    if (!customerWasCleared) {
      return;
    }

    resetPaymentFlow();
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback(
        "Request diskon direset karena customer transaksi berubah.",
      );
    }
  }

  function clearCart() {
    setCartItems([]);
    clearCustomerState();
    clearCheckoutResult();
    resetPaymentFlow();
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback(null);
    }
    setCartFeedback("Keranjang transaksi direset.");
  }

  function openHoldDialog() {
    openHoldDialogState({
      canHoldCart,
      disabledReason: holdCartDisabledReason,
      defaultTitle: selectedCustomer?.fullName ?? "",
      onUnavailable: setCartFeedback,
    });
  }

  function holdCurrentCart() {
    holdCurrentCartState({
      canHoldCart,
      disabledReason: holdCartDisabledReason,
      itemIds: cartItems.map((item) => item.id),
      customerId: selectedCustomer?.id ?? null,
      onSuccess: (result) => {
        setCartItems([]);
        clearCustomerState();
        clearCheckoutResult();
        resetPaymentFlow();
        removeStoredPosCartState();
        setCartFeedback(result.message);
        router.refresh();
      },
    });
  }

  function addItemToCart(item: PosAvailableItem) {
    const addIssue = getPosCartAddIssue({ item, itemIds: cartItemIds });

    if (addIssue) {
      setCartFeedback(addIssue.message);
      return;
    }

    setCartItems((currentItems) => [...currentItems, item]);
    clearCheckoutResult();
    resetPaymentFlow();
    if (discountApproval) {
      setDiscountApproval(null);
      setDiscountFeedback("Request diskon direset karena cart berubah.");
    }
    setCartFeedback(`${item.sku} ditambahkan ke keranjang.`);
  }

  function removeItemFromCart(itemId: string) {
    setCartItems((currentItems) => {
      const result = removePosCartItem(currentItems, itemId);

      if (result.status === "removed") {
        resetPaymentFlow();
        if (discountApproval) {
          setDiscountApproval(null);
          setDiscountFeedback("Request diskon direset karena cart berubah.");
        }
        setCartFeedback(`${result.removedItem.sku} dihapus dari keranjang.`);
      }

      return result.items;
    });
  }

  function continueToPayment() {
    if (!canCheckout) {
      setCartFeedback(checkoutDisabledReason);
      return;
    }

    setPanelMode("payment");
    setPaymentFeedback(null);
    setPaymentAmountInput(formatRupiahInput(remainingAmount || totalAmount));
    setCartFeedback(null);
  }

  function addPayment() {
    if (!canCheckout) {
      setPaymentFeedback(checkoutDisabledReason);
      return;
    }

    if (remainingAmount <= 0) {
      setPaymentFeedback(
        "Pembayaran sudah lunas. Tidak perlu menambah payment.",
      );
      return;
    }

    const config = getPaymentConfig(selectedMethod);
    const selectedProfile = paymentProfiles.find(
      (profile) =>
        profile.id === selectedPaymentProfileId &&
        profileSupportsMethod(profile, selectedMethod),
    );
    const selectedPolicy = paymentPolicies.find(
      (policy) => policy.method === selectedMethod,
    );
    const inputAmount = parsePaymentAmountInput(paymentAmountInput);
    const provider =
      selectedProfile?.provider.trim() ?? paymentProviderInput.trim();
    const reference = paymentReferenceInput.trim();
    const note = paymentNoteInput.trim();

    if (rawCustomerDepositUsedAmount !== customerDepositUsedAmount) {
      setPaymentFeedback(
        "Dana Titip digunakan tidak boleh melebihi saldo customer atau total belanja.",
      );
      return;
    }

    if (!Number.isFinite(inputAmount) || inputAmount <= 0) {
      setPaymentFeedback("Nominal pembayaran harus lebih dari Rp0.");
      return;
    }

    if (!config.allowOverpayment && inputAmount > remainingAmount) {
      setPaymentFeedback(
        `${config.label} tidak boleh lebih besar dari sisa bayar ${formatCurrency(remainingAmount)}.`,
      );
      return;
    }

    if (selectedMethod !== "cash" && !selectedProfile) {
      setPaymentFeedback(
        "Pilih akun atau terminal pembayaran yang sudah dikonfigurasi.",
      );
      return;
    }

    if (selectedMethod !== "cash" && !paymentVerificationConfirmed) {
      setPaymentFeedback(
        "Konfirmasi bahwa pembayaran sudah terlihat berhasil di terminal EDC outlet.",
      );
      return;
    }

    if (
      selectedMethod !== "cash" &&
      selectedPolicy &&
      !selectedPolicy.isEnabled
    ) {
      setPaymentFeedback(
        "Metode pembayaran ini sedang dinonaktifkan oleh manager.",
      );
      return;
    }

    if (config.requiresReference && !reference) {
      setPaymentFeedback(
        `${config.referenceLabel ?? "Reference"} wajib diisi.`,
      );
      return;
    }

    if (provider.length > 80) {
      setPaymentFeedback("Provider/bank maksimal 80 karakter.");
      return;
    }

    if (reference.length > 160) {
      setPaymentFeedback("Reference number maksimal 160 karakter.");
      return;
    }

    if (note.length > 160) {
      setPaymentFeedback("Catatan payment maksimal 160 karakter.");
      return;
    }

    if (selectedMethod !== "cash") {
      if (!paymentVerificationForm.providerPaidAtLocal) {
        setPaymentFeedback("Waktu pembayaran dari provider wajib diisi.");
        return;
      }

      if (
        paymentVerificationForm.cardLast4 &&
        !/^\d{4}$/.test(paymentVerificationForm.cardLast4)
      ) {
        setPaymentFeedback("Last 4 kartu harus terdiri dari empat angka.");
        return;
      }

      if (
        selectedPolicy &&
        inputAmount >= selectedPolicy.evidenceThreshold &&
        !paymentEvidenceFile
      ) {
        setPaymentFeedback(
          `Bukti pembayaran wajib untuk nominal minimal ${formatCurrency(selectedPolicy.evidenceThreshold)}.`,
        );
        return;
      }
    }

    startAddingPaymentTransition(async () => {
      let evidenceKey: string | null = null;

      if (selectedMethod !== "cash" && paymentEvidenceFile) {
        setPaymentFeedback("Mengunggah bukti pembayaran...");
        const formData = new FormData();
        formData.set("file", paymentEvidenceFile);
        const uploadResult = await uploadPosPaymentEvidenceAction(formData);

        if (uploadResult.status === "error") {
          setPaymentFeedback(uploadResult.message);
          return;
        }

        evidenceKey = uploadResult.evidenceKey;
      }

      const recognizedAmount =
        selectedMethod === "cash"
          ? Math.min(inputAmount, remainingAmount)
          : inputAmount;
      const changeAmount =
        selectedMethod === "cash"
          ? Math.max(inputAmount - remainingAmount, 0)
          : 0;
      const nextRemainingAmount = Math.max(
        remainingAmount - recognizedAmount,
        0,
      );
      const providerPaidAtIso =
        selectedMethod === "cash"
          ? null
          : new Date(paymentVerificationForm.providerPaidAtLocal).toISOString();

      invalidateCheckoutAttempt();
      setManualPaymentApproval(null);
      setPayments((currentPayments) => [
        ...currentPayments,
        {
          id: createPaymentDraftId(),
          method: selectedMethod,
          methodLabel: config.label,
          amount: recognizedAmount,
          manualPaymentProfileId:
            selectedMethod === "cash" ? null : (selectedProfile?.id ?? null),
          manualPaymentProfileName:
            selectedMethod === "cash" ? null : (selectedProfile?.name ?? null),
          verificationConfirmed:
            selectedMethod === "cash" ? false : paymentVerificationConfirmed,
          receivedAmount: selectedMethod === "cash" ? inputAmount : null,
          changeAmount,
          provider: provider || null,
          reference: reference || null,
          note: note || null,
          verificationSource:
            selectedMethod === "cash"
              ? null
              : paymentVerificationForm.verificationSource,
          providerPaidAtIso,
          evidenceKey,
          evidenceFileName: paymentEvidenceFile?.name ?? null,
          verificationDetails:
            selectedMethod === "cash"
              ? {}
              : {
                  merchantId: paymentVerificationForm.merchantId.trim() || null,
                  terminalId: paymentVerificationForm.terminalId.trim() || null,
                  batchNumber:
                    paymentVerificationForm.batchNumber.trim() || null,
                  traceNumber:
                    paymentVerificationForm.traceNumber.trim() || null,
                  cardNetwork:
                    paymentVerificationForm.cardNetwork.trim() || null,
                  cardLast4: paymentVerificationForm.cardLast4.trim() || null,
                  senderName: paymentVerificationForm.senderName.trim() || null,
                  destinationAccount:
                    paymentVerificationForm.destinationAccount.trim() || null,
                },
        },
      ]);

      resetPaymentForm(selectedMethod);

      if (nextRemainingAmount > 0) {
        setPaymentAmountInput(formatRupiahInput(nextRemainingAmount));
      }

      setPaymentFeedback(
        changeAmount > 0
          ? `${config.label} ditambahkan. Kembalian ${formatCurrency(changeAmount)}.`
          : `${config.label} ${formatCurrency(recognizedAmount)} ditambahkan.`,
      );
    });
  }

  function removePayment(paymentId: string) {
    invalidateCheckoutAttempt();
    setManualPaymentApproval(null);
    setPayments((currentPayments) =>
      currentPayments.filter((payment) => payment.id !== paymentId),
    );
    setPaymentFeedback("Payment dihapus. Periksa kembali sisa bayar.");
  }

  function checkManualPaymentApproval() {
    checkManualPaymentApprovalState(manualPaymentApproval);
  }

  function finalizePayment() {
    const paymentValidationMessage = getPaymentDraftValidationMessage({
      payments,
      totalAmount: externalPaymentDueAmount,
    });
    const validationMessage = getCheckoutSubmissionValidationMessage({
      rawCustomerDepositUsedAmount,
      customerDepositUsedAmount,
      canFinalizePayment,
      paymentValidationMessage,
    });

    if (validationMessage) {
      setPaymentFeedback(validationMessage);
      return;
    }

    processCheckout({
      itemIds: cartItems.map((item) => item.id),
      payments,
      customerDepositUsedAmount,
      customerDepositInAmount,
      manualPaymentApproval,
      customerId: selectedCustomer?.id ?? null,
      discountApproval,
      approvedDiscountAmount,
    });
  }

  const cartContent = (
    <PosCartContent
      cartItems={cartItems}
      subtotalAmount={subtotalAmount}
      discountAmount={approvedDiscountAmount}
      totalAmount={totalAmount}
      discountApproval={discountApproval}
      isDiscountPending={isDiscountPending}
      discountFeedback={discountFeedback}
      canRequestDiscount={canRequestDiscount}
      discountDisabledReason={discountDisabledReason}
      canCheckout={canCheckout}
      checkoutDisabledReason={checkoutDisabledReason}
      customers={customerOptions}
      selectedCustomer={selectedCustomer}
      customerQuery={customerQuery}
      customerSearchResults={customerSearchResults}
      isCustomerSelectorOpen={isCustomerSelectorOpen}
      onCustomerQueryChange={handleCustomerQueryChange}
      onCustomerInputFocus={openCustomerSelector}
      onCustomerInputBlur={closeCustomerSelectorAfterDelay}
      onOpenQuickCustomer={openQuickCustomerDialog}
      onSelectCustomer={selectCustomer}
      onClearCustomer={clearSelectedCustomer}
      onRemoveItem={removeItemFromCart}
      onClearCart={clearCart}
      onOpenDiscountDialog={openDiscountDialog}
      onRefreshDiscountApproval={refreshDiscountApprovalStatus}
      onClearDiscountApproval={() =>
        clearDiscountApproval("Request diskon direset dari cart.")
      }
      onContinueToPayment={continueToPayment}
      canHoldCart={canHoldCart}
      holdCartDisabledReason={holdCartDisabledReason}
      onOpenHoldDialog={openHoldDialog}
    />
  );

  const paymentContent = (
    <PaymentContent
      totalAmount={totalAmount}
      customerDepositUsedAmount={customerDepositUsedAmount}
      customerDepositInAmount={customerDepositInAmount}
      externalPaymentDueAmount={externalPaymentDueAmount}
      paidAmount={paidAmount}
      remainingAmount={remainingAmount}
      totalChangeAmount={totalChangeAmount}
      payments={payments}
      selectedCustomer={selectedCustomer}
      customerDepositUsedInput={customerDepositUsedInput}
      customerDepositInInput={customerDepositInInput}
      paymentProfiles={paymentProfiles}
      paymentPolicies={paymentPolicies}
      selectedMethod={selectedMethod}
      selectedProfileId={selectedPaymentProfileId}
      verificationConfirmed={paymentVerificationConfirmed}
      amountInput={paymentAmountInput}
      referenceInput={paymentReferenceInput}
      noteInput={paymentNoteInput}
      verificationForm={paymentVerificationForm}
      evidenceFileName={paymentEvidenceFile?.name ?? null}
      manualPaymentApproval={manualPaymentApproval}
      paymentFeedback={paymentFeedback}
      canFinalizePayment={canFinalizePayment}
      isCheckoutPending={isCheckoutPending || isCheckoutRecovering}
      isAddingPayment={isAddingPayment}
      isApprovalChecking={isManualApprovalChecking}
      onBackToCart={() => setPanelMode("cart")}
      onMethodChange={(method) => changePaymentMethod(method, remainingAmount)}
      onProfileChange={selectPaymentProfile}
      onVerificationConfirmedChange={setPaymentVerificationConfirmed}
      onAmountInputChange={setPaymentAmountInput}
      onCustomerDepositUsedInputChange={(value) => {
        if (payments.length > 0) {
          setPaymentFeedback(
            "Reset daftar pembayaran sebelum mengubah Dana Titip.",
          );
          return;
        }

        invalidateCheckoutAttempt();
        setCustomerDepositUsedInput(value);
        setPaymentAmountInput("");
      }}
      onCustomerDepositInInputChange={(value) => {
        if (payments.length > 0) {
          setPaymentFeedback(
            "Reset daftar pembayaran sebelum mengubah Dana Titip.",
          );
          return;
        }

        invalidateCheckoutAttempt();
        setCustomerDepositInInput(value);
        setPaymentAmountInput("");
      }}
      onReferenceInputChange={setPaymentReferenceInput}
      onNoteInputChange={setPaymentNoteInput}
      onVerificationFormChange={updatePaymentVerificationForm}
      onEvidenceFileChange={setPaymentEvidenceFile}
      onCheckManualPaymentApproval={checkManualPaymentApproval}
      onAddPayment={addPayment}
      onRemovePayment={removePayment}
      onResetPayments={resetPayments}
      onFinalizePayment={finalizePayment}
    />
  );

  const successContent = checkoutResult ? (
    <CheckoutSuccessContent
      sale={checkoutResult}
      onStartNewTransaction={() => {
        invalidateCheckoutAttempt();
        clearCheckoutResult();
        setCartFeedback(null);
        setPaymentFeedback(null);
        clearCustomerState();
        resetCustomerDepositDraft();
        setPanelMode("cart");
        setIsMobileCartOpen(false);
      }}
    />
  ) : null;

  const sidePanelContent =
    panelMode === "success" && successContent
      ? successContent
      : panelMode === "payment"
        ? paymentContent
        : cartContent;

  return (
    <>
      {isQuickCustomerDialogOpen ? (
        <QuickCustomerDialog
          form={quickCustomerForm}
          result={quickCustomerResult}
          isPending={isQuickCustomerPending}
          onChange={updateQuickCustomerForm}
          onCancel={closeQuickCustomerDialog}
          onSubmit={submitQuickCustomer}
          onUseDuplicate={useExistingQuickCustomer}
        />
      ) : null}

      {isDiscountDialogOpen ? (
        <DiscountApprovalDialog
          cartItems={cartItems}
          subtotalAmount={subtotalAmount}
          selectedCustomer={selectedCustomer}
          amountInput={discountAmountInput}
          reasonInput={discountReasonInput}
          feedback={discountFeedback}
          isPending={isDiscountPending}
          onAmountInputChange={setDiscountAmountInput}
          onReasonInputChange={setDiscountReasonInput}
          onCancel={closeDiscountDialog}
          onSubmit={requestDiscountApproval}
        />
      ) : null}

      {isHoldDialogOpen ? (
        <HoldCartDialog
          cartItems={cartItems}
          totalAmount={totalAmount}
          selectedCustomer={selectedCustomer}
          titleInput={holdTitleInput}
          noteInput={holdNoteInput}
          feedback={holdFeedback}
          isPending={isHoldPending}
          onTitleInputChange={setHoldTitleInput}
          onNoteInputChange={setHoldNoteInput}
          onCancel={closeHoldDialog}
          onSubmit={holdCurrentCart}
        />
      ) : null}

      <div className="lg:grid lg:h-[calc(100vh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        {/* Katalog */}
        <PosCatalogPanel
          categories={categories}
          items={items}
          cartItemIds={cartItemIds}
          activeCategoryId={activeCategoryId}
          isCategoryPickerOpen={isCategoryPickerOpen}
          searchQuery={searchQuery}
          onActiveCategoryChange={setActiveCategoryId}
          onCategoryPickerOpenChange={setIsCategoryPickerOpen}
          onSearchQueryChange={setSearchQuery}
          onOpenScanner={() => setIsScannerOpen(true)}
          onAddItem={addItemToCart}
        >
          <PosContextNotice
            context={context}
            canManageShifts={canManageShifts}
            isCloseShiftPanelOpen={isCloseShiftPanelOpen}
            onCloseShiftClick={() =>
              setIsCloseShiftPanelOpen((isOpen) => !isOpen)
            }
          />

          {canManageShifts ? <OpenShiftCard context={context} /> : null}

          {canManageShifts &&
          isCloseShiftPanelOpen &&
          context.activeShift ? (
            <CloseShiftCard
              context={context}
              onCancel={() => setIsCloseShiftPanelOpen(false)}
            />
          ) : null}
        </PosCatalogPanel>

        {/* Cart desktop */}
        <aside className="hidden min-h-0 overflow-y-auto bg-white lg:block">
          {sidePanelContent}
        </aside>
      </div>

      {/* Sticky cart mobile/tablet */}
      <button
        type="button"
        onClick={() => setIsMobileCartOpen(true)}
        className="fixed bottom-[124px] left-4 right-4 z-30 flex h-16 items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 text-left shadow-[0_12px_32px_rgba(0,0,0,0.14)] lg:hidden"
      >
        <div className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <ShoppingBag className="size-5" />

          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--accent)] text-[10px] font-semibold text-white">
            {cartItems.length}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--muted)]">
            {cartItems.length > 0
              ? `${cartItems.length} item di keranjang`
              : "Penjualan Saat Ini"}
          </p>

          <p className="mt-0.5 truncate text-sm font-semibold text-neutral-950">
            {formatCurrency(totalAmount)}
          </p>
        </div>

        <ChevronRight className="size-5 shrink-0 text-neutral-400" />
      </button>

      {/* Cart fullscreen mobile/tablet */}
      {isMobileCartOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white lg:hidden">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur">
            <div>
              <p className="font-semibold text-neutral-950">
                {panelMode === "success"
                  ? "Transaksi Berhasil"
                  : panelMode === "payment"
                    ? "Pembayaran Manual"
                    : "Keranjang Penjualan"}
              </p>

              <p className="text-xs text-[var(--muted)]">
                {panelMode === "success"
                  ? "Transaksi sudah tersimpan."
                  : panelMode === "payment"
                    ? "Selesaikan payment dan simpan transaksi."
                    : "Periksa item sebelum pembayaran."}
              </p>
            </div>

            <button
              type="button"
              aria-label="Tutup keranjang"
              onClick={() => setIsMobileCartOpen(false)}
              className="grid size-10 place-items-center rounded-xl text-neutral-500 hover:bg-neutral-100"
            >
              <X className="size-5" />
            </button>
          </header>

          {sidePanelContent}
        </div>
      ) : null}

      <CameraScannerModal
        isOpen={isScannerOpen}
        isProcessing={isScanLookupPending}
        onClose={() => setIsScannerOpen(false)}
        onScan={lookupScannedItem}
      />
    </>
  );
}
