import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  new URL(
    "../src/app/(admin)/admin/penjualan/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const imageQuerySource = readFileSync(
  new URL(
    "../src/features/sales/admin-sale-list-images.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.match(pageSource, /Daftar transaksi POS/);
assert.match(pageSource, /data-sales-layout="compact-transaction-row"/);
assert.match(pageSource, /getAdminSaleListImagePreviews/);
assert.match(pageSource, /getImageUrl\(item\.imageKey\)/);
assert.match(pageSource, /previewItems = sale\.items\.slice\(0, 3\)/);
assert.match(pageSource, /hiddenThumbnailCount/);
assert.match(pageSource, /<img/);
assert.match(pageSource, /ImageIcon/);
assert.match(pageSource, /Produk/);
assert.match(pageSource, /Customer/);
assert.match(pageSource, /Outlet \/ Kasir/);
assert.match(pageSource, /Payment/);
assert.match(pageSource, /Detail transaksi/);
assert.match(pageSource, /PaymentBadges/);
assert.match(pageSource, /getPaymentDisplayClass/);
assert.match(pageSource, /buildAdminSalesListUrl/);
assert.match(pageSource, /parseAdminSalesFilters/);
assert.doesNotMatch(pageSource, /<TransactionMetric/);
assert.doesNotMatch(pageSource, /function TransactionMetric/);
assert.doesNotMatch(pageSource, /ImageLightbox/);
assert.doesNotMatch(pageSource, /ProductImage/);

assert.match(
  imageQuerySource,
  /const ADMIN_SALE_LIST_IMAGE_PREVIEW_LIMIT = 3/,
);
assert.match(
  imageQuerySource,
  /nullif\(\$\{saleItems\.snapshot\}->>'imageKey', ''\)/,
);
assert.match(
  imageQuerySource,
  /nullif\(\$\{saleItems\.snapshot\}->>'productImageKey', ''\)/,
);
assert.match(imageQuerySource, /\$\{productItems\.imageKey\}/);
assert.match(imageQuerySource, /\$\{productMasters\.imageKey\}/);
assert.match(imageQuerySource, /eq\(sales\.organizationId, organizationId\)/);
assert.match(imageQuerySource, /inArray\(saleItems\.saleId, saleIds\)/);
assert.match(
  imageQuerySource,
  /inArray\(saleItems\.productItemId, productItemIds\)/,
);

console.log(
  "Admin sales compact image contracts: OK — compact row cards, max three non-interactive thumbnails, snapshot-first image fallback, existing filters/pagination preserved.",
);
