import type { NextRequest } from "next/server";

import { parseReportStockFilters } from "@/features/reports/contracts";
import { buildStockReportSheets } from "@/features/reports/export";
import { getReportStockData } from "@/features/reports/queries";
import { createXlsxResponse, buildExportTimestamp } from "@/lib/export-files";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSearchParams(request: NextRequest) {
  const searchParams: Record<string, string> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  return parseReportStockFilters(searchParams);
}

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasPermission(auth, "reports.view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const filters = parseSearchParams(request);
  const data = await getReportStockData(auth, filters, { movementLimit: 10000 });
  const filename = `laporan-stok-${filters.range}-${buildExportTimestamp()}.xlsx`;

  return createXlsxResponse({
    filename,
    sheets: buildStockReportSheets(data),
  });
}
