import { createQrSvgDataUri } from "@/lib/qr-code/svg";

import type { ReceiptCertificateData } from "./receipt-certificate";
import {
  DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
  resolveReceiptDocumentProfile,
  type ReceiptDocumentProfileId,
} from "./receipt-document-profiles";

const receiptTerms = [
  "1. Barang yang tercantum dalam nota telah diperiksa, disetujui, ditimbang, dan diterima oleh pembeli.",
  "2. Barang dapat dijual kembali dalam keadaan utuh sesuai kebijakan toko dan harga pasar yang berlaku.",
  "3. Barang permata cacat atau pecah tidak dapat diterima kembali.",
  "4. Perhiasan batu dan sejenisnya hanya kami terima emasnya saja.",
  "5. Nota ini wajib dibawa saat menjual kembali. Jika nota hilang, transaksi dapat ditolak.",
];

const styles = String.raw`
  html,
  body {
    min-height: 100%;
    margin: 0;
    background: #f4f1eb;
  }

  body {
    min-height: 100vh;
    min-height: 100dvh;
  }

  .aj-preview-shell {
    display: grid;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    align-items: start;
    justify-items: center;
    overflow: auto;
    padding: clamp(12px, 3vw, 32px);
    background:
      radial-gradient(circle at top, rgba(215, 173, 74, 0.15), transparent 34rem),
      linear-gradient(180deg, #fffdf8 0%, #f4f1eb 100%);
  }

  .aj-preview-shell-single {
    place-items: center;
  }

  .aj-receipt-stage {
    display: grid;
    width: var(--receipt-page-width);
    min-height: var(--receipt-page-height);
    gap: clamp(16px, 2.8vw, 28px);
  }

  .aj-receipt-page,
  .aj-receipt-page * {
    box-sizing: border-box;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .aj-receipt-page {
    position: relative;
    display: grid;
    width: var(--receipt-page-width);
    height: var(--receipt-page-height);
    overflow: hidden;
    place-items: center;
    margin: 0;
    break-after: page;
    page-break-after: always;
  }

  .aj-receipt-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .aj-receipt-design {
    --gold: #b37a1f;
    --gold-2: #d7ad4a;
    --gold-soft: #f6ead0;
    --ink: #1c1712;
    --muted: #74675c;
    --line: #ead7ad;
    --cream: #fffaf0;
    --maroon: #a81f3d;

    position: relative;
    width: 210mm;
    height: 148mm;
    overflow: hidden;
    padding: 6mm 7mm;
    color: var(--ink);
    background: #fafaf6;
    border: 0.45mm solid var(--gold);
    border-radius: 2.2mm;
    font-family: Arial, Helvetica, sans-serif;
    box-shadow: 0 20px 54px rgba(58, 42, 22, 0.16);
    transform: scale(var(--receipt-design-scale));
    transform-origin: center;
  }

  .aj-receipt-design::before {
    content: "";
    position: absolute;
    inset: 2.5mm;
    border: 0.18mm solid rgba(179, 122, 31, 0.35);
    pointer-events: none;
  }

  .aj-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 128mm;
    height: 128mm;
    pointer-events: none;
    opacity: 0.09;
  }

  .aj-watermark img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* ─── MAIN LAYOUT ─── */

  .aj-document-content {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    gap: 2.5mm;
    height: 100%;
  }

  /* ─── HEADER ─── */

  .aj-header {
    display: grid;
    grid-template-columns: 28mm 1fr 54mm;
    gap: 3.5mm;
    align-items: stretch;
  }

  .aj-logo-block {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 1.4mm;
    padding: 2mm 0;
  }

  .aj-logo {
    width: 22mm;
    height: 22mm;
    object-fit: contain;
  }

  .aj-brand-block {
    display: grid;
    align-content: center;
    min-width: 0;
  }

  .aj-eyebrow {
    width: fit-content;
    margin-bottom: 1.2mm;
    padding: 0.7mm 2mm;
    border-radius: 999px;
    color: var(--gold);
    background: rgba(246, 234, 208, 0.68);
    border: 0.18mm solid rgba(179, 122, 31, 0.34);
    font-size: 5.2pt;
    font-weight: 900;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .aj-brand-title {
    color: var(--ink);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 16pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.035em;
    text-transform: uppercase;
  }

  .aj-branch-title {
    margin-top: 1.2mm;
    color: var(--gold);
    font-size: 9.4pt;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .aj-contact-lines {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8mm 3mm;
    margin-top: 1.8mm;
    color: #5f554c;
    font-size: 5.5pt;
    line-height: 1.2;
  }

  .aj-contact-item {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 1mm;
    font-size: 7.5pt;
  }

  .aj-contact-item:first-child {
    grid-column: 1 / -1;
  }

  .aj-certificate-card {
    display: grid;
    align-content: center;
    padding: 3mm 3.5mm;
  }

  .aj-divider {
    height: 0.22mm;
    margin: 2mm 0 2.2mm;
    background: linear-gradient(90deg, transparent, rgba(179, 122, 31, 0.72), transparent);
  }

  .aj-summary-lines {
    display: grid;
    gap: 1.2mm;
    font-size: 6.4pt;
  }

  .aj-summary-row {
    display: grid;
    grid-template-columns: 16mm 1fr;
    gap: 1.5mm;
  }

  .aj-summary-value {
    font-weight: 900;
  }

  /* ─── INFO STRIP ─── */

  .aj-info-strip {
    display: grid;
    grid-template-columns: 1fr 1fr 40mm;
    overflow: hidden;
    border: 0.2mm solid rgba(179, 122, 31, 0.28);
    border-radius: 2.5mm;
    background: rgba(255, 255, 255, 0.72);
  }

  .aj-info-box {
    display: flex;
    align-items: center;
    gap: 2mm;
    min-width: 0;
    padding: 1.8mm 3.5mm;
    border-left: 0.18mm solid rgba(179, 122, 31, 0.18);
  }

  .aj-info-box:first-child {
    border-left: 0;
  }

  .aj-info-label {
    color: var(--muted);
    font-size: 7.5pt;
    line-height: 1.1;
  }

  .aj-info-value {
    margin-top: 0.4mm;
    color: var(--ink);
    font-size: 7.6pt;
    font-weight: 900;
    line-height: 1.05;
  }

  .aj-payment-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--maroon);
    background: rgba(168, 31, 61, 0.055);
    font-size: 6pt;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-align: center;
    text-transform: uppercase;
  }

  /* ─── PRODUCTS TABLE ─── */

  .aj-products-card {
    overflow: hidden;
    border: 0.22mm solid rgba(179, 122, 31, 0.25);
    border-radius: 2.5mm;
    background: rgba(255, 255, 255, 1.0);
    min-height: 0;
  }

  .aj-products-grid {
    display: grid;
    grid-template-rows: 7.5mm;
    grid-auto-rows: 1fr;
    height: 100%;
  }

  .aj-products-grid-single {
    grid-auto-rows: 1fr;
    height: 100%;
  }

  .aj-product-row {
    display: grid;
    grid-template-columns: 20mm 45mm minmax(0, 1fr) 18mm 18mm 26mm 23mm;
    align-items: center;
    padding: 0 4mm;
    border-bottom: 0.18mm solid rgba(234, 215, 173, 0.76);
  }

  .aj-product-body {
    min-height: 0;
    padding-top: 2.5mm;
    padding-bottom: 2.5mm;
  }

  .aj-product-row:last-child {
    border-bottom: 0;
  }

  .aj-product-head {
    color: #000;
    background: #f5f5dc;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 5.8pt;
    font-weight: 900;
    letter-spacing: 0.02em;
  }

  .aj-product-head > div {
    text-align: left;
  }

  .aj-product-head .aj-head-center {
    text-align: center;
  }

  .aj-product-head .aj-head-right {
    text-align: right;
  }

  .aj-code {
    font-size: 7.6pt;
    font-weight: 900;
    text-align: center;
  }

  .aj-thumb {
    display: grid;
    width: 44mm;
    height: 44mm;
    overflow: hidden;
    place-items: center;
    justify-self: center;
    color: var(--gold);
    background: linear-gradient(135deg, rgba(255, 254, 250, 0.96), rgba(251, 240, 216, 0.58));
    border-radius: 2mm;
    font-size: 6pt;
    font-weight: 900;
    text-align: center;
  }

  .aj-thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .aj-thumb-fallback {
    padding: 2mm;
    line-height: 1.2;
  }

  .aj-product-copy {
    min-width: 0;
  }

  .aj-product-name {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 6.9pt;
    font-weight: 900;
    line-height: 1.12;
    text-transform: uppercase;
  }

  .aj-product-meta {
    margin-top: 1.1mm;
    color: var(--muted);
    font-size: 6.4pt;
    font-weight: 700;
    line-height: 1.2;
  }

  .aj-kadar {
    display: grid;
    width: 12.5mm;
    height: 12.5mm;
    place-items: center;
    justify-self: center;
    color: #000;
    background: rgba(255, 253, 248, 0.94);
    font-size: 7.6pt;
    font-weight: 900;
  }

  .aj-gram {
    font-size: 7.6pt;
    font-weight: 900;
    text-align: center;
  }

  .aj-deduction {
    color: var(--maroon);
    font-size: 7.6pt;
    font-weight: 900;
    text-align: center;
    white-space: nowrap;
  }

  .aj-price {
    font-size: 7.6pt;
    font-weight: 900;
    text-align: right;
  }

  /* ─── FOOTER ─── */

  .aj-footer {
    display: grid;
    grid-template-columns: 1fr 52mm 26mm;
    gap: 2.5mm;
    min-height: 0;
  }

  .aj-notes,
  .aj-total-card,
  .aj-qr-card {
    border: 0.2mm solid rgba(179, 122, 31, 0.23);
    border-radius: 2.5mm;
    background: rgba(255, 255, 255, 0.74);
  }

  .aj-notes {
    padding: 2.5mm 3mm;
    overflow: hidden;
  }

  .aj-notes-title {
    display: flex;
    align-items: center;
    gap: 1.2mm;
    margin-bottom: 1mm;
    color: var(--gold);
    font-size: 6pt;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .aj-terms {
    margin: 0;
    color: #382f28;
    font-size: 6.2pt;
    line-height: 1.36;
  }

  .aj-total-card {
    display: grid;
    align-content: center;
    gap: 1.7mm;
    padding: 2.2mm 3mm;
  }

  .aj-total-breakdown {
    display: grid;
    gap: 0.9mm;
    padding-bottom: 1.5mm;
    border-bottom: 0.2mm solid rgba(179, 122, 31, 0.42);
  }

  .aj-total-detail-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 3mm;
    color: #4b4037;
    font-size: 5.8pt;
    line-height: 1.1;
  }

  .aj-total-detail-row strong {
    color: var(--ink);
    font-size: 6pt;
    font-weight: 900;
    white-space: nowrap;
  }

  .aj-total-row-discount strong,
  .aj-total-row-change strong {
    color: var(--maroon);
  }

  .aj-total-row-paid strong {
    color: var(--gold);
  }

  .aj-total-box {
    display: grid;
    gap: 0.8mm;
    padding: 2.1mm 3.2mm;
    border-radius: 2mm;
    color: #000;
  }

  .aj-total-label {
    font-size: 5.3pt;
    font-weight: 900;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .aj-total-amount {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14.2pt;
    font-weight: 900;
    line-height: 1;
    white-space: nowrap;
  }

  .aj-qr-card {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 1mm;
    padding: 2mm;
    text-align: center;
  }

  .aj-qr-box {
    display: grid;
    width: 18mm;
    height: 18mm;
    place-items: center;
    overflow: hidden;
    background: #fff;
  }

  .aj-qr-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .aj-qr-label {
    padding: 0.7mm 1.5mm;
    border-radius: 999px;
    color: #fffdf7;
    background: var(--maroon);
    font-size: 4.5pt;
    font-weight: 900;
    text-transform: uppercase;
  }

  .aj-qr-note {
    color: var(--muted);
    font-size: 4.4pt;
    line-height: 1.2;
  }

  @media screen and (max-width: 860px) {
    .aj-receipt-stage {
      zoom: 0.92;
    }
  }

  @media screen and (max-width: 780px) {
    .aj-receipt-stage {
      zoom: 0.84;
    }
  }

  @media screen and (max-width: 700px) {
    .aj-receipt-stage {
      zoom: 0.75;
    }
  }

  @media screen and (max-width: 620px) {
    .aj-receipt-stage {
      zoom: 0.66;
    }
  }

  @media screen and (max-width: 540px) {
    .aj-receipt-stage {
      zoom: 0.57;
    }
  }

  @media screen and (max-width: 460px) {
    .aj-receipt-stage {
      zoom: 0.49;
    }
  }

  @media screen and (max-width: 390px) {
    .aj-receipt-stage {
      zoom: 0.44;
    }
  }

  @media screen and (max-height: 640px) and (min-width: 861px) {
    .aj-preview-shell {
      align-items: start;
    }
  }

  @media print {
    html,
    body {
      width: var(--receipt-page-width);
      min-height: var(--receipt-page-height);
      margin: 0;
      padding: 0;
      background: #f9f9f9;
    }

    .aj-preview-shell {
      display: block;
      width: var(--receipt-page-width);
      min-height: 0;
      overflow: visible;
      padding: 0;
      background: #f9f9f9;
    }

    .aj-receipt-stage {
      display: block;
      width: var(--receipt-page-width);
      min-height: 0;
      gap: 0;
      zoom: 1;
    }

    .aj-receipt-page {
      margin: 0;
    }

    .aj-receipt-design {
      box-shadow: none;
    }
  }
`;

