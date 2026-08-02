import type {
  PosCheckoutActionResult,
  PosManualPaymentApproval,
} from "@/features/pos/contracts";
import { POS_CHECKOUT_RECOVERY_RETRY_AFTER_MS } from "@/features/pos/checkout/constants";

export function checkoutFailure(
  message: string,
  fieldErrors?: Record<string, string>,
  code: Extract<PosCheckoutActionResult, { status: "error" }>["code"] =
    "validation_error",
): PosCheckoutActionResult {
  return {
    status: "error",
    message,
    code,
    fieldErrors,
  };
}

export function checkoutSuccess({
  message,
  sale,
  recovery,
}: {
  message: string;
  sale: Extract<PosCheckoutActionResult, { status: "success" }>["sale"];
  recovery: Extract<
    PosCheckoutActionResult,
    { status: "success" }
  >["recovery"];
}): PosCheckoutActionResult {
  return {
    status: "success",
    message,
    sale,
    recovery,
  };
}

export function checkoutProcessing(
  idempotencyKey: string,
  message = "Transaksi masih diproses. Jangan membuat transaksi baru.",
): PosCheckoutActionResult {
  return {
    status: "processing",
    message,
    idempotencyKey,
    retryAfterMs: POS_CHECKOUT_RECOVERY_RETRY_AFTER_MS,
  };
}

export function checkoutApprovalRequired(
  approval: PosManualPaymentApproval,
  message: string,
): PosCheckoutActionResult {
  return {
    status: "approval_required",
    message,
    approval,
  };
}
