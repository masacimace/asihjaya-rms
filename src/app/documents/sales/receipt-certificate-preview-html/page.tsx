import { headers } from "next/headers";

import { ReceiptCertificateHtmlDocument } from "@/features/sales/documents/receipt-certificate-html";
import { receiptCertificateSampleData } from "@/features/sales/documents/receipt-certificate-sample-data";
import { requirePermission } from "@/lib/auth/session";
import { authenticateHardwareAgentHeaders } from "@/lib/hardware/agent-auth";

export const metadata = {
  title: "Preview Nota & Sertifikat",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ReceiptCertificatePreviewHtmlDocumentPage() {
  const requestHeaders = await headers();
  const hardwareAuth = await authenticateHardwareAgentHeaders(requestHeaders);

  if (!hardwareAuth) {
    await requirePermission("sales.view");
  }

  return <ReceiptCertificateHtmlDocument data={receiptCertificateSampleData} />;
}