function formatAmount(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "Rp 0";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function toNumber(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return amount;
}

function formatNegativeAmount(value: string | number | null | undefined) {
  const amount = toNumber(value);

  if (amount <= 0) {
    return formatAmount(0);
  }

  return `-${formatAmount(amount)}`;
}

function formatDeductionPerGram(value: string | number | null | undefined) {
  const amount = toNumber(value);

  if (amount <= 0) {
    return "-";
  }

  return formatAmount(amount);
}

function formatDate(value: Date | null, timezone: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  })
    .format(value)
    .replace(".", "");
}

function formatGram(value: string | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "-";
  }

  return `${amount.toLocaleString("id-ID", { maximumFractionDigits: 2 })} g`;
}

function formatPercent(value: string | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "-";
  }

  return `${amount.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

function buildProductMeta(item: ReceiptCertificateData["items"][number]) {
  const itemName = getItemName(item);
  const masterProductName =
    item.snapshot.masterProductName ??
    (item.snapshot.itemDisplayName ? item.snapshot.productName : null);

  if (!masterProductName || masterProductName === itemName) {
    return null;
  }

  return masterProductName;
}

function getProductCode(item: ReceiptCertificateData["items"][number]) {
  return (
    item.snapshot.barcode ??
    item.snapshot.qrValue ??
    item.snapshot.serialNumber ??
    item.snapshot.sku ??
    "-"
  );
}

function getItemName(item: ReceiptCertificateData["items"][number]) {
  return (
    item.snapshot.itemDisplayName ??
    item.snapshot.productName ??
    item.snapshot.masterProductName ??
    item.snapshot.productCode ??
    "Item Perhiasan"
  );
}

function getThumbnailLabel(item: ReceiptCertificateData["items"][number]) {
  return item.snapshot.categoryName ?? "Produk";
}

function getProductImageKey(item: ReceiptCertificateData["items"][number]) {
  return item.snapshot.imageKey ?? item.snapshot.productImageKey ?? null;
}

function getMediaImageUrl(imageKey: string) {
  const normalizedKey = imageKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/media/${normalizedKey}`;
}

