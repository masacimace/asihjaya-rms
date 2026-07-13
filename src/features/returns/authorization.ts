import { hasPermission, type AuthContext } from "@/lib/auth/session";

export const RETURN_VIEW_PERMISSION = "returns.view";
export const RETURN_RECEIVE_PERMISSION = "returns.receive";
export const RETURN_INSPECT_PERMISSION = "returns.inspect";

export function getReturnCapabilities(auth: AuthContext) {
  return {
    canView: hasPermission(auth, RETURN_VIEW_PERMISSION),
    canReceive: hasPermission(auth, RETURN_RECEIVE_PERMISSION),
    canInspect: hasPermission(auth, RETURN_INSPECT_PERMISSION),
  } as const;
}
