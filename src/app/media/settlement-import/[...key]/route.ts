import { NextResponse } from "next/server";

import { getSettlementImportFileRecord } from "@/features/reconciliation/import-queries";
import {
  hasPermission,
  getCurrentAuth,
} from "@/lib/auth/session";
import {
  readSettlementImportFile,
  settlementImportKeyBelongsToOrganization,
} from "@/lib/storage/settlement-import-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const auth = await getCurrentAuth();
  if (
    !auth ||
    !hasPermission(auth, "payments.reconciliation.view") ||
    !hasPermission(auth, "payments.reconciliation.import")
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { key: segments } = await context.params;
  const key = segments.map(decodeURIComponent).join("/");
  if (!settlementImportKeyBelongsToOrganization(key, auth.organization.id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const record = await getSettlementImportFileRecord(auth, key);
  if (!record) return new NextResponse("Not found", { status: 404 });

  try {
    const file = await readSettlementImportFile(key);
    const safeName = record.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(file, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
