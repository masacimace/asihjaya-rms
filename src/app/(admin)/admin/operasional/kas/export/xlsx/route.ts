import type { NextRequest } from "next/server";

import { parseAdminCashMovementFilters } from "@/features/cash-movements/contracts";
import {
  buildCashMovementExportFilename,
  buildCashMovementWorkbook,
  writeCashMovementWorkbook,
} from "@/features/cash-movements/export";
import {
  getAdminCashMovementExportRows,
  getAdminCashMovementListData,
} from "@/features/cash-movements/queries";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSearchParams(request: NextRequest) {
  const searchParams: Record<string, string> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  return parseAdminCashMovementFilters(searchParams);
}

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasPermission(auth, "admin.access")) {
    return new Response("Forbidden", { status: 403 });
  }

  const filters = parseSearchParams(request);
  const [data, rows] = await Promise.all([
    getAdminCashMovementListData(auth, filters),
    getAdminCashMovementExportRows(auth, filters),
  ]);
  const generatedAt = new Date();
  const workbook = buildCashMovementWorkbook({
    data,
    rows,
    auth,
    generatedAt,
  });
  const workbookBuffer = writeCashMovementWorkbook(workbook);
  const responseBody = new Uint8Array(workbookBuffer.length);
  responseBody.set(workbookBuffer);
  const filename = buildCashMovementExportFilename(
    generatedAt,
    auth.organization.timezone,
  );

  return new Response(responseBody.buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