function ProductThumbnail({
  item,
}: {
  item: ReceiptCertificateData["items"][number];
}) {
  const imageKey = getProductImageKey(item);

  if (!imageKey) {
    return (
      <div className="aj-thumb aj-thumb-fallback">
        {getThumbnailLabel(item)}
      </div>
    );
  }

  return (
    <div className="aj-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getMediaImageUrl(imageKey)} alt={getItemName(item)} />
    </div>
  );
}

function getPaymentSummary(data: ReceiptCertificateData) {
  if (data.payments.length === 0) {
    return "Pembayaran tercatat";
  }

  const methodLabels: Record<string, string> = {
    bank_transfer: "Transfer",
    cash: "Cash",
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    qris_manual: "QRIS",
    qris_gateway: "QRIS",
  };

  return data.payments
    .map(
      (payment) =>
        methodLabels[payment.method] ?? payment.method.replaceAll("_", " "),
    )
    .join(" + ");
}

function buildProfileStyles(documentProfileId: ReceiptDocumentProfileId) {
  const profile = resolveReceiptDocumentProfile(documentProfileId);

  return String.raw`
    @page {
      size: ${profile.cssPageSize};
      margin: 0;
    }

    :root {
      --receipt-page-width: ${profile.widthMm}mm;
      --receipt-page-height: ${profile.heightMm}mm;
      --receipt-design-scale: ${profile.designScale};
    }
  `;
}

