import {
  PRODUCT_BATCH_IMPORT_TEMPLATE_FILENAME,
  PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
} from "@/features/product-batch-import/contracts";
import { buildProductBatchImportTemplateBuffer } from "@/features/product-batch-import/template";
import { requirePermission } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // 2B.1 memakai permission existing agar route dapat diuji sebelum migration
  // permission products.batch_import ditambahkan pada stage 2B.2.
  await requirePermission("products.manage");

  const workbookBuffer = buildProductBatchImportTemplateBuffer();
  const responseBody = new Uint8Array(workbookBuffer.length);
  responseBody.set(workbookBuffer);

  return new Response(responseBody.buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${PRODUCT_BATCH_IMPORT_TEMPLATE_FILENAME}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Product-Batch-Template-Version": PRODUCT_BATCH_IMPORT_TEMPLATE_VERSION,
    },
  });
}
