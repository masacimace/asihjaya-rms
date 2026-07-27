import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  addBusinessDays,
  getBusinessCompactDate,
  getBusinessDateKey,
  getStartOfBusinessDateKey,
  getStartOfBusinessDay,
  getStartOfBusinessMonth,
  normalizeBusinessTimeZone,
} from "../src/lib/time/business-time";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assertIso(actual: Date, expected: string, label: string) {
  assert.equal(actual.toISOString(), expected, label);
}

const beforeJakartaMidnight = new Date("2026-07-26T16:59:59.000Z");
const afterJakartaMidnight = new Date("2026-07-26T17:00:01.000Z");

assert.equal(
  getBusinessCompactDate(beforeJakartaMidnight, "Asia/Jakarta"),
  "20260726",
  "The business date before midnight WIB must remain July 26.",
);
assert.equal(
  getBusinessCompactDate(afterJakartaMidnight, "Asia/Jakarta"),
  "20260727",
  "The business date after midnight WIB must advance to July 27.",
);
assertIso(
  getStartOfBusinessDay(afterJakartaMidnight, "Asia/Jakarta"),
  "2026-07-26T17:00:00.000Z",
  "Jakarta midnight must map to the previous UTC date at 17:00.",
);
assertIso(
  getStartOfBusinessDay(afterJakartaMidnight, "Asia/Jakarta", -6),
  "2026-07-20T17:00:00.000Z",
  "Seven-day range must start at the organization's midnight.",
);
assertIso(
  getStartOfBusinessMonth(afterJakartaMidnight, "Asia/Jakarta"),
  "2026-06-30T17:00:00.000Z",
  "Month start must use the organization's calendar month.",
);
assertIso(
  getStartOfBusinessDateKey("2026-07-27", "Asia/Jakarta")!,
  "2026-07-26T17:00:00.000Z",
  "Date-only form values must resolve at the organization's midnight.",
);
assert.equal(
  getStartOfBusinessDateKey("2026-02-30", "Asia/Jakarta"),
  null,
  "Invalid calendar dates must be rejected.",
);

const newYorkSpringForward = new Date("2026-03-08T17:00:00.000Z");
const newYorkDayStart = getStartOfBusinessDay(
  newYorkSpringForward,
  "America/New_York",
);
const nextNewYorkDayStart = addBusinessDays(
  newYorkDayStart,
  1,
  "America/New_York",
);

assertIso(
  newYorkDayStart,
  "2026-03-08T05:00:00.000Z",
  "IANA timezone conversion must resolve the DST day's midnight.",
);
assertIso(
  nextNewYorkDayStart,
  "2026-03-09T04:00:00.000Z",
  "Adding one business day must preserve local midnight across DST.",
);
assert.equal(
  nextNewYorkDayStart.getTime() - newYorkDayStart.getTime(),
  23 * 60 * 60 * 1000,
  "The DST transition day must be 23 real hours without shifting the business date.",
);
assert.equal(
  getBusinessDateKey(nextNewYorkDayStart, "America/New_York"),
  "2026-03-09",
);
assert.equal(
  normalizeBusinessTimeZone("Invalid/Timezone"),
  "Asia/Jakarta",
  "Invalid organization timezones must fail safely to the application default.",
);

const criticalFiles = [
  "src/app/actions/pos.ts",
  "src/app/actions/customers.ts",
  "src/features/pos/queries.ts",
  "src/features/sales/admin-queries.ts",
  "src/features/reports/queries.ts",
  "src/features/admin/dashboard/queries.ts",
  "src/features/reconciliation/queries.ts",
  "src/features/cash-movements/queries.ts",
  "src/features/approvals/queries.ts",
  "src/features/customers/queries.ts",
  "src/features/notifications/queries.ts",
  "src/features/sales/correction-eligibility.ts",
  "src/app/actions/payment-reconciliation.ts",
  "src/features/reconciliation/csv-parser.ts",
];

for (const relativePath of criticalFiles) {
  const source = await readFile(path.join(rootDir, relativePath), "utf8");

  assert.doesNotMatch(
    source,
    /setHours\(0,\s*0,\s*0,\s*0\)|\.getFullYear\(\)|\.getMonth\(\)|\.getDate\(\)|JAKARTA_OFFSET_MS|getJakartaDayStartUtc|getJakartaMonthStartUtc|T00:00:00\+07:00/,
    `${relativePath} must not use process-local calendar arithmetic or duplicated fixed Jakarta offsets.`,
  );
}

const parameterizedBucketFiles = [
  "src/features/admin/dashboard/queries.ts",
  "src/features/reports/queries.ts",
];

for (const relativePath of parameterizedBucketFiles) {
  const source = await readFile(path.join(rootDir, relativePath), "utf8");

  assert.doesNotMatch(
    source,
    /\.groupBy\((?:trendBucketSql|dailyBucketSql|movementBucketSql)\)/,
    `${relativePath} must group parameterized timezone buckets by the selected column ordinal.`,
  );
  assert.doesNotMatch(
    source,
    /\.orderBy\((?:trendBucketSql|dailyBucketSql|movementBucketSql)\)/,
    `${relativePath} must order parameterized timezone buckets by the selected column ordinal.`,
  );
}

const authSource = await readFile(
  path.join(rootDir, "src/lib/auth/session.ts"),
  "utf8",
);
assert.match(authSource, /organizationTimezone:\s*organizations\.timezone/);
assert.match(authSource, /timezone:\s*session\.organizationTimezone/);

const dockerfile = await readFile(path.join(rootDir, "Dockerfile"), "utf8");
assert.match(dockerfile, /ENV TZ=Asia\/Jakarta/);

console.log("Business timezone checks passed.");
