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
const legacyTelegramSource = read(
  "src/app/(admin)/admin/integrasi/telegram/page.tsx",
);
const legacyTelegramDetailSource = read(
  "src/app/(admin)/admin/integrasi/telegram/delivery/[deliveryId]/page.tsx",
);
const shellSource = read("src/components/layout/admin-shell.tsx");
const manualActionSource = read("src/app/actions/manual-payment-settings.ts");
const telegramActionSource = read("src/app/actions/telegram-settings.ts");

assert(
  hubSource.includes('requirePermission("settings.manage")'),
  "Settings Hub wajib memakai permission settings.manage.",
);
assert(
  hubSource.includes('href: "/admin/pengaturan/pembayaran/manual-edc"') &&
    hubSource.includes('href: "/admin/pengaturan/integrasi/telegram"'),
  "Settings Hub wajib menyediakan entry Manual EDC dan Telegram Reporting.",
);
assert(
  manualPageSource.includes('requirePermission("settings.manage")') &&
    telegramPageSource.includes('requirePermission("settings.manage")') &&
    telegramDetailSource.includes('requirePermission("settings.manage")'),
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
  "Settings Hub 2C.9B checks passed: hub navigation, Manual EDC route, Telegram route refactor, legacy redirects, permission guard, dan token isolation.",
);
