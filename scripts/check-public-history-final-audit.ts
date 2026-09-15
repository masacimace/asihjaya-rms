import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert.ok(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

const tokenSource = read("src/features/sales/verification/receipt-token.ts");
const saleReceipt = read("src/features/sales/documents/receipt-certificate.ts");
const buybackReceipt = read("src/features/buybacks/documents/buyback-receipt.ts");
const publicHistory = read("src/features/customers/public-history.ts");
const imageRoute = read("src/app/v/[token]/image/[...key]/route.ts");
const historyAccess = read("src/features/customers/history-access.ts");
const pinPolicy = read("src/features/customers/history-pin-policy.ts");
const customerHistoryActions = read("src/app/actions/customer-history.ts");
const publicPage = read("src/app/v/[token]/page.tsx");
const portal = read("src/components/customers/public-history-portal.tsx");
const localAvatar = read(
  "src/components/customers/public-history-local-avatar.tsx",
);
const customerDetailPage = read(
  "src/app/(admin)/admin/pelanggan/[customerId]/page.tsx",
);

for (const asset of [
  "public/customer-history/background-mobile.webp",
  "public/customer-history/background-desktop.webp",
]) {
  assert.ok(existsSync(path.join(root, asset)), `${asset} tidak ditemukan.`);
}

assert.match(tokenSource, /V3_TOKEN_PATTERN/);
assert.match(tokenSource, /v3\.\$\{transactionKind\}/);
assert.match(tokenSource, /verifyReceiptVerificationToken\(normalizedToken\)/);
assert.match(tokenSource, /timingSafeEqual/);

assert.match(saleReceipt, /createPublicHistoryVerificationUrl/);
assert.match(saleReceipt, /transactionKind: "sale"/);
assert.match(buybackReceipt, /createPublicHistoryVerificationUrl/);
assert.match(buybackReceipt, /transactionKind: "buyback"/);
assert.doesNotMatch(buybackReceipt, /\/pos\/buyback\?detail=/);

assert.match(publicHistory, /const PUBLIC_HISTORY_LIMIT = 50/);
assert.match(publicHistory, /kind: "sale"/);
assert.match(publicHistory, /kind: "buyback"/);
assert.match(publicHistory, /getCustomerDepositBalancesForCustomer/);
assert.match(publicHistory, /withdrawalScope: "outlet_only"/);
assert.match(
  publicHistory,
  /eq\(sales\.organizationId, baseTransaction\.organizationId\)/,
);
assert.match(publicHistory, /eq\(sales\.customerId, baseTransaction\.customerId\)/);
assert.match(
  publicHistory,
  /eq\(buybacks\.organizationId, baseTransaction\.organizationId\)/,
);
assert.match(
  publicHistory,
  /eq\(buybacks\.customerId, baseTransaction\.customerId\)/,
);
assert.doesNotMatch(
  publicHistory,
  /eq\(sales\.outletId, baseTransaction\.outletId\)/,
);
assert.doesNotMatch(
  publicHistory,
  /eq\(buybacks\.outletId, baseTransaction\.outletId\)/,
);
assert.match(publicHistory, /recentTransactions/);
assert.match(publicHistory, /scannedTransaction/);

assert.match(imageRoute, /getPublicCustomerHistoryAccessContext/);
assert.match(imageRoute, /getCurrentCustomerHistorySession/);
assert.match(imageRoute, /eq\(sales\.customerId, accessContext\.customer\.id\)/);
assert.match(
  imageRoute,
  /eq\(buybacks\.customerId, accessContext\.customer\.id\)/,
);
assert.match(imageRoute, /eq\(buybacks\.status, "completed"\)/);
assert.match(imageRoute, /"Cache-Control": "private, no-store"/);
assert.doesNotMatch(imageRoute, /session\.requiresPinChange/);

assert.match(pinPolicy, /const PIN_PATTERN = \/\^\\d\{6\}\$\//);
assert.doesNotMatch(pinPolicy, /COMMON_PINS/);
assert.doesNotMatch(pinPolicy, /isSequentialPin/);
assert.doesNotMatch(pinPolicy, /isRepeatingPattern/);
assert.match(customerHistoryActions, /validateCustomerHistoryPin\(\{ pin, phone: null \}\)/);
assert.match(customerHistoryActions, /mustChangePin: false/);
assert.match(customerHistoryActions, /rotatePublicCustomerHistoryPinAction/);
assert.match(customerHistoryActions, /recordCustomerHistoryPinFailure/);
assert.match(customerHistoryActions, /customerHistorySessions/);
assert.doesNotMatch(customerHistoryActions, /changePublicCustomerHistoryPinAction/);
assert.doesNotMatch(publicPage, /InitialPinChangeState/);

assert.match(historyAccess, /const CUSTOMER_FAILURE_LIMIT = 5/);
assert.match(historyAccess, /const CUSTOMER_LOCK_DURATION_MS = 15 \* 60 \* 1000/);
assert.match(historyAccess, /const IP_FAILURE_LIMIT = 20/);
assert.match(historyAccess, /httpOnly: true/);

assert.match(portal, /Semua/);
assert.match(portal, /Pembelian/);
assert.match(portal, /Buyback/);
assert.match(portal, /Sedang Dilihat/);
assert.match(portal, /transactionKey\(data\.scannedTransaction\)/);
assert.match(localAvatar, /indexedDB\.open/);

assert.match(customerDetailPage, /getPublicCustomerPortalEntry/);
assert.match(customerDetailPage, /Buka Customer Portal/);
assert.match(customerDetailPage, /target="_blank"/);

console.log(
  "Public History final audit contracts: OK — unified Sale/Buyback history, v3 QR cutover, legacy Sale compatibility, simplified PIN security, outlet-bound Dana Titip, protected images, admin shortcut, and portal UX are wired consistently.",
);
