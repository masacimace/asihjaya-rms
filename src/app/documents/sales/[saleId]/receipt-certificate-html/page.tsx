import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getReceiptCertificateData } from "@/features/sales/documents/receipt-certificate";
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
import { authenticateHardwareAgentHeaders } from "@/lib/hardware/agent-auth";

export const metadata = {
  title: "Nota & Sertifikat Penjualan",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    saleId: string;
  }>;
  searchParams: Promise<{
    profile?: string;
    mode?: string;
  }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ReceiptCertificateSaleHtmlDocumentPage({
  params,
  searchParams,
}: PageProps) {
  const [{ saleId }, query] = await Promise.all([params, searchParams]);

  if (!UUID_PATTERN.test(saleId)) {
    notFound();
  }

  const documentProfileId = query.profile ?? getConfiguredReceiptDocumentProfileId();
  if (!isReceiptDocumentProfileId(documentProfileId)) {
    notFound();
  }

  if (query.mode && !isReceiptCertificateRenderMode(query.mode)) {
    notFound();
  }

  const renderMode = resolveReceiptCertificateRenderMode(query.mode);
  const overlayCalibration = getConfiguredReceiptOverlayCalibration();

  const headerStore = await headers();
  const hardwareAuth = await authenticateHardwareAgentHeaders(headerStore);

  if (hardwareAuth) {
    const documentData = await getReceiptCertificateData({
      saleId,
      organizationId: hardwareAuth.agent.organizationId,
    });

    if (!documentData || documentData.outlet.id !== hardwareAuth.agent.outletId) {
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

  const auth = await requirePermission("sales.view");
  const documentData = await getReceiptCertificateData({
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

  return (
    <ReceiptCertificateHtmlDocument
      data={documentData}
      documentProfileId={documentProfileId}
      overlayCalibration={overlayCalibration}
      renderMode={renderMode}
    />
  );
}
