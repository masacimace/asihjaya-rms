import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  authorizePdfRenderDocument,
  PDF_RENDER_TOKEN_HEADER,
} from "@/features/sales/documents/pdf-render-access";
import { ReceiptCertificateHtmlDocument } from "@/features/sales/documents/receipt-certificate-html";
import {
  getConfiguredReceiptDocumentProfileId,
  isReceiptDocumentProfileId,
} from "@/features/sales/documents/receipt-document-profiles";
import { receiptCertificateSampleData } from "@/features/sales/documents/receipt-certificate-sample-data";
import {
  isReceiptCertificateRenderMode,
  resolveReceiptCertificateRenderMode,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import { getConfiguredReceiptOverlayCalibration } from "@/features/sales/documents/receipt-overlay-calibration";
import { requirePermission } from "@/lib/auth/session";

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

  const documentProfileId =
    query.profile ?? getConfiguredReceiptDocumentProfileId();
  if (!isReceiptDocumentProfileId(documentProfileId)) {
    notFound();
  }

  if (query.mode && !isReceiptCertificateRenderMode(query.mode)) {
    notFound();
  }

  const renderMode = resolveReceiptCertificateRenderMode(query.mode);
  const overlayCalibration = getConfiguredReceiptOverlayCalibration();
  const pdfRenderToken = requestHeaders.get(PDF_RENDER_TOKEN_HEADER);
  const pdfRenderAccess = authorizePdfRenderDocument({
    token: pdfRenderToken,
    scope: "receipt-preview",
    documentProfileId,
    renderMode,
  });

  if (pdfRenderToken && !pdfRenderAccess) {
    notFound();
  }

  if (!pdfRenderAccess) {
    await requirePermission("sales.view");
  }

  return (
    <ReceiptCertificateHtmlDocument
      data={receiptCertificateSampleData}
      documentProfileId={documentProfileId}
      overlayCalibration={overlayCalibration}
      renderMode={renderMode}
    />
  );
}
