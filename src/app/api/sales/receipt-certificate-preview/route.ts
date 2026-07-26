import {
  getConfiguredReceiptDocumentProfileId,
  isReceiptDocumentProfileId,
  type ReceiptDocumentProfileId,
} from "@/features/sales/documents/receipt-document-profiles";
import { generateReceiptCertificatePdfFromUrl } from "@/features/sales/documents/receipt-certificate-pdf";
import {
  getReceiptCertificateRenderModeLabel,
  isReceiptCertificateRenderMode,
  resolveReceiptCertificateRenderMode,
  RECEIPT_CERTIFICATE_RENDER_MODE_PREPRINTED_OVERLAY,
  RECEIPT_CERTIFICATE_RENDER_MODE_VENDOR_STATIC_ARTWORK,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import { getConfiguredReceiptOverlayCalibration } from "@/features/sales/documents/receipt-overlay-calibration";
import { requirePermission } from "@/lib/auth/session";
import { authenticateHardwareAgentHeaders } from "@/lib/hardware/agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getHardwareAgentHeaders(request: Request) {
  const agentId = request.headers.get("x-hardware-agent-id");
  const agentSecret = request.headers.get("x-hardware-agent-secret");

  if (!agentId || !agentSecret) {
    return undefined;
  }

  return {
    "x-hardware-agent-id": agentId,
    "x-hardware-agent-secret": agentSecret,
  };
}

export async function GET(request: Request) {
  const hardwareAuth = await authenticateHardwareAgentHeaders(request.headers);

  if (!hardwareAuth) {
    await requirePermission("sales.view");
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

  const htmlUrl = new URL(
    "/documents/sales/receipt-certificate-preview-html",
    request.url,
  );
  htmlUrl.searchParams.set("profile", documentProfileId);
  htmlUrl.searchParams.set("mode", renderMode);

  const pdf = await generateReceiptCertificatePdfFromUrl({
    cookieHeader: hardwareAuth ? null : request.headers.get("cookie"),
    documentProfileId,
    extraHeaders: hardwareAuth ? getHardwareAgentHeaders(request) : undefined,
    url: htmlUrl.toString(),
  });

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
