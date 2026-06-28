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

  const htmlUrl = new URL(
    "/documents/sales/receipt-certificate-preview-html",
    request.url,
  );
  const pdfBuffer = await generateReceiptCertificatePdfFromUrl({
    cookieHeader: hardwareAuth ? null : request.headers.get("cookie"),
    extraHeaders: hardwareAuth ? getHardwareAgentHeaders(request) : undefined,
    url: htmlUrl.toString(),
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="preview-nota-certificate-a5.pdf"',
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
