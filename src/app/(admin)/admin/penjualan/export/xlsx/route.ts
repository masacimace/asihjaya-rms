import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { parseAdminSalesFilters } from "@/features/sales/admin-contracts";
import { getAdminSalesExportRows } from "@/features/sales/admin-queries";
import {
  buildAdminSalesExportFilename,
  buildAdminSalesWorkbook,
} from "@/features/sales/admin-sales-xlsx";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";

function parseSearchParams(request: NextRequest) {
  const searchParams: Record<string, string> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  return parseAdminSalesFilters(searchParams);
}

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasPermission(auth, "sales.view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const filters = parseSearchParams(request);
  const rows = await getAdminSalesExportRows(auth, filters);
  const generatedAt = new Date();
  const workbook = buildAdminSalesWorkbook({
    rows,
    filters,
    auth,
    generatedAt,
  });
  const workbookBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    compression: true,
    type: "buffer",
  }) as Buffer;
  const responseBody = new Uint8Array(workbookBuffer.length);
  responseBody.set(workbookBuffer);
  const filename = buildAdminSalesExportFilename(
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
