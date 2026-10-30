/**
 * ASIHJAYA A5 preprinted vendor-payment SOURCE contract.
 *
 * This check intentionally does NOT import ReceiptCertificateHtmlDocument:
 * the renderer calls next/font/local, which needs the Next.js compiler and
 * cannot be directly executed under `tsx`/Node.
 *
 * This is a source/CSS regression check, NOT a rendered-PDF or physical-print
 * verification. Keep the PDF/physical tests as separate acceptance steps.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepositoryFile(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  assert.ok(
    fs.existsSync(absolutePath),
    `File tidak ditemukan: ${absolutePath}. Jalankan dari root repository.`,
  );
  return fs.readFileSync(absolutePath, "utf8");
}

const component = readRepositoryFile(
  "src/features/sales/documents/receipt-certificate-html.tsx",
);
const overlayCss = readRepositoryFile(
  "src/features/sales/documents/receipt-certificate-overlay-client.css",
);

// 1. The payment card is present exactly once in the JSX template.
const startTag = '<section className="aj-total-card">';
const endTag = "</section>";
assert.equal(component.split(startTag).length - 1, 1, "Payment card template harus unik.");
const start = component.indexOf(startTag);
const end = component.indexOf(endTag, start);
assert.ok(end > start, "Payment card tidak ditutup dengan benar.");
const card = component.slice(start, end + endTag.length);

// 2. Each vendor-preprinted static label exists, in its fixed order.
const vendorLabels = [
  "Dana Titip",
  "Gunakan Saldo",
  "Harga Item",
  "Total Pembayaran",
] as const;
let lastPosition = -1;
for (const label of vendorLabels) {
  const position = card.indexOf(label);
  assert.ok(position > lastPosition, `Label ${label} hilang atau urutan berubah.`);
  assert.equal(card.split(label).length - 1, 1, `Label ${label} harus tepat sekali.`);
  lastPosition = position;
}

// 3. Discount and Total Order are genuinely omitted (not merely hidden) for
//    preprinted overlay AND vendor-static-artwork; remain in full_design.
assert.match(
  card,
  /\{\s*!isPreprintedOverlay\s*&&\s*!isVendorStaticArtwork\s*&&\s*itemDiscountAmount\s*>\s*0\s*\?\s*\(/,
  "Baris Diskon Item hanya boleh muncul pada full_design.",
);
assert.match(
  card,
  /\{\s*!isPreprintedOverlay\s*&&\s*!isVendorStaticArtwork\s*&&\s*pageCount\s*>\s*1\s*\?\s*\(/,
  "Baris Total Order multi-item hanya boleh muncul pada full_design.",
);
assert.match(card, /className="aj-total-detail-row aj-total-row-discount"/);
assert.match(card, />\s*Diskon Item\s*</);
assert.match(card, />\s*Total Order\s*</);

// 4. Overlay Harga Item is the final per-item amount, including discount and
//    any adjustments already accounted for by backend. Digital keeps list price.
assert.match(
  card,
  /formatAmount\(\s*isPreprintedOverlay\s*\?\s*item\.finalPriceAmount\s*:\s*itemSubtotalAmount\s*\)/,
  "Harga Item overlay harus memakai finalPriceAmount, bukan listPrice.",
);
assert.match(
  component,
  /const itemSubtotalAmount\s*=\s*toNumber\(item\.listPriceAmount\)/,
);
assert.match(
  component,
  /const itemDiscountAmount\s*=\s*toNumber\(item\.discountAmount\)/,
);

// 5. The amount billed still comes from existing backend data in both
//    the fourth payment line and the large amount below TOTAL ITEM.
assert.equal(
  (card.match(/data\.customerDeposit\.externalPaymentDueAmount/g) ?? []).length,
  2,
  "Total Pembayaran dan nominal besar harus memakai externalPaymentDueAmount dari backend.",
);
assert.match(card, /className="aj-total-label aj-static-artwork"/);
assert.match(card, /className="aj-total-amount aj-dynamic-print"/);
assert.match(card, />\s*Total Item\s*</);

// 6. Artwork and overlay use the same locked geometry. Full-design is excluded
//    from these selectors and retains the detailed document flow.
assert.match(overlayCss, /\[data-aj-receipt-render-mode="vendor_static_artwork"\]/);
assert.match(overlayCss, /\[data-aj-receipt-render-mode="preprinted_overlay"\]/);
assert.match(overlayCss, /\.aj-receipt-front-design\s+\.aj-total-card/);
assert.match(
  overlayCss,
  /grid-template-rows:\s*3\.7mm\s+3\.7mm\s+7\.4mm\s+minmax\(0,\s*1fr\)\s*!important/,
  "Geometri 4 baris pembayaran belum dikunci.",
);
assert.match(
  overlayCss,
  /grid-template-rows:\s*3\.7mm\s+3\.7mm\s*!important/,
);
assert.match(
  overlayCss,
  /grid-template-rows:\s*3\.2mm\s+min-content\s*!important/,
  "Track label TOTAL ITEM dan nominal besar belum dipisah.",
);

// 7. The previously approved image/QR overlay remains intact.
assert.match(overlayCss, /object-fit:\s*cover\s*!important/);
assert.match(overlayCss, /object-fit:\s*contain\s*!important/);

console.log("PASS: A5 vendor payment source/CSS contract (4 fixed rows).");
console.log("PASS: Discount and multi-item detail remain in full_design.");
console.log("PASS: Photo/QR media-fill rules preserved.");
console.log("NOTE: Ini static regression check, bukan hasil render PDF / print fisik.");
