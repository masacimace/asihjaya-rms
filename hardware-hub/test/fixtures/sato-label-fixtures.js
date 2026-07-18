
function basePayload(overrides = {}) {
  return {
    schemaVersion: 1,
    templateId: "jewelry_compact_v1",
    templateVersion: 1,
    printerProfileId: "sato_cg408tt_jewelry_v1",
    itemId: "00000000-0000-4000-8000-000000000001",
    copies: 1,
    fields: {
      sku: "AJ-0001",
      barcode: "AJ00000001",
      productName: "CINCIN EMAS ASIHJAYA",
      weightGram: "2.350",
      purityPercent: "75",
      exchangePurityPercent: "70",
      size: "12",
      color: "Kuning",
      gemstone: "Zircon",
      sellingAmount: "1850000",
      ...(overrides.fields || {}),
    },
    ...overrides,
  };
}

const SATO_GOLDEN_FIXTURES = Object.freeze([
  Object.freeze({
    name: "jewelry-standard",
    payload: basePayload(),
    options: Object.freeze({ includePrice: false }),
  }),
  Object.freeze({
    name: "jewelry-long-name",
    payload: basePayload({
      itemId: "00000000-0000-4000-8000-000000000002",
      fields: {
        sku: "AJ-LONG-002",
        barcode: "AJLONG0002",
        productName:
          "CINCIN EMAS KUNING MODEL MAHKOTA DENGAN BATU ZIRCON PREMIUM ASIHJAYA",
      },
    }),
    options: Object.freeze({ includePrice: false }),
  }),
  Object.freeze({
    name: "jewelry-high-price",
    payload: basePayload({
      itemId: "00000000-0000-4000-8000-000000000003",
      fields: {
        sku: "AJ-HIGH-003",
        barcode: "AJHIGH0003",
        productName: "GELANG EMAS PREMIUM",
        sellingAmount: "125000000",
      },
    }),
    options: Object.freeze({ includePrice: true }),
  }),
  Object.freeze({
    name: "jewelry-special-character",
    payload: basePayload({
      itemId: "00000000-0000-4000-8000-000000000004",
      fields: {
        sku: "AJ-SPECIAL-004",
        barcode: "AJSPECIAL004",
        productName: "Cincin Émas <Mawar> ✨\nAsihjaya",
        color: "Kuning & Putih",
        gemstone: "Zirkón",
      },
    }),
    options: Object.freeze({ includePrice: false }),
  }),
  Object.freeze({
    name: "jewelry-multiple-copies",
    payload: basePayload({
      itemId: "00000000-0000-4000-8000-000000000005",
      copies: 7,
      fields: {
        sku: "AJ-COPY-005",
        barcode: "AJCOPY0005",
        productName: "LIONTIN EMAS",
      },
    }),
    options: Object.freeze({ includePrice: false }),
  }),
]);

module.exports = { SATO_GOLDEN_FIXTURES, basePayload };
