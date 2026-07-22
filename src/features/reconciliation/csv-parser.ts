import {
  SETTLEMENT_IMPORT_MAX_ROWS,
  type NormalizedSettlementRow,
  type ParsedCsv,
  type SettlementImportColumnKey,
  type SettlementImportColumnMapping,
} from "@/features/reconciliation/import-contracts";
import { normalizeManualPaymentReference } from "@/features/pos/manual-payment-verification";

const MAX_COLUMNS = 100;
const MAX_CELL_LENGTH = 2_000;
const FORMULA_PREFIX = /^[\t\r]*[=@]/;
const aliases: Record<SettlementImportColumnKey, string[]> = {
  transactionDate: [
    "tanggal transaksi",
    "transaction date",
    "paid at",
    "payment date",
    "tanggal",
    "date",
    "waktu transaksi",
  ],
  paymentReference: [
    "reference payment",
    "payment reference",
    "transaction id",
    "transaction reference",
    "nomor referensi",
    "no referensi",
    "reference",
    "referensi",
    "rrn",
    "stan",
  ],
  grossAmount: [
    "gross amount",
    "gross payment",
    "nominal gross",
    "nominal transaksi",
    "amount",
    "nominal",
  ],
  feeAmount: ["fee amount", "mdr", "biaya", "fee"],
  taxAmount: ["tax amount", "pajak", "tax"],
  netAmount: [
    "net settlement",
    "net amount",
    "jumlah bersih",
    "nominal bersih",
    "net",
  ],
  settlementReference: [
    "settlement reference",
    "settlement id",
    "batch reference",
    "batch id",
    "referensi settlement",
  ],
  providerStatus: [
    "provider status",
    "transaction status",
    "status transaksi",
    "status",
  ],
};

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function countDelimiterOutsideQuotes(value: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) count += 1;
  }
  return count;
}

export function detectCsvDelimiter(value: string) {
  const firstLine = value.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  return candidates.reduce((best, candidate) =>
    countDelimiterOutsideQuotes(firstLine, candidate) >
    countDelimiterOutsideQuotes(firstLine, best)
      ? candidate
      : best,
  );
}

export function parseCsv(value: string): ParsedCsv {
  const normalized = value.replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(normalized);
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    if (cell.length > MAX_CELL_LENGTH) {
      throw new Error(`Isi kolom CSV melebihi ${MAX_CELL_LENGTH} karakter.`);
    }
    row.push(cell.trim());
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value !== "")) matrix.push(row);
    row = [];
    if (matrix.length > SETTLEMENT_IMPORT_MAX_ROWS + 1) {
      throw new Error(
        `CSV maksimal berisi ${SETTLEMENT_IMPORT_MAX_ROWS} baris data.`,
      );
    }
  };

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (quoted) {
      if (character === '"' && normalized[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }

    if (character === '"') quoted = true;
    else if (character === delimiter) pushCell();
    else if (character === "\n") pushRow();
    else if (character !== "\r") cell += character;
  }

  if (quoted) throw new Error("CSV memiliki tanda kutip yang tidak ditutup.");
  if (cell || row.length) pushRow();
  if (matrix.length < 2) {
    throw new Error("CSV wajib memiliki header dan minimal satu baris data.");
  }

  const headerRow = matrix[0];
  if (!headerRow) throw new Error("Header CSV tidak ditemukan.");
  const headers = headerRow.map((header) => header.trim());
  if (headers.length > MAX_COLUMNS) {
    throw new Error(`CSV maksimal memiliki ${MAX_COLUMNS} kolom.`);
  }
  if (headers.some((header) => !header)) {
    throw new Error("Semua kolom header CSV wajib memiliki nama.");
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new Error("Header CSV tidak boleh memiliki nama kolom duplikat.");
  }

  const rows = matrix.slice(1).map((values, index) => {
    const record: Record<string, string> = {};
    for (let column = 0; column < headers.length; column += 1) {
      const value = values[column] ?? "";
      if (FORMULA_PREFIX.test(value)) {
        throw new Error(
          `Baris ${index + 2} mengandung formula spreadsheet yang tidak diizinkan.`,
        );
      }
      const header = headers[column];
      if (header) record[header] = value;
    }
    return record;
  });

  return { delimiter, headers, rows };
}

export function suggestSettlementImportMapping(
  headers: string[],
): SettlementImportColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  return Object.fromEntries(
    Object.entries(aliases).map(([key, values]) => {
      const exact = normalizedHeaders.find((header) =>
        values.includes(header.normalized),
      );
      const partial = normalizedHeaders.find((header) =>
        values.some((alias) => header.normalized.includes(alias)),
      );
      return [key, exact?.original ?? partial?.original ?? null];
    }),
  ) as SettlementImportColumnMapping;
}

