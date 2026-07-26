import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ReceiptCertificateHtmlDocument } from "@/features/sales/documents/receipt-certificate-html";
import {
  DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
  isReceiptDocumentProfileId,
} from "@/features/sales/documents/receipt-document-profiles";
import { receiptCertificateSampleData } from "@/features/sales/documents/receipt-certificate-sample-data";
import {
  isReceiptCertificateRenderMode,
  resolveReceiptCertificateRenderMode,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import { requirePermission } from "@/lib/auth/session";
import { authenticateHardwareAgentHeaders } from "@/lib/hardware/agent-auth";

export const metadata = {
  title: "Preview Nota & Sertifikat",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    profile?: string;
    mode?: string;
  }>;
};

export default async function ReceiptCertificatePreviewHtmlDocumentPage({
  searchParams,
}: PageProps) {
  const [requestHeaders, query] = await Promise.all([headers(), searchParams]);
  const hardwareAuth = await authenticateHardwareAgentHeaders(requestHeaders);

  if (!hardwareAuth) {
    await requirePermission("sales.view");
  }

  const documentProfileId = query.profile ?? DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID;
  if (!isReceiptDocumentProfileId(documentProfileId)) {
    notFound();
  }

  if (query.mode && !isReceiptCertificateRenderMode(query.mode)) {
    notFound();
  }

  const renderMode = resolveReceiptCertificateRenderMode(query.mode);

  return (
    <ReceiptCertificateHtmlDocument
      data={receiptCertificateSampleData}
      documentProfileId={documentProfileId}
      renderMode={renderMode}
    />
  );
}
