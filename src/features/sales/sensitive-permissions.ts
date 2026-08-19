import { hasPermission, type AuthContext } from "@/lib/auth/session";

export const SALE_VOID_EXECUTE_PERMISSION = "sales.void.execute";
export const PAYMENT_REFUND_EXECUTE_PERMISSION = "payments.refund.execute";

export type SaleSensitiveAction = "void" | "refund";

export function getSaleSensitivePermission(action: SaleSensitiveAction): string {
  return action === "void"
    ? SALE_VOID_EXECUTE_PERMISSION
    : PAYMENT_REFUND_EXECUTE_PERMISSION;
}

export function getSaleSensitiveCapabilities(auth: AuthContext) {
  return {
    void: {
      canExecute: hasPermission(auth, SALE_VOID_EXECUTE_PERMISSION),
    },
    refund: {
      canExecute: hasPermission(auth, PAYMENT_REFUND_EXECUTE_PERMISSION),
    },
  } as const;
}
