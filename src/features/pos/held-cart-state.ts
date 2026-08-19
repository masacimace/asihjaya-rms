import type {
  PosHeldCartActionResult,
  PosHeldCartItem,
  PosHeldCartSummary,
} from "@/features/pos/contracts";
import { isStoredPosCartItem } from "@/features/pos/cart-storage";

export const POS_PENDING_HELD_CART_RESUME_STORAGE_KEY =
  "asihjaya:pos-workspace-pending-held-cart-resume";

export type PendingHeldCartResumeState = {
  version: 1;
  heldCart: PosHeldCartSummary;
  items: PosHeldCartItem[];
  updatedAt: string;
};

export type PosHeldCartAvailability = {
  canHoldCart: boolean;
  disabledReason: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function createPendingHeldCartResumeState({
  heldCart,
  items,
  updatedAt = new Date().toISOString(),
}: {
  heldCart: PosHeldCartSummary;
  items: PosHeldCartItem[];
  updatedAt?: string;
}): PendingHeldCartResumeState {
  return {
    version: 1,
    heldCart,
    items,
    updatedAt,
  };
}

export function parsePendingHeldCartResumeState(
  value: unknown,
  fallbackUpdatedAt = new Date().toISOString(),
): PendingHeldCartResumeState | null {
  if (
    !isRecord(value) ||
    !isRecord(value.heldCart) ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  const heldCart = value.heldCart as PosHeldCartSummary;
  const items = value.items.filter(isStoredPosCartItem) as PosHeldCartItem[];

  if (items.length === 0 || typeof heldCart.holdNumber !== "string") {
    return null;
  }

  return {
    version: 1,
    heldCart,
    items,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : fallbackUpdatedAt,
  };
}

export function getPendingHeldCartResumeState(): PendingHeldCartResumeState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      POS_PENDING_HELD_CART_RESUME_STORAGE_KEY,
    );

    if (!rawValue) {
      return null;
    }

    return parsePendingHeldCartResumeState(JSON.parse(rawValue) as unknown);
  } catch {
    window.sessionStorage.removeItem(POS_PENDING_HELD_CART_RESUME_STORAGE_KEY);
    return null;
  }
}

export function savePendingHeldCartResumeState({
  heldCart,
  items,
}: {
  heldCart: PosHeldCartSummary;
  items: PosHeldCartItem[];
}) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    POS_PENDING_HELD_CART_RESUME_STORAGE_KEY,
    JSON.stringify(createPendingHeldCartResumeState({ heldCart, items })),
  );
}

export function removePendingHeldCartResumeState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(POS_PENDING_HELD_CART_RESUME_STORAGE_KEY);
}

export function getHeldCartAvailability({
  panelMode,
  itemCount,
  paymentCount,
  hasRegister,
  hasActiveShift,
}: {
  panelMode: "cart" | "payment" | "success";
  itemCount: number;
  paymentCount: number;
  hasRegister: boolean;
  hasActiveShift: boolean;
}): PosHeldCartAvailability {
  const canHoldCart =
    panelMode === "cart" &&
    itemCount > 0 &&
    paymentCount === 0 &&
    hasRegister &&
    hasActiveShift;

  const disabledReason =
    itemCount === 0
      ? "Tambahkan minimal satu item sebelum transaksi bisa ditahan."
      : paymentCount > 0
        ? "Transaksi yang sudah memiliki payment tidak bisa ditahan. Reset payment terlebih dahulu."
        : !hasRegister
            ? "Register aktif belum tersedia untuk outlet ini."
            : !hasActiveShift
              ? "Shift aktif belum dibuka, hold cart belum bisa dibuat."
              : "Transaksi bisa ditahan.";

  return { canHoldCart, disabledReason };
}

export function getHeldCartDraftValidationMessage({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  if (title.trim().length > 160) {
    return "Nama hold maksimal 160 karakter.";
  }

  if (note.trim().length > 500) {
    return "Catatan hold maksimal 500 karakter.";
  }

  return null;
}

export function getHeldCartErrorMessage(
  result: Extract<PosHeldCartActionResult, { status: "error" }>,
) {
  const fieldErrorMessages = Object.values(result.fieldErrors ?? {}).filter(
    Boolean,
  );

  if (fieldErrorMessages.length === 0) {
    return result.message;
  }

  return `${result.message} ${fieldErrorMessages.join(" ")}`;
}
