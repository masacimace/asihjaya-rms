import { NextResponse } from "next/server";

import { getProductBatchImportPreview } from "@/features/product-batch-import/preview-queries";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";
import { createXlsxResponse } from "@/lib/export-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function valueText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

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
  const preview = await getProductBatchImportPreview(auth, sessionId);
  if (!preview) {
    return NextResponse.json({ message: "Session import tidak ditemukan." }, { status: 404 });
  }

  const masterErrors = preview.masters.flatMap((row) =>
    row.validationErrors.map((issue) => [
      row.rowNumber,
      valueText(row.normalizedPayload.master_key),
      issue.field ?? "",
      issue.code,
      issue.message,
      issue.field ? valueText(row.normalizedPayload[issue.field]) : "",
    ]),
  );
  const itemErrors = preview.items.flatMap((row) =>
    row.validationErrors.map((issue) => [
      row.rowNumber,
      valueText(row.normalizedPayload.row_key),
      valueText(row.normalizedPayload.master_key),
      issue.field ?? "",
      issue.code,
      issue.message,
      issue.field ? valueText(row.normalizedPayload[issue.field]) : "",
    ]),
  );
  const warnings = [
    ...preview.masters.flatMap((row) =>
      row.validationWarnings.map((issue) => [
        "PRODUCT_MASTERS",
        row.rowNumber,
        valueText(row.normalizedPayload.master_key),
        issue.field ?? "",
        issue.code,
        issue.message,
        issue.archivePath ?? "",
      ]),
    ),
    ...preview.items.flatMap((row) =>
      row.validationWarnings.map((issue) => [
        "PHYSICAL_PRODUCTS",
        row.rowNumber,
        valueText(row.normalizedPayload.row_key),
        issue.field ?? "",
        issue.code,
        issue.message,
        issue.archivePath ?? "",
      ]),
    ),
  ];

  return createXlsxResponse({
    filename: `product-batch-import-errors-${sessionId.slice(0, 8)}.xlsx`,
    sheets: [
      {
        name: "SUMMARY",
        columns: ["key", "value"],
        rows: [
          ["session_id", preview.session.id],
          ["file_name", preview.session.fileName],
          ["status", preview.session.status],
          ["master_rows", preview.session.totalMasterRows],
          ["item_rows", preview.session.totalItemRows],
          ["invalid_rows", preview.session.invalidRows],
          ["warning_count", preview.session.warningCount],
          ["file_sha256", preview.session.fileSha256],
        ],
        widths: [{ wch: 24 }, { wch: 72 }],
      },
      {
        name: "MASTER_ERRORS",
        columns: ["row_number", "master_key", "field", "code", "message", "current_value"],
        rows: masterErrors,
        widths: [{ wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 36 }, { wch: 72 }, { wch: 40 }],
      },
      {
        name: "ITEM_ERRORS",
        columns: ["row_number", "row_key", "master_key", "field", "code", "message", "current_value"],
        rows: itemErrors,
        widths: [{ wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 36 }, { wch: 72 }, { wch: 40 }],
      },
      {
        name: "WARNINGS",
        columns: ["sheet", "row_number", "row_key", "field", "code", "message", "archive_path"],
        rows: warnings,
        widths: [{ wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 24 }, { wch: 36 }, { wch: 72 }, { wch: 44 }],
      },
    ],
  });
}
