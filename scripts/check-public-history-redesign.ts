import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert.ok(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

const page = read("src/app/v/[token]/page.tsx");
const portal = read("src/components/customers/public-history-portal.tsx");
const localAvatar = read(
  "src/components/customers/public-history-local-avatar.tsx",
);
const securityMenu = read(
  "src/components/customers/public-history-security-menu.tsx",
);
const accessCard = read(
  "src/components/customers/customer-history-access-card.tsx",
);
const publicHistory = read("src/features/customers/public-history.ts");
const customerHistoryActions = read("src/app/actions/customer-history.ts");

for (const asset of [
  "public/customer-history/background-mobile.webp",
  "public/customer-history/background-desktop.webp",
]) {
  assert.ok(existsSync(path.join(root, asset)), `${asset} tidak ditemukan.`);
}

assert.match(page, /PublicHistoryPortal/);
assert.match(page, /background-mobile\.webp/);
assert.match(page, /background-desktop\.webp/);
assert.match(localAvatar, /AVATAR_DATABASE = "asihjaya-customer-portal"/);
assert.match(localAvatar, /indexedDB\.open/);
assert.match(localAvatar, /canvas\.toBlob\(resolve, "image\/webp"/);
assert.match(portal, /storageKey=\{avatarStorageKey\}/);
assert.match(securityMenu, /Keamanan PIN/);
assert.match(securityMenu, /Keluar/);
assert.match(portal, /Semua/);
assert.match(portal, /Pembelian/);
assert.match(portal, /Buyback/);
assert.match(portal, /Riwayat Transaksi/);
assert.match(portal, /transactionKey\(data\.scannedTransaction\)/);
assert.match(portal, /openTransactionKey === key/);
assert.match(customerHistoryActions, /rotatePublicCustomerHistoryPinAction/);
assert.match(customerHistoryActions, /customer\.history_pin\.change/);
assert.match(accessCard, /name="pin"/);
assert.match(accessCard, /Buat Acak/);
assert.match(accessCard, /Kombinasi bebas/);
assert.match(customerHistoryActions, /mustChangePin: false/);
assert.doesNotMatch(
  customerHistoryActions,
  /changePublicCustomerHistoryPinAction/,
);
assert.doesNotMatch(page, /InitialPinChangeState/);
assert.match(publicHistory, /organizationId: baseTransaction\.organizationId/);
assert.match(publicHistory, /itemSummary: items\.map\(\(item\) => \(\{/);
assert.doesNotMatch(publicHistory, /itemSummary: items\.slice\(0, 4\)/);

console.log(
  "Public History redesign contracts: OK — glass portal, compact mobile density, local avatar, accordion history, PIN security, and responsive backgrounds are wired.",
);
