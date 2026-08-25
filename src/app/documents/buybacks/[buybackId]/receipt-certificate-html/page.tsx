import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  authorizePdfRenderDocument,
  PDF_RENDER_TOKEN_HEADER,
} from "@/features/sales/documents/pdf-render-access";
import { getBuybackReceiptData } from "@/features/buybacks/documents/buyback-receipt";
import { ReceiptCertificateHtmlDocument } from "@/features/sales/documents/receipt-certificate-html";
import {
  getConfiguredReceiptDocumentProfileId,
  isReceiptDocumentProfileId,
} from "@/features/sales/documents/receipt-document-profiles";
import {
  isReceiptCertificateRenderMode,
  resolveReceiptCertificateRenderMode,
} from "@/features/sales/documents/receipt-certificate-render-modes";
import { getConfiguredReceiptOverlayCalibration } from "@/features/sales/documents/receipt-overlay-calibration";
import { requirePermission } from "@/lib/auth/session";

export const metadata = {
  title: "Nota Buyback",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    buybackId: string;
  }>;
  searchParams: Promise<{
    profile?: string;
    mode?: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function BuybackReceiptHtmlDocumentPage({
  params,
  searchParams,
}: PageProps) {
  const [{ buybackId }, query, headerStore] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);

  if (!UUID_PATTERN.test(buybackId)) {
    notFound();
  }

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
  const pdfRenderToken = headerStore.get(PDF_RENDER_TOKEN_HEADER);
  const pdfRenderAccess = authorizePdfRenderDocument({
    token: pdfRenderToken,
    scope: "receipt-buyback",
    buybackId,
    documentProfileId,
    renderMode,
  });

  if (pdfRenderToken && !pdfRenderAccess) {
    notFound();
  }

  if (pdfRenderAccess) {
    const documentData = await getBuybackReceiptData({
      buybackId,
      organizationId: pdfRenderAccess.organizationId,
    });
    if (!documentData) {
      notFound();
    }

    return (
      <ReceiptCertificateHtmlDocument
        data={documentData}
        documentProfileId={documentProfileId}
        overlayCalibration={overlayCalibration}
        renderMode={renderMode}
      />
    );
  }

  const auth = await requirePermission("buybacks.view");
  const documentData = await getBuybackReceiptData({
    buybackId,
    organizationId: auth.organization.id,
  });
  if (!documentData) {
    notFound();
  }

  const accessibleOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
  const canAccessAll = auth.permissionCodes.includes("admin.access");
  if (!canAccessAll && !accessibleOutletIds.has(documentData.outlet.id)) {
    notFound();
  }

  return (
    <ReceiptCertificateHtmlDocument
      data={documentData}
      documentProfileId={documentProfileId}
      overlayCalibration={overlayCalibration}
      renderMode={renderMode}
    />
  );
}
