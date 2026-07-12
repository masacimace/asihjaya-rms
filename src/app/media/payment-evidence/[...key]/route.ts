import { and, eq, gt, inArray, isNotNull, or } from "drizzle-orm";

import { db } from "@/db";
import { paymentEvidenceUploads } from "@/db/schema";
import { getCurrentAuth, hasAnyPermission } from "@/lib/auth/session";
import {
  paymentEvidenceKeyBelongsToOrganization,
  readPaymentEvidenceFile,
} from "@/lib/storage/payment-evidence-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const auth = await getCurrentAuth();

  if (
    !auth ||
    !hasAnyPermission(auth, [
      "sales.create",
      "payments.manage",
      "payments.verify.manual",
    ])
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key } = await context.params;
  const evidenceKey = key
    .map((segment) => decodeURIComponent(segment))
    .join("/");

  if (
    !paymentEvidenceKeyBelongsToOrganization(
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

  const [evidenceRow] = await db
    .select({
      uploadedBy: paymentEvidenceUploads.uploadedBy,
    })
    .from(paymentEvidenceUploads)
    .where(
      and(
        eq(paymentEvidenceUploads.organizationId, auth.organization.id),
        inArray(paymentEvidenceUploads.outletId, outletIds),
        eq(paymentEvidenceUploads.storageKey, evidenceKey),
        or(
          isNotNull(paymentEvidenceUploads.saleId),
          gt(paymentEvidenceUploads.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);

  if (!evidenceRow) {
    return new Response("Not found", { status: 404 });
  }

  const canReviewAllEvidence = hasAnyPermission(auth, [
    "payments.manage",
    "payments.verify.manual",
  ]);

  if (!canReviewAllEvidence && evidenceRow.uploadedBy !== auth.user.id) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const evidence = await readPaymentEvidenceFile(evidenceKey);

    return new Response(new Uint8Array(evidence), {
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
