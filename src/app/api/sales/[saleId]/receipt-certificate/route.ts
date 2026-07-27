import { notFound } from "next/navigation";
import { type NextRequest } from "next/server";

import { getReceiptCertificateData } from "@/features/sales/documents/receipt-certificate";
import {
  getConfiguredReceiptDocumentProfileId,
  isReceiptDocumentProfileId,
  type ReceiptDocumentProfileId,
} from "@/features/sales/documents/receipt-document-profiles";
import {
  createPdfRenderFailureResponse,
  generateReceiptCertificatePdf,
} from "@/features/sales/documents/receipt-certificate-pdf";
import {
  getReceiptCertificateRenderModeLabel,
  isReceiptCertificateRenderMode,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
  RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
  resolveReceiptCertificateRenderMode,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import { getConfiguredReceiptOverlayCalibration } from "@/features/sales/documents/receipt-overlay-calibration";
import { enforcePdfRenderRateLimit } from "@/features/sales/documents/pdf-render-rate-limit";
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

function collectReceiptMediaKeys(
  documentData: NonNullable<
    Awaited<ReturnType<typeof getReceiptCertificateData>>
  >,
) {
  return Array.from(
    new Set(
      documentData.items.flatMap((item) =>
        [item.snapshot.imageKey, item.snapshot.productImageKey].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { saleId } = await context.params;

  if (!UUID_PATTERN.test(saleId)) {
    notFound();
  }

  const hardwareAuth = await authenticateHardwareAgent(request);
  const requestedProfileId = request.nextUrl.searchParams.get("profile");
  const requestedRenderMode = request.nextUrl.searchParams.get("mode");

  if (requestedProfileId && !isReceiptDocumentProfileId(requestedProfileId)) {
    return Response.json(
      { success: false, error: "Document profile tidak didukung." },
      { status: 422 },
    );
  }
  if (
    requestedRenderMode &&
    !isReceiptCertificateRenderMode(requestedRenderMode)
  ) {
    return Response.json(
      { success: false, error: "Mode render nota tidak didukung." },
      { status: 422 },
    );
  }

  const renderMode = resolveReceiptCertificateRenderMode(requestedRenderMode);
  const overlayCalibration = getConfiguredReceiptOverlayCalibration();

  const documentProfileId: ReceiptDocumentProfileId = requestedProfileId
    ? (requestedProfileId as ReceiptDocumentProfileId)
    : getConfiguredReceiptDocumentProfileId();

  let renderOrganizationId: string;
  let documentData: Awaited<ReturnType<typeof getReceiptCertificateData>>;
  let rateLimitActor:
    | { type: "user"; id: string }
    | { type: "hardware-agent"; id: string };

  if (hardwareAuth) {
    renderOrganizationId = hardwareAuth.agent.organizationId;
    rateLimitActor = { type: "hardware-agent", id: hardwareAuth.agent.id };
    documentData = await getReceiptCertificateData({
      saleId,
      organizationId: renderOrganizationId,
    });

    if (!documentData || documentData.outlet.id !== hardwareAuth.agent.outletId) {
      notFound();
    }
  } else {
    const auth = await requirePermission("sales.view");
    renderOrganizationId = auth.organization.id;
    rateLimitActor = { type: "user", id: auth.user.id };

    documentData = await getReceiptCertificateData({
      saleId,
      organizationId: renderOrganizationId,
    });

    if (!documentData) {
      notFound();
    }

    const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
    const canAccessAllSales = auth.permissionCodes.includes("admin.access");

    if (!canAccessAllSales && !accessibleOutletIds.has(documentData.outlet.id)) {
      notFound();
    }
  }

  const rateLimitResponse = await enforcePdfRenderRateLimit({
    request,
    actor: rateLimitActor,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let pdf: Awaited<ReturnType<typeof generateReceiptCertificatePdf>>;
  try {
    pdf = await generateReceiptCertificatePdf({
      documentProfileId,
      renderMode,
      access: {
        scope: "receipt-sale",
        organizationId: renderOrganizationId,
        saleId,
        allowedMediaKeys: collectReceiptMediaKeys(documentData),
      },
    });
  } catch (error) {
    const failureResponse = createPdfRenderFailureResponse(error);
    if (failureResponse) {
      return failureResponse;
    }
    throw error;
  }

  const filenameMode =
    renderMode === RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK
      ? "vendor-static-artwork"
      : renderMode === RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY
        ? "preprinted-overlay"
        : "full-design";
  const filename = sanitizeFilename(
    `${documentData.sale.invoiceNumber}-nota-certificate-${pdf.profile.paper.toLowerCase()}-landscape-${filenameMode}.pdf`,
  );
  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const dispositionType = shouldDownload ? "attachment" : "inline";

  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${dispositionType}; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Document-Profile": pdf.profile.id,
      "X-PDF-Page-Count": String(pdf.contract.pageCount),
      "X-PDF-Paper": `${pdf.profile.paper} landscape`,
      "X-Receipt-Overlay-Offset-X-MM": String(overlayCalibration.offsetXmm),
      "X-Receipt-Overlay-Offset-Y-MM": String(overlayCalibration.offsetYmm),
      "X-Receipt-Overlay-Scale": String(overlayCalibration.scale),
      "X-Receipt-Render-Mode": renderMode,
      "X-Receipt-Render-Mode-Label":
        getReceiptCertificateRenderModeLabel(renderMode),
    },
  });
}