function parseIntegerMoney(value: string, fieldName: string, optional = false) {
  const trimmed = value.trim();
  if (!trimmed && optional) return 0;
  if (!trimmed) throw new Error(`${fieldName} wajib diisi.`);

  let normalized = trimmed.replace(/\s/g, "").replace(/rp/gi, "");
  if (/^-/.test(normalized)) {
    throw new Error(`${fieldName} tidak boleh bernilai negatif.`);
  }

  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(/,\d+$/, "");
    } else {
      normalized = normalized.replace(/,/g, "").replace(/\.\d+$/, "");
    }
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  } else if (/^\d{1,3}(,\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(/[.,]\d+$/, "").replace(/\D/g, "");
  }

  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`${fieldName} tidak valid.`);
  }
  return amount;
}

export function parseSettlementImportDate(value: string) {
  const trimmed = value.trim();
  let year: number;
  let month: number;
  let day: number;

  let match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (!match) throw new Error("Tanggal transaksi tidak dikenali.");
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error("Tanggal transaksi tidak valid.");
  }

  const validationDate = new Date(Date.UTC(year, month - 1, day));
  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() + 1 !== month ||
    validationDate.getUTCDate() !== day
  ) {
    throw new Error("Tanggal transaksi tidak valid.");
  }

  const isoDate = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  const date = new Date(`${isoDate}T00:00:00+07:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal transaksi tidak valid.");
  }

  return date;
}

function mappedValue(
  row: Record<string, string>,
  mapping: SettlementImportColumnMapping,
  key: SettlementImportColumnKey,
) {
  const header = mapping[key];
  return header ? row[header] ?? "" : "";
}

export function normalizeSettlementImportRow(
  row: Record<string, string>,
  mapping: SettlementImportColumnMapping,
): NormalizedSettlementRow {
  const paymentReference = mappedValue(
    row,
    mapping,
    "paymentReference",
  ).trim();
  if (!paymentReference) throw new Error("Reference payment wajib diisi.");

  const normalizedReference = normalizeManualPaymentReference(paymentReference);
  if (normalizedReference.length < 4) {
    throw new Error("Reference payment minimal 4 karakter setelah normalisasi.");
  }

  const grossAmount = parseIntegerMoney(
    mappedValue(row, mapping, "grossAmount"),
    "Gross amount",
  );
  if (grossAmount <= 0) throw new Error("Gross amount harus lebih dari nol.");

  const feeAmount = parseIntegerMoney(
    mappedValue(row, mapping, "feeAmount"),
    "Fee/MDR",
    true,
  );
  const taxAmount = parseIntegerMoney(
    mappedValue(row, mapping, "taxAmount"),
    "Pajak",
    true,
  );
  if (feeAmount + taxAmount > grossAmount) {
    throw new Error("Fee dan pajak tidak boleh melebihi gross amount.");
  }

  const rawNet = mappedValue(row, mapping, "netAmount").trim();
  const netAmount = rawNet
    ? parseIntegerMoney(rawNet, "Net settlement")
    : grossAmount - feeAmount - taxAmount;
  if (netAmount !== grossAmount - feeAmount - taxAmount) {
    throw new Error("Net settlement tidak sesuai dengan gross - fee - pajak.");
  }

  const settlementReference = mappedValue(
    row,
    mapping,
    "settlementReference",
  ).trim();
  const providerStatus = mappedValue(row, mapping, "providerStatus").trim();

  return {
    transactionDate: parseSettlementImportDate(
      mappedValue(row, mapping, "transactionDate"),
    ),
    paymentReference: paymentReference.slice(0, 160),
    normalizedReference,
    grossAmount,
    feeAmount,
    taxAmount,
    netAmount,
    settlementReference: settlementReference
      ? settlementReference.slice(0, 160)
      : null,
    providerStatus: providerStatus ? providerStatus.slice(0, 80) : null,
  };
}

export function validateSettlementImportMapping(
  headers: string[],
  mapping: SettlementImportColumnMapping,
) {
  const required: SettlementImportColumnKey[] = [
    "transactionDate",
    "paymentReference",
    "grossAmount",
  ];
  for (const key of required) {
    if (!mapping[key]) throw new Error(`Mapping ${key} wajib dipilih.`);
  }

  const selected = Object.values(mapping).filter(
    (value): value is string => Boolean(value),
  );
  if (new Set(selected).size !== selected.length) {
    throw new Error("Satu kolom CSV tidak boleh digunakan untuk dua field.");
  }
  if (selected.some((header) => !headers.includes(header))) {
    throw new Error("Mapping mengarah ke kolom CSV yang tidak tersedia.");
  }
}
