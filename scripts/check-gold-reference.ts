import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parseEmasApiPricesPayload } from "../src/server/integrations/gold-reference/emas-api";

const parsedCollection = parseEmasApiPricesPayload({
  status: "success",
  timestamp: "2026-09-13T01:49:22+07:00",
  data: [
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
      resource: "pegadaian",
      weight: 1,
      sell_price: 2580000,
      buyback_price: 2340000,
      updated_at: "2026-09-11",
    },
    {
      brand: "UBS",
      resource: "galeri24",
      weight: 1,
      sell_price: 2450000,
      buyback_price: 2250000,
      updated_at: "2026-09-12",
    },
    {
      brand: "GALERI 24",
      resource: "galeri24",
      weight: 1,
      sell_price: 2430000,
      buyback_price: 2230000,
      updated_at: "2026-09-12",
    },
    {
      brand: "ANTAM MULIA RETRO",
      resource: "pegadaian",
      weight: 1,
      sell_price: 2400000,
      buyback_price: 2200000,
      updated_at: "2026-09-12",
    },
    {
      brand: "ANTAM NON PEGADAIAN",
      resource: "antam",
      weight: 1,
      sell_price: 2400000,
      buyback_price: 2200000,
      updated_at: "2026-09-12",
    },
    {
      brand: "LOTUS ARCHI",
      resource: "lotusarchi",
      weight: 1,
      sell_price: 2400000,
      buyback_price: 2200000,
      updated_at: "2026-09-12",
    },
    {
      brand: "SENTRA BUYBACK",
      resource: "sentra",
      weight: 1,
      sell_price: 2400000,
      buyback_price: 2200000,
      updated_at: "2026-09-12",
    },
    {
      brand: "KING HALIM",
      resource: "kinghalim",
      weight: 0.5,
      sell_price: 1200000,
      buyback_price: 1100000,
      updated_at: "2026-09-12",
    },
  ],
});

assert.ok(parsedCollection);
assert.equal(parsedCollection.defaultReferenceKey, "ANTAM::antam");
assert.deepEqual(
  parsedCollection.references.map((reference) => reference.referenceKey),
  ["ANTAM::antam", "ANTAM::pegadaian", "GALERI 24::galeri24", "UBS::galeri24"],
);

const antamOfficial = parsedCollection.references[0];
assert.ok(antamOfficial);
assert.equal(antamOfficial.sellPrice, 2510000);
assert.equal(antamOfficial.buybackPrice, 2310000);
assert.equal(antamOfficial.sellPriceChange, 15000);
assert.equal(antamOfficial.buybackPriceChange, 10000);
assert.equal(antamOfficial.comparisonUpdatedAt, "2026-09-11");

const antamPegadaian = parsedCollection.references.find(
  (reference) => reference.referenceKey === "ANTAM::pegadaian",
);
assert.ok(antamPegadaian);
assert.equal(antamPegadaian.sellPriceChange, 20000);
assert.equal(antamPegadaian.buybackPriceChange, 10000);

assert.ok(
  parsedCollection.references.every(
    (reference) =>
      ![
        "ANTAM MULIA RETRO",
        "ANTAM NON PEGADAIAN",
        "LOTUS ARCHI",
        "SENTRA BUYBACK",
      ].includes(reference.brand.toUpperCase()),
  ),
  "Brand yang dikecualikan tidak boleh masuk selector.",
);
assert.ok(
  parsedCollection.references.every(
    (reference) => Math.abs(reference.weightGrams - 1) < 0.0001,
  ),
  "Dashboard dan Harga/Gram hanya boleh membawa referensi 1 gram.",
);

const fallbackDefault = parseEmasApiPricesPayload({
  status: "success",
  data: [
    {
      brand: "UBS",
      resource: "galeri24",
      weight: 1,
      sell_price: 2450000,
      buyback_price: 2250000,
      updated_at: "2026-09-12",
    },
  ],
});
assert.equal(fallbackDefault?.defaultReferenceKey, "UBS::galeri24");

const dashboardSource = readFileSync(
  "src/app/(admin)/admin/page.tsx",
  "utf8",
);
const pricingPageSource = readFileSync(
  "src/app/(admin)/admin/pengaturan/harga-gram/page.tsx",
  "utf8",
);
const cardSource = readFileSync(
  "src/components/admin/dashboard/gold-reference-card.tsx",
  "utf8",
);
const pricingPanelSource = readFileSync(
  "src/components/pricing/gold-reference-rate-panel.tsx",
  "utf8",
);
const integrationSource = readFileSync(
  "src/server/integrations/gold-reference/emas-api.ts",
  "utf8",
);

assert.ok(dashboardSource.includes("getGoldReference()"));
assert.ok(dashboardSource.includes("<GoldReferenceCard result={goldReference} />"));
assert.ok(pricingPageSource.includes("getGoldReference()"));
assert.ok(
  pricingPageSource.includes(
    "<GoldReferenceRatePanel result={goldReference} />",
  ),
);
assert.ok(cardSource.includes('"use client"'));
assert.ok(cardSource.includes("Pilih referensi harga emas"));
assert.ok(cardSource.includes("asihjaya.gold-reference.selection.v1"));
assert.ok(cardSource.includes("useSyncExternalStore"));
assert.ok(cardSource.includes("referensi acuan harga pasar"));
assert.ok(pricingPanelSource.includes('"use client"'));
assert.ok(pricingPanelSource.includes("Referensi aktif"));
assert.ok(pricingPanelSource.includes("asihjaya.gold-reference.selection.v1"));
assert.ok(pricingPanelSource.includes("useSyncExternalStore"));
assert.ok(pricingPanelSource.includes("Rate Global"));
assert.ok(pricingPanelSource.includes("Read-only"));
assert.ok(integrationSource.includes('new URL("/api/prices", baseUrl)'));
assert.ok(integrationSource.includes('url.searchParams.set("weight[eq]"'));
assert.ok(!integrationSource.includes('url.searchParams.set("brand[eq]"'));
assert.ok(!integrationSource.includes('url.searchParams.set("resource[eq]"'));
assert.ok(integrationSource.includes('"ANTAM MULIA RETRO"'));
assert.ok(integrationSource.includes('"ANTAM NON PEGADAIAN"'));
assert.ok(integrationSource.includes('"LOTUS ARCHI"'));
assert.ok(integrationSource.includes('"SENTRA BUYBACK"'));

console.log(
  "Gold reference contracts: OK — multi-source 1g selector, exclusions, dashboard + Harga/Gram read-only integration.",
);
