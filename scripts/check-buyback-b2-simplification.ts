import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

const schema = read("src/db/schema/index.ts");
const contracts = read("src/features/buybacks/contracts.ts");
const action = read("src/app/actions/buybacks.ts");
const service = read("src/features/buybacks/service.ts");
const queries = read("src/features/buybacks/queries.ts");
const receipt = read("src/features/buybacks/documents/buyback-receipt.ts");
const workspace = read("src/components/buybacks/buyback-workspace.tsx");
const page = read("src/app/(pos)/pos/buyback/page.tsx");

function schemaBlock(
  content: string,
  startMarker: string,
  endMarker: string,
) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0, `${startMarker} tidak ditemukan pada schema.`);
  assert(end > start, `${endMarker} tidak ditemukan setelah ${startMarker}.`);
  return content.slice(start, end);
}

function fieldSegment(
  content: string,
  fieldName: string,
  nextFieldName: string,
) {
  const pattern = new RegExp(
    `${fieldName}:([\\s\\S]*?)\\n\\s*${nextFieldName}:`,
  );
  const match = content.match(pattern);
  assert(match, `Field ${fieldName} tidak ditemukan pada blok schema target.`);
  return match[1] ?? "";
}

const buybackItemsSchema = schemaBlock(
  schema,
  "export const buybackItems = pgTable(",
  "export const buybackItemProcessings = pgTable(",
);

const productItemIdSegment = fieldSegment(
  buybackItemsSchema,
  "productItemId",
  "source",
);
assert(
  productItemIdSegment.includes('uuid("product_item_id")') &&
    productItemIdSegment.includes(".references(() => productItems.id)") &&
    !productItemIdSegment.includes(".notNull()"),
  "buyback_items.product_item_id wajib nullable untuk Buyback eksternal B2.",
);

const exchangePuritySegment = fieldSegment(
  buybackItemsSchema,
  "exchangePurityPercent",
  "buybackPricePerGram",
);
assert(
  exchangePuritySegment.includes('numeric("exchange_purity_percent"') &&
    !exchangePuritySegment.includes(".notNull()"),
  "buyback_items.exchange_purity_percent wajib nullable pada contract B2.",
);

const buybackPriceSegment = fieldSegment(
  buybackItemsSchema,
  "buybackPricePerGram",
  "deductionPerGram",
);
assert(
  buybackPriceSegment.includes('numeric("buyback_price_per_gram"') &&
    !buybackPriceSegment.includes(".notNull()"),
  "buyback_items.buyback_price_per_gram wajib nullable pada contract B2.",
);
assert(
  buybackItemsSchema.includes('"buyback_items_exchange_purity_range_ck"') &&
    /exchangePurityPercent\}\s+is null or/.test(buybackItemsSchema),
  "Constraint Kadar Tukaran harus menerima NULL untuk transaksi B2.",
);
assert(
  buybackItemsSchema.includes('"buyback_items_price_positive_ck"') &&
    /buybackPricePerGram\}\s+is null or/.test(buybackItemsSchema),
  "Constraint Harga/Gram harus menerima NULL untuk transaksi B2.",
);

assert(
  contracts.includes('export type BuybackProcessingType = "cleaning" | "recondition";'),
  "Contract Buyback wajib membawa processing type Cuci/Rongsok.",
);
assert(
  /export type BuybackItemPayload = \{[\s\S]*?displayName: string;[\s\S]*?categoryId: string;[\s\S]*?processingType: BuybackProcessingType;[\s\S]*?weightGram: string;[\s\S]*?purityPercent: string;[\s\S]*?color: string;[\s\S]*?totalAmount: string;[\s\S]*?\};/.test(
    contracts,
  ),
  "Payload item Buyback B2 belum membawa field sederhana yang disepakati.",
);
const payloadBlock = contracts.match(/export type BuybackItemPayload = \{([\s\S]*?)\n\};/)?.[1] ?? "";
for (const retiredField of [
  "productMasterId",
  "exchangePurityPercent",
  "deductionPerGram",
  "buybackPricePerGram",
]) {
  assert(
    !payloadBlock.includes(retiredField),
    `Payload Buyback B2 tidak boleh meminta ${retiredField}.`,
  );
}

