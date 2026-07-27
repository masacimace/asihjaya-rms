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
  resolveReceiptCertificateRenderMode,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
  RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import { getConfiguredReceiptOverlayCalibration } from "@/features/sales/documents/receipt-overlay-calibration";
import { enforcePdfRenderRateLimit } from "@/features/sales/documents/pdf-render-rate-limit";
import { requirePermission } from "@/lib/auth/session";
import { authenticateHardwareAgent } from "@/lib/hardware/agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const hardwareAuth = await authenticateHardwareAgent(request);
  const userAuth = hardwareAuth ? null : await requirePermission("sales.view");
  const renderOrganizationId =
    hardwareAuth?.agent.organizationId ?? userAuth?.organization.id;

  if (!renderOrganizationId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rateLimitResponse = await enforcePdfRenderRateLimit({
    request,
    actor: hardwareAuth
      ? { type: "hardware-agent", id: hardwareAuth.agent.id }
      : { type: "user", id: userAuth!.user.id },
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const requestUrl = new URL(request.url);
  const requestedProfileId = requestUrl.searchParams.get("profile");
  if (requestedProfileId && !isReceiptDocumentProfileId(requestedProfileId)) {
    return Response.json(
      { success: false, error: "Document profile tidak didukung." },
      { status: 422 },
    );
  }

  const requestedRenderMode = requestUrl.searchParams.get("mode");
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

  let pdf: Awaited<ReturnType<typeof generateReceiptCertificatePdf>>;
  try {
    pdf = await generateReceiptCertificatePdf({
      documentProfileId,
      renderMode,
      access: {
        scope: "receipt-preview",
        organizationId: renderOrganizationId,
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

  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-nota-certificate-${filenameMode}-${pdf.profile.paper.toLowerCase()}-landscape.pdf"`,
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
