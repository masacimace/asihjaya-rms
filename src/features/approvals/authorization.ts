import type { ApprovalType } from "@/features/approvals/contracts";
import {
  hasAnyPermission,
  hasPermission,
  type AuthContext,
} from "@/lib/auth/session";

export const SALE_VOID_REQUEST_PERMISSION = "sales.void.request";
export const SALE_VOID_APPROVE_PERMISSION = "sales.void.approve";
export const SALE_VOID_EXECUTE_PERMISSION = "sales.void.execute";
export const PAYMENT_REFUND_REQUEST_PERMISSION = "payments.refund.request";
export const PAYMENT_REFUND_APPROVE_PERMISSION = "payments.refund.approve";
export const PAYMENT_REFUND_EXECUTE_PERMISSION = "payments.refund.execute";
export const MANUAL_PAYMENT_VERIFY_PERMISSION = "payments.verify.manual";

export type SaleSensitiveAction = "void" | "refund";
export type SaleSensitiveOperation = "request" | "approve" | "execute";

const saleSensitivePermissionMap = {
  void: {
    request: SALE_VOID_REQUEST_PERMISSION,
    approve: SALE_VOID_APPROVE_PERMISSION,
    execute: SALE_VOID_EXECUTE_PERMISSION,
  },
  refund: {
    request: PAYMENT_REFUND_REQUEST_PERMISSION,
    approve: PAYMENT_REFUND_APPROVE_PERMISSION,
    execute: PAYMENT_REFUND_EXECUTE_PERMISSION,
  },
} as const;

const approvalResolutionPermissionMap: Record<
  ApprovalType,
  readonly string[]
> = {
  discount: ["payments.manage"],
  void_receipt: [SALE_VOID_APPROVE_PERMISSION],
  refund_transaction: [PAYMENT_REFUND_APPROVE_PERMISSION],
  manual_payment_verification: [MANUAL_PAYMENT_VERIFY_PERMISSION],
  stock_adjustment: ["inventory.adjust"],
  other: ["settings.manage", "shifts.manage", "audit.view"],
};

const approvalVisibilityPermissionMap: Record<
  ApprovalType,
  readonly string[]
> = {
  discount: ["payments.manage"],
  void_receipt: [
    SALE_VOID_REQUEST_PERMISSION,
    SALE_VOID_APPROVE_PERMISSION,
    SALE_VOID_EXECUTE_PERMISSION,
  ],
  refund_transaction: [
    PAYMENT_REFUND_REQUEST_PERMISSION,
    PAYMENT_REFUND_APPROVE_PERMISSION,
    PAYMENT_REFUND_EXECUTE_PERMISSION,
  ],
  manual_payment_verification: [
    "payments.manage",
    MANUAL_PAYMENT_VERIFY_PERMISSION,
  ],
  stock_adjustment: ["inventory.adjust"],
  other: ["settings.manage", "shifts.manage", "audit.view"],
};

const approvalTypes: readonly ApprovalType[] = [
  "discount",
  "void_receipt",
  "refund_transaction",
  "manual_payment_verification",
  "stock_adjustment",
  "other",
];

export function getSaleSensitivePermission(
  action: SaleSensitiveAction,
  operation: SaleSensitiveOperation,
): string {
  return saleSensitivePermissionMap[action][operation];
}

export function canPerformSaleSensitiveOperation(
  auth: AuthContext,
  action: SaleSensitiveAction,
  operation: SaleSensitiveOperation,
): boolean {
  return hasPermission(auth, getSaleSensitivePermission(action, operation));
}

export function getSaleSensitiveCapabilities(auth: AuthContext) {
  return {
    void: {
      canRequest: canPerformSaleSensitiveOperation(auth, "void", "request"),
      canApprove: canPerformSaleSensitiveOperation(auth, "void", "approve"),
      canExecute: canPerformSaleSensitiveOperation(auth, "void", "execute"),
    },
    refund: {
      canRequest: canPerformSaleSensitiveOperation(auth, "refund", "request"),
      canApprove: canPerformSaleSensitiveOperation(auth, "refund", "approve"),
      canExecute: canPerformSaleSensitiveOperation(auth, "refund", "execute"),
    },
  } as const;
}

export function getApprovalResolutionPermissionCodes(
  type: ApprovalType,
): readonly string[] {
  return approvalResolutionPermissionMap[type];
}

export function getVisibleApprovalTypes(auth: AuthContext): ApprovalType[] {
  return approvalTypes.filter((type) =>
    hasAnyPermission(auth, approvalVisibilityPermissionMap[type]),
  );
}

export function canAccessApprovalInbox(auth: AuthContext): boolean {
  return getVisibleApprovalTypes(auth).length > 0;
}

export function getApprovalResolutionAuthorization({
  auth,
  type,
  requestedById,
}: {
  auth: AuthContext;
  type: ApprovalType;
  requestedById: string;
}): { allowed: true; reason: null } | { allowed: false; reason: string } {
  if (requestedById === auth.user.id) {
    return {
      allowed: false,
      reason:
        "Maker-checker aktif: requester tidak boleh menyetujui atau menolak request miliknya sendiri.",
    };
  }

  if (!hasAnyPermission(auth, getApprovalResolutionPermissionCodes(type))) {
    return {
      allowed: false,
      reason: "Akun ini tidak memiliki permission untuk memproses approval tersebut.",
    };
  }

  return { allowed: true, reason: null };
}
