export type LegacyStockStatus = "available" | "sold" | "unknown";

export function legacySyncLabel(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

function headerKey(value: string) {
  return legacySyncLabel(value).replace(/[^a-z0-9]/g, "");
}

export function readLegacyStockStatus(rawData: Record<string, unknown>): LegacyStockStatus {
  const entries = Object.entries(rawData).filter(([header]) =>
    ["statusstoklegacy", "statusstok", "status"].includes(headerKey(header)),
  );
  // Older exports contain available inventory only and have no status column.
  if (entries.length === 0) return "available";
  const statuses = entries.map(([,value]): LegacyStockStatus => {
    const label = legacySyncLabel(value);
    if (["stok tersedia", "tersedia", "available"].includes(label)) return "available";
    if (["stok habis / terjual", "stok habis/terjual", "stok habis", "habis", "terjual", "sold"].includes(label)) return "sold";
    return "unknown";
  });
  return statuses.every(status => status === statuses[0]) ? statuses[0]! : "unknown";
}

export function normalizeLegacySyncBarcode(value: unknown): string | null {
  const text = String(value ?? "").normalize("NFKC").trim();
  return /^\d{1,6}$/.test(text) ? text.padStart(6, "0") : null;
}

export type LegacySyncIdentity = {
  legacyCategory: string | null;
  legacyMasterCode: string | null;
  legacyMasterName: string | null;
  legacyItemName: string | null;
  legacyPurity: string | number | null;
  legacyWeightGram: string | number | null;
  legacyColor: string | null;
};

export function sameLegacySyncIdentity(left: LegacySyncIdentity, right: LegacySyncIdentity) {
  const textFields = ["legacyCategory", "legacyMasterCode", "legacyMasterName", "legacyItemName", "legacyColor"] as const;
  if (!left.legacyMasterCode || !left.legacyItemName || !right.legacyMasterCode || !right.legacyItemName) return false;
  if (textFields.some(field => legacySyncLabel(left[field]) !== legacySyncLabel(right[field]))) return false;
  return (["legacyPurity", "legacyWeightGram"] as const).every(field => {
    const a = left[field], b = right[field];
    if (a === null || b === null || a === "" || b === "") return a === b;
    return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a)-Number(b)) < 0.0005;
  });
}

export const LEGACY_SYNC_REASONS = {
  duplicate_barcode: "Barcode dipakai lebih dari satu produk di file ini. Baris ditunda agar tidak salah mencocokkan produk.",
  invalid_identity: "Barcode, nama, atau identitas produk belum lengkap. Lengkapi data lalu upload kembali.",
  unknown_stock: "Status stok kosong atau tidak dikenali. Gunakan Stok Tersedia atau Stok Habis / Terjual.",
  multiple_matches: "Barcode sudah terhubung ke beberapa item di sistem. Periksa item yang benar sebelum sinkronisasi.",
  different_product: "Barcode sudah ada, tetapi identitas produknya berbeda. Data lama tetap dipertahankan.",
  different_outlet: "Item berasal dari atau sedang berada di outlet lain. Data tidak dipindahkan otomatis.",
  operational_activity: "Item sudah memiliki aktivitas operasional atau status khusus di sistem baru. Status tetap dipertahankan.",
  already_exists: "Produk sudah ada dan tidak dibuat ulang.",
  status_preserved: "Status yang sudah berjalan di sistem baru dipertahankan. Item tidak diaktifkan kembali.",
  stock_updated: "Status stok diperbarui menjadi habis/terjual sesuai Excel. Tidak ada transaksi penjualan baru.",
  created: "Produk baru ditambahkan sesuai status stok Excel.",
  master_archived: "Master produk sudah diarsipkan di RMS. Pulihkan master terlebih dahulu jika produk ini masih akan digunakan.",
} as const;

export type LegacySyncReason = keyof typeof LEGACY_SYNC_REASONS;
export type LegacySyncOutcome = {
  rowId: string;
  kind: "created" | "existing" | "stock_updated" | "deferred";
  itemId: string | null;
  stockStatus: LegacyStockStatus;
  reason: LegacySyncReason;
};

export function readLegacySyncOutcomes(summary: Record<string, unknown>): LegacySyncOutcome[] {
  const direct = summary.directImport;
  if (!direct || typeof direct !== "object" || Array.isArray(direct)) return [];
  const data = direct as Record<string, unknown>;
  if (data.syncVersion !== 1 || !Array.isArray(data.rowOutcomes)) return [];
  return data.rowOutcomes.filter((entry): entry is LegacySyncOutcome => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const row = entry as Record<string, unknown>;
    return typeof row.rowId === "string" && ["created", "existing", "stock_updated", "deferred"].includes(String(row.kind)) &&
      ["available", "sold", "unknown"].includes(String(row.stockStatus)) &&
      typeof row.reason === "string" && Object.hasOwn(LEGACY_SYNC_REASONS, row.reason) &&
      (row.itemId === null || typeof row.itemId === "string");
  });
}
