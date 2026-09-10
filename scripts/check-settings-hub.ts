import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const hubSource = read("src/app/(admin)/admin/pengaturan/page.tsx");
const manualPageSource = read(
  "src/app/(admin)/admin/pengaturan/pembayaran/manual-edc/page.tsx",
);
const telegramPageSource = read(
  "src/app/(admin)/admin/pengaturan/integrasi/telegram/page.tsx",
);
const telegramDetailSource = read(
  "src/app/(admin)/admin/pengaturan/integrasi/telegram/delivery/[deliveryId]/page.tsx",
);
const productColorPageSource = read(
  "src/app/(admin)/admin/pengaturan/warna-produk/page.tsx",
);
const legacyTelegramSource = read(
  "src/app/(admin)/admin/integrasi/telegram/page.tsx",
);
const legacyTelegramDetailSource = read(
  "src/app/(admin)/admin/integrasi/telegram/delivery/[deliveryId]/page.tsx",
);
const shellSource = read("src/components/layout/admin-shell.tsx");
const manualActionSource = read("src/app/actions/manual-payment-settings.ts");
const telegramActionSource = read("src/app/actions/telegram-settings.ts");
const productColorActionSource = read("src/app/actions/product-color-presets.ts");
const productItemFormSource = read("src/components/inventory/product-item-form.tsx");
const productItemEditFormSource = read(
  "src/components/inventory/product-item-edit-form.tsx",
);
const buybackWorkspaceSource = read(
  "src/components/buybacks/buyback-workspace.tsx",
);
const buybackProcessingWorkspaceSource = read(
  "src/components/buybacks/buyback-processing-workspace.tsx",
);
const productItemActionSource = read("src/app/actions/product-items.ts");
const buybackActionSource = read("src/app/actions/buybacks.ts");
const buybackProcessingActionSource = read(
  "src/app/actions/buyback-processing.ts",
);

assert(
  hubSource.includes('requirePermission("settings.manage")'),
  "Settings Hub wajib memakai permission settings.manage.",
);
assert(
  hubSource.includes('href: "/admin/pengaturan/pembayaran/manual-edc"') &&
    hubSource.includes('href: "/admin/pengaturan/integrasi/telegram"') &&
    hubSource.includes('href: "/admin/pengaturan/warna-produk"'),
  "Settings Hub wajib menyediakan entry Manual EDC, Telegram Reporting, dan Varian Warna Produk.",
);
assert(
  manualPageSource.includes('requirePermission("settings.manage")') &&
    telegramPageSource.includes('requirePermission("settings.manage")') &&
    telegramDetailSource.includes('requirePermission("settings.manage")') &&
    productColorPageSource.includes('requirePermission("settings.manage")'),
  "Subpage Pengaturan wajib mempertahankan permission settings.manage.",
);
assert(
  shellSource.includes('label: "Pengaturan"') &&
    shellSource.includes('href: "/admin/pengaturan"') &&
    !shellSource.includes('label: "Integrasi"') &&
    !shellSource.includes('href: "/admin/integrasi/telegram"'),
  "Sidebar harus memiliki satu entry Pengaturan tanpa menu Integrasi Telegram terpisah.",
);
assert(
  manualActionSource.includes(
    'const SETTINGS_PATH = "/admin/pengaturan/pembayaran/manual-edc"',
  ),
  "Manual EDC action harus redirect kembali ke subpage Manual EDC.",
);
assert(
  telegramActionSource.includes(
    'const TELEGRAM_ADMIN_PATH = "/admin/pengaturan/integrasi/telegram"',
  ),
  "Telegram action harus redirect/revalidate route baru di Settings Hub.",
);
assert(
  productColorActionSource.includes(
    'const SETTINGS_PATH = "/admin/pengaturan/warna-produk"',
  ) &&
    productColorActionSource.includes('requirePermission("settings.manage")') &&
    productColorActionSource.includes('product_color_presets_org_name_ci_uq'),
  "Preset warna produk wajib memakai route Settings Hub, permission settings.manage, dan unique-name guard.",
);
assert(
  productItemFormSource.includes('name="color"') &&
    productItemFormSource.includes("colorPresets.map") &&
    productItemEditFormSource.includes('name="color"') &&
    productItemEditFormSource.includes("colorPresets.map") &&
    buybackWorkspaceSource.includes("colorPresets.map") &&
    buybackProcessingWorkspaceSource.includes("colorPresets.map"),
  "Tambah Produk, Edit Item, Buyback, dan Pemrosesan Buyback wajib memakai preset warna.",
);
assert(
  productItemActionSource.includes("resolveActiveProductColorPresetName") &&
    buybackActionSource.includes("getActiveProductColorPresetMap") &&
    buybackProcessingActionSource.includes("resolveActiveProductColorPresetName"),
  "Validasi preset warna wajib dipertahankan di server action, bukan hanya UI dropdown.",
);
assert(
  telegramPageSource.includes(
    "/admin/pengaturan/integrasi/telegram/delivery/",
  ) &&
    telegramDetailSource.includes(
      'href="/admin/pengaturan/integrasi/telegram"',
    ),
  "Link delivery Telegram harus memakai route baru di bawah /admin/pengaturan.",
);
assert(
  legacyTelegramSource.includes(
    'redirect("/admin/pengaturan/integrasi/telegram")',
  ) &&
    legacyTelegramDetailSource.includes(
      "/admin/pengaturan/integrasi/telegram/delivery/",
    ),
  "Route Telegram lama harus menjadi compatibility redirect ke Settings Hub.",
);
assert(
  !hubSource.includes("TELEGRAM_BOT_TOKEN") &&
    !telegramPageSource.includes("TELEGRAM_BOT_TOKEN") &&
    !telegramDetailSource.includes("TELEGRAM_BOT_TOKEN"),
  "Settings Hub dan Telegram UI tidak boleh mereferensikan bot token.",
);

console.log(
  "Settings Hub checks passed: navigation, preset warna + 4 consumer flow, server validation, permission guard, dan integrasi existing tetap aman.",
);
