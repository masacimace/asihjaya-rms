import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const schema = read("src/db/schema/index.ts");
const seed = read("src/db/seed.ts");
const reopen = read("src/lib/shifts/shift-reopen.ts");
const posActions = read("src/app/actions/pos.ts");
const dailyService = read(
  "src/server/integrations/telegram/telegram-daily-service.ts",
);
const dailyReport = read(
  "src/server/integrations/telegram/telegram-daily-report.ts",
);
const preR4ShiftCheck = read("scripts/check-pre-r4-shift-ux.ts");

// Permission lama sudah tidak punya authorization semantics setelah same-day
// continuation memakai shifts.manage.
assert.equal(
  seed.includes('code: "shifts.reopen"'),
  false,
  "permission shifts.reopen tidak boleh di-seed lagi",
);
assert.equal(
  seed.includes('"shifts.reopen"'),
  false,
  "role permission map tidak boleh membawa shifts.reopen",
);
assert.match(
  posActions,
  /reopenPosShiftAction[\s\S]*requirePermission\("shifts\.manage"\)/,
  "server action continuation tetap wajib shifts.manage",
);
assert.equal(
  reopen.includes('auth.permissionCodes.includes("shifts.reopen")'),
  false,
  "runtime continuation tidak boleh bergantung pada shifts.reopen",
);
assert.match(
  preR4ShiftCheck,
  /same-day continuation memakai shifts\.manage/,
  "PRE-R4 regression contract shifts.manage tetap tersedia",
);

// Reopen sebagai BUSINESS EVENT tetap dipertahankan; yang retired hanya permission
// khususnya. Snapshot supersede dan Telegram correction tidak boleh hilang.
assert.match(reopen, /action: "shift\.reopen"/, "audit event reopen tetap ada");
assert.match(reopen, /reportType: "shift_reopened"/, "Telegram correction tetap ada");
assert.match(reopen, /supersededAt: now/, "finance snapshot supersede tetap ada");

// Approval workflow sudah retired sejak R4.2A, sehingga finance closing snapshot
// tidak perlu lagi membawa metric yang secara permanen selalu 0.
assert.equal(
  schema.includes("pendingApprovalCount"),
  false,
  "Drizzle schema tidak boleh membawa pendingApprovalCount",
);
assert.equal(
  schema.includes('integer("pending_approval_count")'),
  false,
  "final schema tidak boleh membawa pending_approval_count",
);
assert.equal(
  dailyService.includes("pendingApprovalCount"),
  false,
  "Telegram finance calculation tidak boleh menghasilkan metric approval retired",
);
assert.equal(
  dailyReport.includes("pendingApprovalCount"),
  false,
  "Telegram payload/report tidak boleh bergantung pada approval retired",
);

// Active final contracts tetap ada.
for (const permission of ["shifts.manage", "migration.view", "migration.import"]) {
  assert.match(seed, new RegExp(`code: "${permission.replace(".", "\\.")}"`));
}
assert.match(schema, /export const financeClosingSnapshots = pgTable\(/);
assert.match(schema, /heldTransactionCount: integer\("held_transaction_count"\)/);
assert.match(schema, /costSnapshotComplete: boolean\("cost_snapshot_complete"\)/);

console.log("R4.2C final permission + finance snapshot contracts: OK");
