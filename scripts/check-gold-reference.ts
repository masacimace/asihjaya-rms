import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseEmasApiPricesPayload } from "../src/server/integrations/gold-reference/emas-api";

const parsedHistory = parseEmasApiPricesPayload({
  status: "success",
  timestamp: "2026-09-13T01:49:22+07:00",
  data: [
    {
      brand: "ANTAM",
      resource: "antam",
      weight: 1,
      sell_price: 2510000,
      buyback_price: 2310000,
      updated_at: "2026-09-12",
    },
    {
      brand: "ANTAM",
      resource: "antam",
      weight: 1,
      sell_price: 2510000,
      buyback_price: 2310000,
      updated_at: "2026-09-12T08:00:00+07:00",
    },
    {
      brand: "ANTAM",
      resource: "antam",
      gramasi: "1",
      sell_price: "2495000",
      buyback_price: "2300000",
      updated_at: "2026-09-11",
    },
    {
      brand: "ANTAM",
      resource: "pegadaian",
      weight: 1,
      sell_price: 2600000,
      buyback_price: 2350000,
      updated_at: "2026-09-12",
    },
    {
      brand: "ANTAM",
      resource: "antam",
      weight: 0.5,
      sell_price: 1300000,
      buyback_price: 1180000,
      updated_at: "2026-09-12",
    },
  ],
});

assert.deepEqual(parsedHistory, {
  brand: "ANTAM",
  resource: "antam",
  weightGrams: 1,
  sellPrice: 2510000,
  buybackPrice: 2310000,
  sellPriceChange: 15000,
  buybackPriceChange: 10000,
  updatedAt: "2026-09-12T08:00:00+07:00",
  comparisonUpdatedAt: "2026-09-11",
});

const parsedWithoutPreviousDay = parseEmasApiPricesPayload({
  status: "success",
  data: [
    {
      brand: "ANTAM",
      resource: "antam",
      weight: 1,
      sell_price: 2510000,
      buyback_price: 2310000,
      updated_at: "2026-09-12",
    },
  ],
});

assert.equal(parsedWithoutPreviousDay?.sellPriceChange, null);
assert.equal(parsedWithoutPreviousDay?.buybackPriceChange, null);
assert.equal(parsedWithoutPreviousDay?.comparisonUpdatedAt, null);

assert.equal(
  parseEmasApiPricesPayload({
    status: "success",
    data: [
      {
        brand: "ANTAM",
        resource: "pegadaian",
        weight: 1,
        sell_price: 2500000,
      },
    ],
  }),
  null,
  "Parser harus menolak ANTAM dari source selain antam.",
);

const dashboardSource = readFileSync(
  "src/app/(admin)/admin/page.tsx",
  "utf8",
);
const cardSource = readFileSync(
  "src/components/admin/dashboard/gold-reference-card.tsx",
  "utf8",
);
const integrationSource = readFileSync(
  "src/server/integrations/gold-reference/emas-api.ts",
  "utf8",
);

assert.ok(dashboardSource.includes("getGoldReference()"));
assert.ok(dashboardSource.includes("<GoldReferenceCard result={goldReference} />"));
assert.ok(cardSource.includes("Referensi Harga Emas"));
assert.ok(cardSource.includes("tidak mengubah Harga / Gram ASIHJAYA"));
assert.ok(cardSource.includes("comparisonUpdatedAt"));
assert.ok(integrationSource.includes('new URL("/api/prices", baseUrl)'));
assert.ok(integrationSource.includes('url.searchParams.set("brand[eq]"'));
assert.ok(integrationSource.includes('url.searchParams.set("resource[eq]"'));
assert.ok(integrationSource.includes('url.searchParams.set("weight[eq]"'));
assert.ok(integrationSource.includes('url.searchParams.set("sort_by", "updated_at")'));
assert.ok(integrationSource.includes('url.searchParams.set("order", "desc")'));
assert.ok(integrationSource.includes('"X-API-Key": config.apiKey'));
assert.ok(integrationSource.includes("revalidate: config.cacheSeconds"));
assert.ok(!integrationSource.includes("/api/prices/today/"));
assert.ok(!cardSource.includes("EMAS_API_ID_API_KEY"));

console.log(
  "Gold reference checks passed: filtered /api/prices history, ANTAM/antam/1g selection, previous-date change calculation, dashboard wiring, server-side API key, and cache contract.",
);
