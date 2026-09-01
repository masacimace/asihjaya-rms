import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const schemaSource = read("src/db/schema/index.ts");
const closingSource = read("src/lib/shifts/shift-closing.ts");
const reopenSource = read("src/lib/shifts/shift-reopen.ts");
const posActionSource = read("src/app/actions/pos.ts");
const posPageSource = read("src/app/(pos)/pos/page.tsx");
const controlsSource = read("src/components/pos/workspace/pos-shift-controls.tsx");
const shiftClosePanelSource = read("src/components/pos/shift-close-panel.tsx");
const adminCloseSource = read("src/components/shifts/close-shift-form.tsx");
const querySource = read("src/features/pos/queries.ts");

function contains(source: string, value: string, label: string) {
  assert.ok(source.includes(value), `${label} belum ditemukan.`);
}

contains(
  closingSource,
  "actualCash < 0",
  "actual cash tetap tidak boleh negatif",
);
contains(
  closingSource,
  "variance !== 0 && !normalizedInput.varianceReason",
  "variance tetap membutuhkan alasan audit",
);
contains(
  reopenSource,
  'auth.permissionCodes.includes("shifts.manage")',
  "same-day continuation memakai shifts.manage",
);
assert.equal(
  reopenSource.includes('auth.permissionCodes.includes("shifts.reopen")'),
  false,
  "runtime continuation tidak boleh lagi bergantung pada shifts.reopen.",
);
contains(
  reopenSource,
  "getBusinessDateKey(now, auth.organization.timezone)",
  "continuation memakai timezone organisasi",
);
contains(
  querySource,
  "getBusinessDateKey(new Date(), timezone)",
  "reopen candidate memakai timezone organisasi",
);
contains(
  reopenSource,
  "shift.businessDate !== currentBusinessDate",
  "continuation hanya untuk business date yang sama",
);
contains(
  schemaSource,
  '"shifts_outlet_business_date_uq"',
  "satu shift per outlet/business date tetap dipertahankan",
);
contains(reopenSource, "supersededAt: now", "snapshot lama tetap superseded");
contains(reopenSource, 'reportType: "shift_reopened"', "Telegram reopen correction tetap ada");

contains(controlsSource, "Lanjutkan Shift Hari Ini", "copy continuation baru");
contains(controlsSource, "Toko masih beroperasi.", "quick reason continuation");
contains(controlsSource, "Shift tertutup terlalu cepat.", "quick reason accidental close");
contains(controlsSource, "Posisi kas sistem berada di bawah Rp0.", "negative expected warning");
contains(controlsSource, "Kas Fisik di Drawer", "physical cash label");
contains(controlsSource, "Selisih Rekonsiliasi", "reconciliation label");
contains(
  controlsSource,
  "Payout Buyback menggunakan kas di luar drawer.",
  "quick reason negative cash",
);

contains(shiftClosePanelSource, "Posisi kas sistem berada di bawah Rp0.", "shift page negative warning");
contains(shiftClosePanelSource, "Kas Fisik di Drawer", "shift page physical cash label");
contains(shiftClosePanelSource, "Selisih Rekonsiliasi", "shift page reconciliation label");
contains(adminCloseSource, "Posisi kas sistem berada di bawah Rp0.", "admin negative warning");
contains(adminCloseSource, "Kas fisik di drawer", "admin physical cash label");

contains(
  posPageSource,
  'canContinueShift={auth.permissionCodes.includes("shifts.manage")}',
  "POS exposes same-day continuation to shift managers",
);
contains(
  posActionSource,
  'const auth = await requirePermission("shifts.manage");',
  "server action uses shifts.manage",
);
contains(
  posActionSource,
  "gunakan Lanjutkan Shift Hari Ini",
  "duplicate business-date open gives continuation guidance",
);

console.log("PRE-R4 Shift UX refinement contracts: OK");
