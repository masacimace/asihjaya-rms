import {
  DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
  isReceiptDocumentProfileId,
  LEGACY_RECEIPT_DOCUMENT_PROFILE_ID,
  type ReceiptDocumentProfileId,
} from "@/features/sales/documents/receipt-document-profiles";
import { generateReceiptCertificatePdfFromUrl } from "@/features/sales/documents/receipt-certificate-pdf";
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
  const documentProfileId: ReceiptDocumentProfileId = requestedProfileId
    ? (requestedProfileId as ReceiptDocumentProfileId)
    : hardwareAuth
      ? LEGACY_RECEIPT_DOCUMENT_PROFILE_ID
      : DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID;

  const htmlUrl = new URL(
    "/documents/sales/receipt-certificate-preview-html",
    request.url,
  );
  htmlUrl.searchParams.set("profile", documentProfileId);

  const pdf = await generateReceiptCertificatePdfFromUrl({
    cookieHeader: hardwareAuth ? null : request.headers.get("cookie"),
    documentProfileId,
    extraHeaders: hardwareAuth ? getHardwareAgentHeaders(request) : undefined,
    url: htmlUrl.toString(),
  });

  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-nota-certificate-${pdf.profile.paper.toLowerCase()}-landscape.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Document-Profile": pdf.profile.id,
      "X-PDF-Page-Count": String(pdf.contract.pageCount),
      "X-PDF-Paper": `${pdf.profile.paper} landscape`,
    },
  });
}
