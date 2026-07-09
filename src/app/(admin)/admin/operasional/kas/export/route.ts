import type { NextRequest } from "next/server";

import { parseAdminCashMovementFilters } from "@/features/cash-movements/contracts";
import { buildCashMovementSheets } from "@/features/cash-movements/export";
import {
  getAdminCashMovementExportRows,
  getAdminCashMovementListData,
} from "@/features/cash-movements/queries";
import { createCsvResponse, buildExportTimestamp } from "@/lib/export-files";
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
  const filename = `buku-kas-${filters.range}-${buildExportTimestamp()}.csv`;

  return createCsvResponse({
    filename,
    sheets: buildCashMovementSheets({ data, rows }),
  });
}
