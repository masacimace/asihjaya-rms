import { notFound } from "next/navigation";
import { type NextRequest } from "next/server";

import { getReceiptCertificateData } from "@/features/sales/documents/receipt-certificate";
import { generateReceiptCertificatePdfFromUrl } from "@/features/sales/documents/receipt-certificate-pdf";
import { requirePermission } from "@/lib/auth/session";
import { authenticateHardwareAgent } from "@/lib/hardware/agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    saleId: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { saleId } = await context.params;

  if (!UUID_PATTERN.test(saleId)) {
    notFound();
  }

  const hardwareAuth = await authenticateHardwareAgent(request);
  let cookieHeader: string | null = null;
  let extraHeaders: Record<string, string> | undefined;
  let documentData: Awaited<ReturnType<typeof getReceiptCertificateData>>;

  if (hardwareAuth) {
    documentData = await getReceiptCertificateData({
      saleId,
      organizationId: hardwareAuth.agent.organizationId,
    });

    if (!documentData || documentData.outlet.id !== hardwareAuth.agent.outletId) {
      notFound();
    }

    extraHeaders = {
      "x-hardware-agent-id": request.headers.get("x-hardware-agent-id") ?? "",
      "x-hardware-agent-secret":
        request.headers.get("x-hardware-agent-secret") ?? "",
    };
  } else {
    const auth = await requirePermission("sales.view");

    documentData = await getReceiptCertificateData({
      saleId,
      organizationId: auth.organization.id,
    });

    if (!documentData) {
      notFound();
    }

    const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
    const canAccessAllSales = auth.permissionCodes.includes("admin.access");

    if (!canAccessAllSales && !accessibleOutletIds.has(documentData.outlet.id)) {
      notFound();
    }

    cookieHeader = request.headers.get("cookie");
  }

  const htmlUrl = new URL(
    `/documents/sales/${saleId}/receipt-certificate-html`,
    request.url,
  );
  const pdfBuffer = await generateReceiptCertificatePdfFromUrl({
    cookieHeader,
    extraHeaders,
    url: htmlUrl.toString(),
  });
  const filename = sanitizeFilename(
    `${documentData.sale.invoiceNumber}-nota-certificate-a5.pdf`,
  );
  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const dispositionType = shouldDownload ? "attachment" : "inline";

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${dispositionType}; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