export function ReceiptCertificateHtmlDocument({
  data,
  documentProfileId = DEFAULT_RECEIPT_DOCUMENT_PROFILE_ID,
}: {
  data: ReceiptCertificateData;
  documentProfileId?: ReceiptDocumentProfileId;
}) {
  const customerName = data.customer?.fullName ?? "Pelanggan Umum";
  const customerPhone = data.customer?.phone ?? "-";
  const completedDate = formatDate(
    data.sale.completedAt,
    data.organization.timezone,
  );
  const certificateItems = data.items;
  const pageCount = Math.max(certificateItems.length, 1);
  const paymentSummary = getPaymentSummary(data);
  const verificationQrImage = createQrSvgDataUri(data.verification.url);

  return (
    <div
      className={`aj-preview-shell${pageCount <= 1 ? " aj-preview-shell-single" : ""}`}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `${buildProfileStyles(documentProfileId)}${styles}`,
        }}
      />
      <div className="aj-receipt-stage">
        {certificateItems.map((item, itemIndex) => {
          const pageNumber = itemIndex + 1;
          const itemSubtotalAmount = toNumber(item.listPriceAmount);
          const itemDiscountAmount = toNumber(item.discountAmount);
          const itemTotalAmount = toNumber(item.finalPriceAmount);

          return (
            <article
              className="aj-receipt-page"
              key={item.lineNumber}
              aria-label={`Nota dan certificate pembelian item ${pageNumber} dari ${pageCount}`}
            >
              <div className="aj-receipt-design">
                <div className="aj-watermark">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo/nota-logo.png" alt="" />
                </div>
                <div className="aj-document-content">
                <header className="aj-header">
                  <div className="aj-logo-block">
                    <div className="aj-logo-ring">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="aj-logo"
                        src="/logo/nota-logo.png"
                        alt="Asih Jaya"
                      />
                    </div>
                  </div>

                  <div className="aj-brand-block">
                    <div className="aj-eyebrow">
                      Nota Pembelian & Certificate
                    </div>
                    <div className="aj-brand-title">Toko Emas Asih Jaya</div>
                    <div className="aj-branch-title">{data.outlet.name}</div>
                    <div className="aj-contact-lines">
                      <span className="aj-contact-item">
                        {data.outlet.address ?? "Alamat outlet belum diatur"}
                      </span>
                      <span className="aj-contact-item">
                        Whatsapp: {data.outlet.phone ?? "-"}
                      </span>
                      <span className="aj-contact-item">
                        Instagram: @asihjaya.bantargebang
                      </span>
                    </div>
                  </div>

                  <aside className="aj-certificate-card">
                    <div className="aj-summary-lines">
                      <div className="aj-summary-row">
                        <span>No. Order :</span>
                        <span className="aj-summary-value">
                          {data.sale.invoiceNumber}
                        </span>
                      </div>
                      <div className="aj-summary-row">
                        <span>Item :</span>
                        <span className="aj-summary-value">
                          {pageNumber} dari {pageCount}
                        </span>
                      </div>
                      <div className="aj-summary-row">
                        <span>Tanggal :</span>
                        <span className="aj-summary-value">
                          {completedDate}
                        </span>
                      </div>
                      <div className="aj-summary-row">
                        <span>Sales :</span>
                        <span className="aj-summary-value">
                          {data.cashier.fullName}
                        </span>
                      </div>
                    </div>
                  </aside>
                </header>

                <section className="aj-info-strip">
                  <div className="aj-info-box">
                    <div>
                      <div className="aj-info-label">Konsumen</div>
                      <div className="aj-info-value">{customerName}</div>
                    </div>
                  </div>
                  <div className="aj-info-box">
                    <div>
                      <div className="aj-info-label">Telepon</div>
                      <div className="aj-info-value">{customerPhone}</div>
                    </div>
                  </div>
                  <div className="aj-info-box aj-payment-badge">
                    {paymentSummary}
                  </div>
                </section>

                <section className="aj-products-card">
                  <div className="aj-products-grid aj-products-grid-single">
                    <div className="aj-product-row aj-product-head">
                      <div className="aj-head-center">KODE</div>
                      <div className="aj-head-center">FOTO</div>
                      <div>PRODUCT</div>
                      <div className="aj-head-center">KADAR ±%</div>
                      <div className="aj-head-center">GRAM</div>
                      <div className="aj-head-center">POTONGAN /GRAM</div>
                      <div className="aj-head-right">HARGA</div>
                    </div>
                    <div className="aj-product-row aj-product-body">
                      <div className="aj-code">{getProductCode(item)}</div>
                      <ProductThumbnail item={item} />
                      <div className="aj-product-copy">
                        <div className="aj-product-name">
                          {getItemName(item)}
                        </div>
                        <div className="aj-product-meta">
                          {buildProductMeta(item)}
                        </div>
                      </div>
                      <div className="aj-kadar">
                        {formatPercent(item.snapshot.exchangePurityPercent)}
                      </div>
                      <div className="aj-gram">
                        {formatGram(item.snapshot.weightGram)}
                      </div>
                      <div className="aj-deduction">
                        {formatDeductionPerGram(item.snapshot.deductionPerGram)}
                      </div>
                      <div className="aj-price">
                        {formatAmount(item.finalPriceAmount)}
                      </div>
                    </div>
                  </div>
                </section>

                <footer className="aj-footer">
                  <section className="aj-notes">
                    <div className="aj-notes-title">Perhatian</div>
                    <ol className="aj-terms">
                      {receiptTerms.map((term) => (
                        <li key={term}>{term}</li>
                      ))}
                    </ol>
                  </section>

                  <section className="aj-total-card">
                    <div
                      className="aj-total-breakdown"
                      aria-label="Rincian harga item"
                    >
                      <div className="aj-total-detail-row">
                        <span>Harga Item</span>
                        <strong>{formatAmount(itemSubtotalAmount)}</strong>
                      </div>
                      {itemDiscountAmount > 0 ? (
                        <div className="aj-total-detail-row aj-total-row-discount">
                          <span>Diskon Item</span>
                          <strong>
                            {formatNegativeAmount(itemDiscountAmount)}
                          </strong>
                        </div>
                      ) : null}
                      {pageCount > 1 ? (
                        <div className="aj-total-detail-row">
                          <span>Total Order</span>
                          <strong>{formatAmount(data.sale.totalAmount)}</strong>
                        </div>
                      ) : null}
                    </div>
                    <div className="aj-total-box">
                      <span className="aj-total-label">Total Item</span>
                      <strong className="aj-total-amount">
                        {formatAmount(itemTotalAmount)}
                      </strong>
                    </div>
                  </section>

                  <section className="aj-qr-card">
                    <div className="aj-qr-box">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={verificationQrImage} alt="QR verifikasi nota" />
                    </div>
                    <div className="aj-qr-label">Scan Keaslian</div>
                    <div className="aj-qr-note">
                      Pindai QR untuk verifikasi nota
                    </div>
                  </section>
                  </footer>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
