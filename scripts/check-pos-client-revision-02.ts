import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

const posShellSource = source("src/components/layout/pos-shell.tsx");
const posLayoutSource = source("src/app/(pos)/pos/layout.tsx");
const posCreatePageSource = source("src/app/(pos)/pos/produk/tambah/page.tsx");
const productItemFormSource = source("src/components/inventory/product-item-form.tsx");
const productItemActionSource = source("src/app/actions/product-items.ts");
const productMasterActionSource = source("src/app/actions/product-masters.ts");
const quickMasterDialogSource = source(
  "src/components/products/quick-product-master-dialog.tsx",
);
const posWorkspaceSource = source("src/components/pos/pos-workspace.tsx");
const checkoutSoundSource = source("src/features/pos/use-pos-checkout-sound.ts");

const desktopHomeIndex = posShellSource.indexOf(
  '{ label: "Beranda", href: "/pos", icon: ShoppingBag }',
);
const desktopCreateIndex = posShellSource.indexOf(
  'label: "Tambah Produk",\n    href: "/pos/produk/tambah"',
);
const desktopTransactionIndex = posShellSource.indexOf('label: "Transaksi",');

assert.ok(desktopHomeIndex >= 0, "Menu desktop Beranda harus tersedia.");
assert.ok(
  desktopCreateIndex > desktopHomeIndex &&
    desktopCreateIndex < desktopTransactionIndex,
  "Tambah Produk desktop harus berada tepat di area setelah Beranda dan sebelum Transaksi.",
);

const mobileMoreStart = posShellSource.indexOf("const mobileMoreNavigation = [");
const mobileCreateIndex = posShellSource.indexOf(
  'label: "Tambah Produk",\n    href: "/pos/produk/tambah"',
  mobileMoreStart,
);
const mobileHeldIndex = posShellSource.indexOf(
  '{ label: "Transaksi Tertahan", href: "/pos/ditahan", icon: Pause }',
  mobileMoreStart,
);
assert.ok(
  mobileCreateIndex >= 0 && mobileCreateIndex < mobileHeldIndex,
  "Tambah Produk mobile harus berada di Menu Lainnya sebelum Transaksi Tertahan.",
);
assert.match(posShellSource, /canCreateProducts/);
assert.match(posLayoutSource, /canCreateProducts: hasPermission\(auth, "sales\.create"\)/);

assert.match(posCreatePageSource, /requirePermission\("pos\.access"\)/);
assert.match(posCreatePageSource, /hasPermission\(auth, "sales\.create"\)/);
assert.match(posCreatePageSource, /allowedOutletIds: primaryOutlet \? \[primaryOutlet\.id\] : \[\]/);
assert.match(posCreatePageSource, /creationSource="pos"/);
assert.match(posCreatePageSource, /canCreateProductMaster/);

assert.match(productItemFormSource, /creationSource\?: "admin" \| "pos"/);
assert.match(productItemFormSource, /name="creationSource" value=\{creationSource\}/);
assert.match(quickMasterDialogSource, /name="creationSource" value=\{creationSource\}/);

assert.match(productItemActionSource, /creationSource === "pos"[\s\S]*requirePermission\("sales\.create"\)/);
assert.match(productItemActionSource, /!auth\.permissionCodes\.includes\("pos\.access"\)/);
assert.match(productItemActionSource, /creationSource === "pos"[\s\S]*primaryOutlet\?\.id/);
assert.match(productItemActionSource, /revalidatePath\("\/pos"\)/);
assert.match(productItemActionSource, /redirect\(`\/pos\?createdProductItem=\$\{itemId\}`\)/);
assert.match(productItemActionSource, /pos_simple_product_create_v1/);

assert.match(
  productMasterActionSource,
  /creationSource === "buyback"[\s\S]*"buybacks\.create"[\s\S]*creationSource === "pos"[\s\S]*"sales\.create"[\s\S]*"products\.manage"/,
);
assert.match(productMasterActionSource, /pos_product_item_form/);
assert.match(productMasterActionSource, /revalidatePath\("\/pos\/produk\/tambah"\)/);

assert.match(checkoutSoundSource, /\/sounds\/admin-notification\.mp3/);
assert.match(checkoutSoundSource, /lastPlayedSaleIdRef/);
assert.match(checkoutSoundSource, /audio\.currentTime = 0/);
assert.match(checkoutSoundSource, /audio\.play\(\)\.catch/);
assert.match(posWorkspaceSource, /usePosCheckoutSound\(\)/);
assert.match(posWorkspaceSource, /playCheckoutSuccessSound\(sale\.id\)/);
assert.match(posWorkspaceSource, /onCheckoutSuccess: handleCheckoutSuccess/);

console.log(
  "OK: Client Revision 02 POS product-create navigation/catalog return flow and checkout-success sound contracts passed.",
);
