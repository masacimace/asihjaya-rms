import { NextResponse } from "next/server";

import { getProductBatchImportResult } from "@/features/product-batch-import/result-queries";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";
import { buildExportTimestamp, createXlsxResponse } from "@/lib/export-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json({ message: "Login diperlukan." }, { status: 401 });
  }
  if (!hasPermission(auth, "products.batch_import")) {
    return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
  }

  const { sessionId } = await params;
  const result = await getProductBatchImportResult(auth, sessionId);
  if (!result) {
    return NextResponse.json({ message: "Session import tidak ditemukan." }, { status: 404 });
  }
  if (result.session.status !== "completed") {
    return NextResponse.json(
      { message: "Result workbook hanya tersedia setelah import completed." },
      { status: 409 },
    );
  }

  const availableCount = result.items.filter(
    (item) => item.availability === "available",
  ).length;
  const draftCount = result.items.filter(
    (item) => item.availability === "draft",
  ).length;

  return createXlsxResponse({
    filename: `product-batch-import-result-${sessionId.slice(0, 8)}-${buildExportTimestamp()}.xlsx`,
    sheets: [
      {
        name: "IMPORT_SUMMARY",
        columns: ["key", "value"],
        rows: [
          ["session_id", result.session.id],
          ["file_name", result.session.fileName],
          ["file_sha256", result.session.fileSha256],
          ["template_version", result.session.templateVersion],
          ["operator", result.session.createdByName],
          ["committed_at", result.session.committedAt],
          ["master_count", result.masters.length],
          ["item_count", result.items.length],
          ["available_count", availableCount],
          ["draft_count", draftCount],
          ["warning_count", result.warnings.length],
        ],
        widths: [{ wch: 24 }, { wch: 72 }],
      },
      {
        name: "CREATED_MASTERS",
        columns: [
          "master_key",
          "product_master_id",
          "product_master_code",
          "name",
          "status",
          "image_status",
        ],
        rows: result.masters.map((master) => [
          master.masterKey,
          master.productMasterId,
          master.code,
          master.name,
          master.status,
          master.imageStatus,
        ]),
        widths: [
          { wch: 24 },
          { wch: 38 },
          { wch: 20 },
          { wch: 42 },
          { wch: 14 },
          { wch: 16 },
        ],
      },
      {
        name: "CREATED_ITEMS",
        columns: [
          "row_key",
          "master_key",
          "product_item_id",
          "sku",
          "barcode",
          "qr_value",
          "outlet_code",
          "availability",
          "image_source",
          "status",
        ],
        rows: result.items.map((item) => [
          item.rowKey,
          item.masterKey,
          item.productItemId,
          item.sku,
          item.barcode,
          item.qrValue ?? "",
          item.outletCode ?? "",
          item.availability,
          item.imageSource,
          item.isActive ? "active" : "inactive",
        ]),
        widths: [
          { wch: 24 },
          { wch: 24 },
          { wch: 38 },
          { wch: 24 },
          { wch: 24 },
          { wch: 24 },
          { wch: 20 },
          { wch: 16 },
          { wch: 22 },
          { wch: 14 },
        ],
      },
      {
        name: "WARNINGS",
        columns: ["sheet", "row_number", "row_key", "field", "code", "message"],
        rows: result.warnings.map((warning) => [
          warning.sheet,
          warning.rowNumber,
          warning.key,
          warning.field ?? "",
          warning.code,
          warning.message,
        ]),
        widths: [
          { wch: 24 },
          { wch: 12 },
          { wch: 24 },
          { wch: 24 },
          { wch: 36 },
          { wch: 72 },
        ],
      },
    ],
  });
}
