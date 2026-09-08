import type { NextRequest } from "next/server";

import { parseBankInflowFilters } from "@/features/bank-inflows/contracts";
import { getBankInflowReportData } from "@/features/bank-inflows/queries";
import {
  buildBankInflowExportFilename,
  buildBankInflowWorkbook,
  writeBankInflowWorkbook,
} from "@/features/bank-inflows/bank-inflow-xlsx";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";

function parseSearchParams(request: NextRequest) {
  const searchParams: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });
  return parseBankInflowFilters(searchParams);
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
  const data = await getBankInflowReportData(auth, filters);
  const generatedAt = new Date();
  const workbook = buildBankInflowWorkbook({ data, auth, generatedAt });
  const workbookBuffer = writeBankInflowWorkbook(workbook);
  const responseBody = new Uint8Array(workbookBuffer.length);
  responseBody.set(workbookBuffer);
  const filename = buildBankInflowExportFilename(
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
