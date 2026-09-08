import type { NextRequest } from "next/server";

import {
  normalizeBuybackHistoryDateRange,
  normalizeBuybackHistoryPayoutFilter,
  normalizeBuybackHistoryProcessingFilter,
} from "@/features/buybacks/history-filters";
import { getBuybackReportRows } from "@/features/buybacks/report-queries";
import {
  buildBuybackExportFilename,
  buildBuybackWorkbook,
  writeBuybackWorkbook,
} from "@/features/buybacks/buyback-xlsx";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await getCurrentAuth();

  if (!auth) return new Response("Unauthorized", { status: 401 });
  if (
    !hasPermission(auth, "admin.access") ||
    !hasPermission(auth, "buybacks.view")
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const outlet =
    auth.outlets.find((candidate) => candidate.isPrimary) ??
    auth.outlets[0] ??
    null;
  if (!outlet) return new Response("Outlet tidak tersedia", { status: 400 });

  const filters = {
    search: String(request.nextUrl.searchParams.get("q") ?? "")
      .trim()
      .slice(0, 160),
    dateRange: normalizeBuybackHistoryDateRange(
      request.nextUrl.searchParams.get("range"),
    ),
    processingFilter: normalizeBuybackHistoryProcessingFilter(
      request.nextUrl.searchParams.get("process"),
    ),
    payoutFilter: normalizeBuybackHistoryPayoutFilter(
      request.nextUrl.searchParams.get("payout"),
    ),
  };

  const rows = await getBuybackReportRows({
    organizationId: auth.organization.id,
    outletId: outlet.id,
    filters,
    timeZone: auth.organization.timezone,
  });
  const generatedAt = new Date();
  const workbook = buildBuybackWorkbook({
    rows,
    filters,
    auth: {
      organization: {
        name: auth.organization.name,
        timezone: auth.organization.timezone,
      },
      user: { fullName: auth.user.fullName },
      outlet: {
        id: outlet.id,
        code: outlet.code,
        name: outlet.name,
      },
    },
    generatedAt,
  });
  const workbookBuffer = writeBuybackWorkbook(workbook);
  const responseBody = new Uint8Array(workbookBuffer.length);
  responseBody.set(workbookBuffer);
  const filename = buildBuybackExportFilename(
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