for (const label of [
  "Nama Produk",
  "Cuci",
  "Rongsok",
  "Kategori",
  "Warna",
  "Kadar %",
  "Berat (Gr)",
  "Total Harga",
]) {
  assert(workspace.includes(label), `Form Buyback B2 belum memiliki field/label ${label}.`);
}
assert(
  workspace.includes("itemImage:${clientKey}"),
  "Form Buyback B2 wajib membawa foto kondisi per item.",
);
for (const retiredUi of [
  "QuickProductMasterDialog",
  "Kadar Tukaran",
  "Harga Buyback / Gram",
  "Potongan / Gram",
]) {
  assert(
    !workspace.includes(retiredUi),
    `UI Buyback B2 masih membawa field lama: ${retiredUi}.`,
  );
}
assert(
  workspace.includes('processingType: "cleaning"') &&
    workspace.includes('recondition: "Rongsok"'),
  "Default/toggle Cuci-Rongsok pada workspace belum lengkap.",
);
assert(
  /belum tersedia[\s\S]{0,100}?POS/i.test(workspace),
  "Success UX wajib menjelaskan barang belum saleable.",
);
assert(
  page.includes("Total Harga manual") && page.includes("Cuci / Rongsok"),
  "Header halaman Buyback belum menjelaskan flow sederhana B2.",
);

assert(
  action.includes("itemImage:${item.clientKey}") &&
    action.includes("Foto kondisi barang wajib"),
  "Server Action wajib memvalidasi foto kondisi setiap item.",
);
assert(
  service.includes('availability: "processing"'),
  "Existing Physical Item hasil Buyback wajib masuk availability=processing.",
);
assert(
  service.includes("transaction.insert(buybackItemProcessings)") &&
    service.includes('status: "pending"'),
  "Setiap item Buyback wajib membuat queue processing pending.",
);
assert(
  !service.includes("transaction.insert(productItems)") &&
    !service.includes("itemBarcodes"),
  "B2 tidak boleh langsung membuat Physical Item untuk produk eksternal.",
);
assert(
  service.includes("let productItemId: string | null = null;") &&
    service.includes("productItemId = existing.id;"),
  "Service harus mempertahankan ID Physical Item ASIHJAYA dan membolehkan external tanpa Physical Item.",
);
assert(
  service.includes("productItemId,") && service.includes('source: "external"'),
  "External Buyback harus disimpan sebagai acquisition snapshot sebelum B3.",
);

assert(
  queries.includes(".leftJoin(") &&
    queries.includes("productItems") &&
    queries.includes("buybackItemProcessings"),
  "History query B2 wajib toleran terhadap product_item_id NULL dan membaca processing queue.",
);
assert(
  receipt.includes(".leftJoin(") && receipt.includes("productItems"),
  "Receipt Buyback B2 wajib toleran terhadap external item yang belum punya Physical Item.",
);

const journal = JSON.parse(read("drizzle/meta/_journal.json")) as {
  entries?: Array<{ idx?: number; tag?: string }>;
};
const lastEntry = journal.entries?.at(-1);
assert(lastEntry?.idx === 23, "Migration B2 harus menjadi idx 23 setelah B1/0022.");
assert(
  lastEntry?.tag === "0023_buyback_simplified_acquisition",
  "Migration B2 harus bernama 0023_buyback_simplified_acquisition.",
);

const migration = read("drizzle/0023_buyback_simplified_acquisition.sql");
for (const column of [
  "product_item_id",
  "exchange_purity_percent",
  "buyback_price_per_gram",
]) {
  assert(
    new RegExp(
      `ALTER\\s+(?:TABLE\\s+)?[\\s\\S]*?buyback_items[\\s\\S]*?${column}[\\s\\S]*?DROP\\s+NOT\\s+NULL`,
      "i",
    ).test(migration),
    `Migration B2 harus DROP NOT NULL pada buyback_items.${column}.`,
  );
}
assert(
  migration.includes("buyback_items_exchange_purity_range_ck") &&
    migration.includes("buyback_items_price_positive_ck"),
  "Migration B2 harus memperbarui kedua compatibility constraint.",
);
assert(
  !/CREATE\s+TABLE\s+"buyback_item_processings"/i.test(migration),
  "B2 tidak boleh membuat ulang tabel processing dari B1.",
);
assert(
  !/UPDATE\s+"product_items"/i.test(migration) &&
    !/DELETE\s+FROM\s+"buyback_items"/i.test(migration),
  "Migration B2 tidak boleh memutasi data transaksi/inventory lama.",
);

console.log("OK: B2 Buyback Simplification contract valid.");
