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

const query = read("src/features/buybacks/processing-queries.ts");
const service = read("src/features/buybacks/processing-service.ts");
const action = read("src/app/actions/buyback-processing.ts");
const workspace = read(
  "src/components/buybacks/buyback-processing-workspace.tsx",
);
const page = read("src/app/(pos)/pos/buyback/pemrosesan/page.tsx");
const buybackPage = read("src/app/(pos)/pos/buyback/page.tsx");

assert(
  query.includes("buybackItemProcessings") &&
    query.includes("sourceSnapshot") &&
    query.includes("resultSnapshot"),
  "B3 queue wajib membaca lifecycle processing dan snapshot sebelum/sesudah.",
);

assert(
  service.includes('.for("update")') &&
    service.includes('processing.processingStatus === "completed"') &&
    service.includes('eq(productItems.availability, "processing")'),
  "B3 completion wajib lock lifecycle dan hanya mengaktifkan item processing.",
);

assert(
  service.includes('availability: "available"') &&
    service.includes('condition: "used"') &&
    service.includes('locationState: "outlet"'),
  "B3 completion wajib menghasilkan Physical Item saleable.",
);

assert(
  service.includes("getNextProductItemIdentifiers") &&
    service.includes("transaction.insert(itemBarcodes)") &&
    service.includes('processing.source === "asihjaya"'),
  "B3 wajib mempertahankan existing item dan membuat identifier baru untuk external item.",
);

assert(
  service.includes('status: "completed"') &&
    service.includes("resultProductItemId") &&
    service.includes("resultSnapshot") &&
    service.includes("processedAt: now"),
  "B3 wajib menutup lifecycle processing secara atomik.",
);

assert(
  service.includes('movementType: "repair_in"') &&
    service.includes('"buyback_item.processing_completed"'),
  "B3 wajib mencatat inventory movement dan audit completion.",
);

assert(
  service.includes("exchangePurityPercent: payload.purityPercent"),
  "B3 harus menjaga kompatibilitas receipt Sale tanpa menambah field Kadar Tukaran ke UI.",
);

assert(
  action.includes("validateImageFile") &&
    action.includes("storeImageFile") &&
    action.includes("deleteImageFile") &&
    action.includes('revalidatePath("/pos/buyback/pemrosesan")'),
  "B3 action wajib menjaga lifecycle foto dan revalidate queue.",
);

assert(
  workspace.includes("Belum Diproses") &&
    workspace.includes("Cuci") &&
    workspace.includes("Rongsok") &&
    workspace.includes("QuickProductMasterDialog") &&
    workspace.includes("Berat Sesudah") &&
    workspace.includes("Harga / Gram") &&
    workspace.includes("Foto Sesudah"),
  "B3 UI belum membawa queue dan form hasil yang disepakati.",
);

assert(
  page.includes('title="Pemrosesan Cuci / Rongsok"') &&
    page.includes("getBuybackProcessingData") &&
    page.includes("getActiveGoldPriceRates"),
  "Route pemrosesan B3 belum lengkap.",
);

assert(
  buybackPage.includes('href="/pos/buyback/pemrosesan"'),
  "Halaman Buyback wajib mempunyai akses jelas ke Pemrosesan.",
);

console.log(
  "OK: B3 Processing Cuci/Rongsok contract valid — pending -> completed -> saleable.",
);
