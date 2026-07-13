import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { paymentReconciliations } from "@/db/schema";
import {
  getCurrentAuth,
  hasPermission,
} from "@/lib/auth/session";
import {
  readReconciliationEvidenceFile,
  reconciliationEvidenceKeyBelongsToOrganization,
} from "@/lib/storage/reconciliation-evidence-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const auth = await getCurrentAuth();

  if (!auth || !hasPermission(auth, "payments.reconciliation.view")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key } = await context.params;
  const evidenceKey = key
    .map((segment) => decodeURIComponent(segment))
    .join("/");

  if (
    !reconciliationEvidenceKeyBelongsToOrganization(
      evidenceKey,
      auth.organization.id,
    )
  ) {
    return new Response("Not found", { status: 404 });
  }

  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const [evidence] = await db
    .select({ id: paymentReconciliations.id })
    .from(paymentReconciliations)
    .where(
      and(
        eq(paymentReconciliations.organizationId, auth.organization.id),
        inArray(paymentReconciliations.outletId, outletIds),
        eq(paymentReconciliations.evidenceKey, evidenceKey),
      ),
    )
    .limit(1);

  if (!evidence) return new Response("Not found", { status: 404 });

  try {
    const body = await readReconciliationEvidenceFile(evidenceKey);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
