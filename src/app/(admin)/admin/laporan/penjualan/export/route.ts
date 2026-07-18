import type { NextRequest } from "next/server";

import { parseReportSalesFilters } from "@/features/reports/contracts";
import { buildSalesReportSheets } from "@/features/reports/export";
import { getReportSalesData } from "@/features/reports/queries";
import { createCsvResponse, buildExportTimestamp } from "@/lib/export-files";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseSearchParams(request: NextRequest) {
  const searchParams: Record<string, string> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  return parseReportSalesFilters(searchParams);
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
  const data = await getReportSalesData(auth, filters, { rowLimit: 10000 });
  const filename = `laporan-penjualan-${filters.range}-${buildExportTimestamp()}.csv`;

  return createCsvResponse({
    filename,
    sheets: buildSalesReportSheets(data),
  });
}
