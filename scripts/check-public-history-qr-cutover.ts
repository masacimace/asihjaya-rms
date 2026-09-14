import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  if (!existsSync(file)) throw new Error(`${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const tokenSource = read(
  "src/features/sales/verification/receipt-token.ts",
);
const saleReceipt = read(
  "src/features/sales/documents/receipt-certificate.ts",
);
const buybackReceipt = read(
  "src/features/buybacks/documents/buyback-receipt.ts",
);
const saleAdminQueries = read("src/features/sales/admin-queries.ts");
const publicHistory = read("src/features/customers/public-history.ts");
const customerDetailPage = read(
  "src/app/(admin)/admin/pelanggan/[customerId]/page.tsx",
);

assert(
  tokenSource.includes("createPublicHistoryVerificationUrl") &&
    tokenSource.includes("v3.${transactionKind}"),
  "Generator Public History v3 tidak tersedia.",
);

assert(
  saleReceipt.includes("createPublicHistoryVerificationUrl") &&
    saleReceipt.includes('transactionKind: "sale"') &&
    !saleReceipt.includes("createReceiptVerificationUrl(sale.saleId)"),
  "Receipt Sale baru belum cutover ke QR Public History v3.",
);

assert(
  buybackReceipt.includes("createPublicHistoryVerificationUrl") &&
    buybackReceipt.includes('transactionKind: "buyback"') &&
    !buybackReceipt.includes("/pos/buyback?detail=") &&
    !buybackReceipt.includes("getBuybackDetailQrValue"),
  "Receipt Buyback baru masih memakai QR internal POS.",
);

assert(
  saleAdminQueries.includes("createPublicHistoryVerificationUrl") &&
    saleAdminQueries.includes('transactionKind: "sale"'),
  "Receipt / Certificate Admin Sale belum menunjuk ke Public History v3.",
);

assert(
  publicHistory.includes("export async function getPublicCustomerPortalEntry") &&
    publicHistory.includes('kind: "sale"') &&
    publicHistory.includes('kind: "buyback"') &&
    publicHistory.includes("createPublicHistoryVerificationUrl"),
  "Shortcut Customer Portal belum memilih latest eligible Sale / Buyback.",
);

assert(
  customerDetailPage.includes("Buka Customer Portal") &&
    customerDetailPage.includes("getPublicCustomerPortalEntry") &&
    customerDetailPage.includes('target="_blank"') &&
    customerDetailPage.includes("Customer Portal Belum Tersedia"),
  "Detail pelanggan belum memiliki shortcut Customer Portal yang aman.",
);

console.log(
  "Public History QR cutover contracts: OK — Sale/Buyback use v3, legacy compatibility remains, and Admin customer shortcut is wired.",
);
