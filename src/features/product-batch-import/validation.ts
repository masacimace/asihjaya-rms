import type { AuthContext } from "@/lib/auth/session";

import {
  PRODUCT_BATCH_IMPORT_ITEM_AVAILABILITIES,
  PRODUCT_BATCH_IMPORT_ITEM_CONDITIONS,
  PRODUCT_BATCH_IMPORT_MASTER_STATUSES,
} from "./contracts";
import type {
  ParsedProductBatchItemRow,
  ParsedProductBatchMasterRow,
  ParsedProductBatchWorkbook,
} from "./xlsx-parser";
import type { ProductBatchImageManifest } from "./image-manifest";

export type ProductBatchValidationIssue = {
  severity: "error" | "warning";
  code: string;
  field: string | null;
  message: string;
  scope?: "row" | "archive" | "workbook" | "permission";
  archivePath?: string;
};

export type ProductBatchResolvedCategory = {
  id: string;
  code: string;
  name?: string;
  isActive?: boolean;
};

export type ProductBatchResolvedMaster = {
  id: string;
  categoryId: string;
  name: string;
  status: "draft" | "active" | "inactive";
};

export type ProductBatchResolvedOutlet = {
  id: string;
  code: string;
};

export type ProductBatchValidationLookups = {
  categoriesByCode: ReadonlyMap<string, ProductBatchResolvedCategory>;
  categoriesByLookupKey: ReadonlyMap<string, readonly ProductBatchResolvedCategory[]>;
  mastersByCategoryAndName: ReadonlyMap<string, readonly ProductBatchResolvedMaster[]>;
  outletsByCode: ReadonlyMap<string, ProductBatchResolvedOutlet>;
};

export type ProductBatchValidatedMasterRow = {
  rowNumber: number;
  stagingMasterKey: string;
  masterKey: string | null;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  validationStatus: "valid" | "warning" | "invalid";
  validationErrors: ProductBatchValidationIssue[];
  validationWarnings: ProductBatchValidationIssue[];
  resolvedCategoryId: string | null;
};

export type ProductBatchValidatedItemRow = {
  rowNumber: number;
  stagingRowKey: string;
  rowKey: string | null;
  stagingMasterKey: string;
  masterKey: string | null;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  validationStatus: "valid" | "warning" | "invalid";
  validationErrors: ProductBatchValidationIssue[];
  validationWarnings: ProductBatchValidationIssue[];
  resolvedOutletId: string | null;
};

export type ProductBatchValidationResult = {
  masterRows: ProductBatchValidatedMasterRow[];
  itemRows: ProductBatchValidatedItemRow[];
  warningCount: number;
  invalidRows: number;
  validMasterRows: number;
  validItemRows: number;
};

const MONEY_PATTERN = /^\d{1,18}$/;
const DECIMAL_PATTERN = /^\d{1,9}(?:[.,]\d{1,3})?$/;
const PERCENT_PATTERN = /^\d{1,3}(?:[.,]\d{1,3})?$/;
const SAFE_STAGING_KEY_LIMIT = 120;

function issue(
  severity: ProductBatchValidationIssue["severity"],
  code: string,
  field: string | null,
  message: string,
  extra: Partial<ProductBatchValidationIssue> = {},
): ProductBatchValidationIssue {
  return { severity, code, field, message, ...extra };
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value.trim() : String(value).trim();
}

function nullableText(value: unknown): string | null {
  const normalized = text(value);
  return normalized ? normalized : null;
}

function safeStagingKey(
  preferred: string | null,
  prefix: "MASTER" | "ITEM" | "MASTER_REF",
  rowNumber: number,
  duplicateOrdinal = 0,
): string {
  if (
    preferred &&
    preferred.length <= 80 &&
    duplicateOrdinal === 0
  ) {
    return preferred;
  }

  const preferredPart = preferred
    ? preferred.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 64)
    : "EMPTY";
  const suffix = duplicateOrdinal > 0 ? `-DUP${duplicateOrdinal}` : "";
  return `__${prefix}_ROW_${rowNumber}_${preferredPart}${suffix}__`.slice(
    0,
    SAFE_STAGING_KEY_LIMIT,
  );
}

function keyOccurrences<T>(
  rows: T[],
  getKey: (row: T) => string | null,
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const key = getKey(row);
    if (!key) return;
    const indexes = result.get(key) ?? [];
    indexes.push(index);
    result.set(key, indexes);
  });
  return result;
}

function duplicateOrdinals<T>(
  rows: T[],
  getKey: (row: T) => string | null,
): number[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = getKey(row);
    if (!key) return 0;
    const next = (seen.get(key) ?? 0) + 1;
    seen.set(key, next);
    return next === 1 ? 0 : next - 1;
  });
}

function parsePositiveDecimal(
  value: unknown,
  label: string,
): { value: string | null; error: string | null } {
  const raw = text(value);
  if (!raw) return { value: null, error: null };
  if (!DECIMAL_PATTERN.test(raw)) {
    return {
      value: null,
      error: `${label} harus berupa angka positif dengan maksimal 3 desimal.`,
    };
  }
  const normalized = raw.replace(",", ".");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { value: null, error: `${label} harus lebih besar dari 0.` };
  }
  return { value: normalized, error: null };
}

function parsePercent(
  value: unknown,
  label: string,
): { value: string | null; error: string | null } {
  const raw = text(value);
  if (!raw) return { value: null, error: null };
  if (!PERCENT_PATTERN.test(raw)) {
    return {
      value: null,
      error: `${label} harus berupa angka > 0 sampai 100 dengan maksimal 3 desimal.`,
    };
  }
  const normalized = raw.replace(",", ".");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) {
    return { value: null, error: `${label} harus berada di atas 0 dan maksimal 100.` };
  }
  return { value: normalized, error: null };
}

function parseMoney(
  value: unknown,
  label: string,
  options: { allowZero: boolean },
): { value: string | null; error: string | null } {
  if (value === null || value === undefined || value === "") {
    return { value: null, error: null };
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      return {
        value: null,
        error: `${label} dari cell angka harus berupa integer Rupiah yang aman. Gunakan text untuk nominal sangat besar.`,
      };
    }
  }

  const raw = text(value);
  const normalized = raw
    .replace(/^rp\s*/i, "")
    .replace(/[.\s]/g, "")
    .replace(/^0+(?=\d)/, "");

  if (!MONEY_PATTERN.test(normalized)) {
    return {
      value: null,
      error: `${label} harus berupa nominal Rupiah bulat maksimal 18 digit.`,
    };
  }

  if (!options.allowZero && /^0+$/.test(normalized)) {
    return { value: null, error: `${label} harus lebih besar dari Rp 0.` };
  }

  return { value: normalized, error: null };
}

function addLengthError(
  issues: ProductBatchValidationIssue[],
  field: string,
  value: string,
  max: number,
  label: string,
) {
  if (value.length > max) {
    issues.push(
      issue(
        "error",
        "TEXT_TOO_LONG",
        field,
        `${label} maksimal ${max.toLocaleString("id-ID")} karakter.`,
      ),
    );
  }
}

function toStatus(
  errors: ProductBatchValidationIssue[],
  warnings: ProductBatchValidationIssue[],
): "valid" | "warning" | "invalid" {
  if (errors.length > 0) return "invalid";
  if (warnings.length > 0) return "warning";
  return "valid";
}

function hasPermission(auth: AuthContext, permission: string) {
  return auth.permissionCodes.includes(permission);
}

function hasInventoryPermission(auth: AuthContext) {
  return (
    hasPermission(auth, "inventory.receive") ||
    hasPermission(auth, "inventory.manage")
  );
}

function referenceMap(images: ProductBatchImageManifest) {
  const masterByName = new Map<string, string>();
  const physicalByName = new Map<string, string>();
  for (const entry of images.entries) {
    const map = entry.entityKind === "master" ? masterByName : physicalByName;
    map.set(entry.normalizedFileName, entry.archivePath);
  }
  return { masterByName, physicalByName };
}

function normalizedImageName(value: unknown): string | null {
  const raw = nullableText(value);
  return raw ? raw.normalize("NFKC").toLocaleLowerCase("en-US") : null;
}


function normalizeLookupText(value: unknown) {
  return text(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("id-ID");
}

function normalizeV2Condition(value: unknown) {
  const normalized = normalizeLookupText(value).toLocaleLowerCase("id-ID");
  if (!normalized || normalized === "good" || normalized === "baru") return "good";
  if (normalized === "used" || normalized === "bekas") return "used";
  if (normalized === "damaged" || normalized === "rusak") return "damaged";
  return normalized;
}
function validateMasterRows({
  workbook,
  images,
  lookups,
  auth,
}: {
  workbook: ParsedProductBatchWorkbook;
  images: ProductBatchImageManifest;
  lookups: ProductBatchValidationLookups;
  auth: AuthContext;
}) {
  const isV2 = workbook.templateVersion === "2";
  const { masterByName } = referenceMap(images);
  const normalizedKeys = workbook.masterRows.map((row) =>
    nullableText(row.normalizedPayload.master_key),
  );
  const occurrences = keyOccurrences(normalizedKeys, (value) => value);
  const duplicateOrder = duplicateOrdinals(normalizedKeys, (value) => value);

  return workbook.masterRows.map((row, index): ProductBatchValidatedMasterRow => {
    const errors: ProductBatchValidationIssue[] = [];
    const warnings: ProductBatchValidationIssue[] = [];
    const masterKey = normalizedKeys[index] ?? null;
    const name = text(row.normalizedPayload.name);
    const categoryCode = text(row.normalizedPayload.category_code);
    const brand = isV2 ? null : nullableText(row.normalizedPayload.brand);
    const material = isV2 ? null : nullableText(row.normalizedPayload.material);
    const collection = isV2 ? null : nullableText(row.normalizedPayload.collection);
    const description = isV2 ? null : nullableText(row.normalizedPayload.description);
    const primaryImage = isV2 ? null : nullableText(row.normalizedPayload.primary_image);
    const primaryImageLookup = isV2
      ? null
      : normalizedImageName(row.normalizedPayload.primary_image);
    const statusRaw = text(row.normalizedPayload.status).toLocaleLowerCase("en-US");
    const status = isV2 ? "active" : statusRaw || "active";

    if (!masterKey) {
      errors.push(issue("error", "MASTER_KEY_REQUIRED", "master_key", "Internal master key tidak tersedia."));
    } else if (masterKey.length > 80) {
      errors.push(issue("error", "MASTER_KEY_TOO_LONG", "master_key", "Internal master key maksimal 80 karakter."));
    }
    if (masterKey && (occurrences.get(masterKey)?.length ?? 0) > 1) {
      errors.push(issue("error", "MASTER_KEY_DUPLICATE", "master_key", `Master group ${masterKey} muncul lebih dari sekali di workbook.`));
    }

    if (name.length < 2) {
      errors.push(issue("error", "MASTER_NAME_REQUIRED", "product_master_name", "Nama Product Master minimal 2 karakter."));
    }
    addLengthError(errors, isV2 ? "product_master_name" : "name", name, 200, "Nama Product Master");

    let category: ProductBatchResolvedCategory | null = null;
    if (!categoryCode) {
      errors.push(issue("error", "CATEGORY_REQUIRED", isV2 ? "category" : "category_code", "Kategori wajib diisi."));
    } else if (isV2) {
      addLengthError(errors, "category", categoryCode, 120, "Kategori");
      const candidates = lookups.categoriesByLookupKey.get(normalizeLookupText(categoryCode)) ?? [];
      if (candidates.length > 1) {
        errors.push(issue(
          "error",
          "CATEGORY_AMBIGUOUS",
          "category",
          `Kategori ${categoryCode} cocok ke lebih dari satu kategori existing. Gunakan nama atau code yang unik.`,
        ));
      } else {
        category = candidates[0] ?? null;
      }
    } else {
      addLengthError(errors, "category_code", categoryCode, 48, "Category code");
      category = lookups.categoriesByCode.get(categoryCode) ?? null;
      if (!category) {
        errors.push(issue("error", "CATEGORY_NOT_FOUND_OR_INACTIVE", "category_code", `Category ${categoryCode} tidak ditemukan atau tidak aktif pada organization ini.`));
      }
    }

    if (brand) addLengthError(errors, "brand", brand, 120, "Brand");
    if (material) addLengthError(errors, "material", material, 80, "Material");
    if (collection) addLengthError(errors, "collection", collection, 120, "Collection");
    if (description) addLengthError(errors, "description", description, 4_000, "Description");

    if (!isV2) {
      if (!primaryImage || !primaryImageLookup) {
        errors.push(issue("error", "MASTER_IMAGE_REQUIRED", "primary_image", "Primary image Product Master wajib diisi pada template v1."));
      } else if (!masterByName.has(primaryImageLookup)) {
        errors.push(issue("error", "MASTER_IMAGE_NOT_STAGED", "primary_image", `Primary image ${primaryImage} tidak tersedia pada image manifest.`));
      }
      if (!PRODUCT_BATCH_IMPORT_MASTER_STATUSES.includes(status as (typeof PRODUCT_BATCH_IMPORT_MASTER_STATUSES)[number])) {
        errors.push(issue("error", "MASTER_STATUS_INVALID", "status", "Status Product Master hanya boleh draft atau active."));
      }
    }

    let existingMasterId: string | null = null;
    if (isV2 && category && name) {
      const key = `${category.id}:${normalizeLookupText(name)}`;
      const masterCandidates = lookups.mastersByCategoryAndName.get(key) ?? [];
      if (masterCandidates.length > 1) {
        errors.push(issue(
          "error",
          "PRODUCT_MASTER_AMBIGUOUS",
          "product_master_name",
          `Product Master ${name} pada kategori ${categoryCode} memiliki lebih dari satu kandidat existing. Rapikan data Product Master terlebih dahulu.`,
        ));
      } else {
        existingMasterId = masterCandidates[0]?.id ?? null;
      }
    }

    if (!hasPermission(auth, "products.manage")) {
      errors.push(issue("error", "PERMISSION_PRODUCTS_MANAGE_REQUIRED", null, "Permission products.manage diperlukan untuk membuat/menggunakan Product Master.", { scope: "permission" }));
    }

    const normalizedPayload: Record<string, unknown> = {
      ...row.normalizedPayload,
      master_key: masterKey,
      name,
      category_code: categoryCode,
      brand,
      material,
      collection,
      description,
      primary_image: primaryImage,
      status,
      _existing_product_master_id: existingMasterId,
      _row_fingerprint: row.rowFingerprint,
    };

    return {
      rowNumber: row.rowNumber,
      stagingMasterKey: safeStagingKey(masterKey, "MASTER", row.rowNumber, duplicateOrder[index] ?? 0),
      masterKey,
      rawPayload: row.rawPayload,
      normalizedPayload,
      validationStatus: toStatus(errors, warnings),
      validationErrors: errors,
      validationWarnings: warnings,
      resolvedCategoryId: category?.id ?? null,
    };
  });
}

function validateItemRows({
  workbook,
  images,
  lookups,
  auth,
  masterRows,
}: {
  workbook: ParsedProductBatchWorkbook;
  images: ProductBatchImageManifest;
  lookups: ProductBatchValidationLookups;
  auth: AuthContext;
  masterRows: ProductBatchValidatedMasterRow[];
}) {
  const isV2 = workbook.templateVersion === "2";
  const { physicalByName } = referenceMap(images);
  const rowKeys = workbook.itemRows.map((row) => nullableText(row.normalizedPayload.row_key));
  const occurrences = keyOccurrences(rowKeys, (value) => value);
  const duplicateOrder = duplicateOrdinals(rowKeys, (value) => value);
  const mastersByKey = new Map<string, ProductBatchValidatedMasterRow[]>();
  for (const master of masterRows) {
    if (!master.masterKey) continue;
    const existing = mastersByKey.get(master.masterKey) ?? [];
    existing.push(master);
    mastersByKey.set(master.masterKey, existing);
  }

  const allowedOutletIds = new Set(auth.outlets.map((outlet) => outlet.id));
  const canManagePricing = hasPermission(auth, "pricing.manage");
  const canManageInventory = hasInventoryPermission(auth);

  return workbook.itemRows.map((row, index): ProductBatchValidatedItemRow => {
    const errors: ProductBatchValidationIssue[] = [];
    const warnings: ProductBatchValidationIssue[] = [];
    const rowKey = rowKeys[index] ?? null;
    const masterKey = nullableText(row.normalizedPayload.master_key);
    const displayName = nullableText(row.normalizedPayload.display_name);
    const outletCode = nullableText(row.normalizedPayload.outlet_code);
    const size = isV2 ? null : nullableText(row.normalizedPayload.size);
    const color = nullableText(row.normalizedPayload.color);
    const gemstone = isV2 ? null : nullableText(row.normalizedPayload.gemstone);
    const locationCode = isV2 ? null : nullableText(row.normalizedPayload.location_code);
    const physicalImage = nullableText(row.normalizedPayload.physical_image);
    const physicalImageLookup = normalizedImageName(row.normalizedPayload.physical_image);
    const internalNotes = nullableText(row.normalizedPayload.internal_notes);
    const availabilityRaw = text(row.normalizedPayload.initial_availability).toLocaleLowerCase("en-US");
    const availability = isV2 ? "available" : availabilityRaw || "draft";
    const condition = isV2
      ? normalizeV2Condition(row.normalizedPayload.condition)
      : text(row.normalizedPayload.condition).toLocaleLowerCase("en-US") || "good";

    if (!rowKey) {
      errors.push(issue("error", "ROW_KEY_REQUIRED", "row_key", "Internal row key tidak tersedia."));
    } else if (rowKey.length > 80) {
      errors.push(issue("error", "ROW_KEY_TOO_LONG", "row_key", "Internal row key maksimal 80 karakter."));
    }
    if (rowKey && (occurrences.get(rowKey)?.length ?? 0) > 1) {
      errors.push(issue("error", "ROW_KEY_DUPLICATE", "row_key", `Internal row ${rowKey} duplicate.`));
    }

    const matchingMasters = masterKey ? mastersByKey.get(masterKey) ?? [] : [];
    const parent = matchingMasters.length === 1 ? matchingMasters[0]! : null;
    if (!masterKey || matchingMasters.length === 0) {
      errors.push(issue("error", "MASTER_KEY_NOT_FOUND", "product_master_name", "Product Master parent tidak dapat dipetakan."));
    } else if (matchingMasters.length > 1) {
      errors.push(issue("error", "MASTER_KEY_AMBIGUOUS", "product_master_name", "Relasi Product Master pada row ini ambigu."));
    } else if (parent?.validationStatus === "invalid") {
      errors.push(issue("error", "PARENT_MASTER_INVALID", "product_master_name", "Product Master parent memiliki validation error."));
    }

    const effectiveDisplayName =
      isV2 && !displayName && parent
        ? nullableText(parent.normalizedPayload.name)
        : displayName;
    if (effectiveDisplayName) {
      addLengthError(errors, "display_name", effectiveDisplayName, 220, "Display name");
    }
    if (!outletCode && isV2) {
      errors.push(issue("error", "OUTLET_REQUIRED", "outlet_code", "outlet_code wajib diisi untuk item batch yang langsung AVAILABLE."));
    }
    if (outletCode) addLengthError(errors, "outlet_code", outletCode, 24, "Outlet code");
    if (size) addLengthError(errors, "size", size, 64, "Size");
    if (!color && isV2) {
      errors.push(issue("error", "COLOR_REQUIRED", "color", "color wajib diisi."));
    }
    if (color) addLengthError(errors, "color", color, 64, "Color");
    if (gemstone) addLengthError(errors, "gemstone", gemstone, 160, "Gemstone");
    if (locationCode) addLengthError(errors, "location_code", locationCode, 80, "Location code");
    if (internalNotes) addLengthError(errors, "internal_notes", internalNotes, 4_000, "Internal notes");

    const weight = parsePositiveDecimal(row.normalizedPayload.weight_gram, "weight_gram");
    const purity = parsePercent(row.normalizedPayload.purity_percent, "purity_percent");
    const exchangePurity = parsePercent(row.normalizedPayload.exchange_purity_percent, "exchange_purity_percent");
    const cost = isV2 ? { value: null, error: null } : parseMoney(row.normalizedPayload.cost_amount, "cost_amount", { allowZero: true });
    const selling = isV2 ? { value: null, error: null } : parseMoney(row.normalizedPayload.selling_amount, "selling_amount", { allowZero: false });
    const pricePerGram = isV2 ? { value: null, error: null } : parseMoney(row.normalizedPayload.price_per_gram, "price_per_gram", { allowZero: true });
    const deductionPerGram = parseMoney(row.normalizedPayload.deduction_per_gram, "deduction_per_gram", { allowZero: true });

    for (const [field, parsed] of [
      ["weight_gram", weight],
      ["purity_percent", purity],
      ["exchange_purity_percent", exchangePurity],
      ["cost_amount", cost],
      ["selling_amount", selling],
      ["price_per_gram", pricePerGram],
      ["deduction_per_gram", deductionPerGram],
    ] as const) {
      if (parsed.error) errors.push(issue("error", "NUMERIC_VALUE_INVALID", field, parsed.error));
    }

    if (isV2) {
      if (!weight.value) errors.push(issue("error", "WEIGHT_REQUIRED", "weight_gram", "weight_gram > 0 wajib diisi."));
      if (!purity.value) errors.push(issue("error", "PURITY_REQUIRED", "purity_percent", "purity_percent wajib diisi."));
      if (!exchangePurity.value) errors.push(issue("error", "EXCHANGE_PURITY_REQUIRED", "exchange_purity_percent", "exchange_purity_percent wajib diisi."));
      if (!(["good", "used"] as string[]).includes(condition)) {
        errors.push(issue("error", "ITEM_CONDITION_NOT_SELLABLE", "condition", "Batch import langsung AVAILABLE hanya menerima Baru/good atau Bekas/used. Barang Rusak dibuat melalui flow manual."));
      }
    } else {
      if (!PRODUCT_BATCH_IMPORT_ITEM_CONDITIONS.includes(condition as (typeof PRODUCT_BATCH_IMPORT_ITEM_CONDITIONS)[number])) {
        errors.push(issue("error", "ITEM_CONDITION_INVALID", "condition", "Condition hanya boleh good, used, atau damaged."));
      }
      if (!PRODUCT_BATCH_IMPORT_ITEM_AVAILABILITIES.includes(availability as (typeof PRODUCT_BATCH_IMPORT_ITEM_AVAILABILITIES)[number])) {
        errors.push(issue("error", "ITEM_AVAILABILITY_INVALID", "initial_availability", "Availability hanya boleh draft atau available."));
      }
    }

    const outlet = outletCode ? lookups.outletsByCode.get(outletCode) ?? null : null;
    if (outletCode && !outlet) {
      errors.push(issue("error", "OUTLET_NOT_FOUND_OR_INACTIVE", "outlet_code", `Outlet ${outletCode} tidak ditemukan atau tidak aktif pada organization ini.`));
    } else if (outlet && !allowedOutletIds.has(outlet.id)) {
      errors.push(issue("error", "OUTLET_ACCESS_DENIED", "outlet_code", `Akun ini tidak memiliki akses ke outlet ${outletCode}.`, { scope: "permission" }));
    }

    const hasFinancialInput = !isV2 && ([cost.value, selling.value, pricePerGram.value, deductionPerGram.value].some((value) => value !== null) ||
      [row.normalizedPayload.cost_amount, row.normalizedPayload.selling_amount, row.normalizedPayload.price_per_gram, row.normalizedPayload.deduction_per_gram]
        .some((value) => text(value) !== ""));
    if (hasFinancialInput && !canManagePricing) {
      errors.push(issue("error", "PERMISSION_PRICING_REQUIRED", null, "Permission pricing.manage diperlukan karena row template v1 mengisi field harga/nominal.", { scope: "permission" }));
    }
    if (!canManageInventory) {
      errors.push(issue("error", "PERMISSION_INVENTORY_REQUIRED", null, "Permission inventory.receive atau inventory.manage diperlukan untuk membuat Product Item.", { scope: "permission" }));
    }

    if (physicalImageLookup && !physicalByName.has(physicalImageLookup)) {
      errors.push(issue("error", "PHYSICAL_IMAGE_NOT_STAGED", "physical_image", `Physical image ${physicalImage} tidak tersedia pada image manifest.`));
    }

    const parentPrimaryImage = !isV2 && parent ? nullableText(parent.normalizedPayload.primary_image) : null;
    const effectiveImageSource = physicalImage ? "physical" : parentPrimaryImage ? "master_fallback" : null;

    if (!isV2 && availability === "available") {
      if (!parent || parent.normalizedPayload.status !== "active") {
        errors.push(issue("error", "AVAILABLE_MASTER_NOT_ACTIVE", "initial_availability", "Item available hanya dapat memakai Product Master active."));
      }
      if (!outlet || !allowedOutletIds.has(outlet.id)) errors.push(issue("error", "AVAILABLE_OUTLET_REQUIRED", "outlet_code", "Outlet aktif dan accessible wajib untuk item available."));
      if (!weight.value) errors.push(issue("error", "AVAILABLE_WEIGHT_REQUIRED", "weight_gram", "weight_gram > 0 wajib untuk item available."));
      if (!selling.value) errors.push(issue("error", "AVAILABLE_SELLING_REQUIRED", "selling_amount", "selling_amount > 0 wajib untuk item available."));
      if (condition !== "good") errors.push(issue("error", "AVAILABLE_CONDITION_INVALID", "condition", "Item available template v1 wajib berkondisi good."));
      if (!effectiveImageSource) errors.push(issue("error", "AVAILABLE_IMAGE_REQUIRED", "physical_image", "Item available template v1 wajib mempunyai physical image atau master fallback image."));
    }

    if (!isV2 && !physicalImage && parentPrimaryImage) {
      warnings.push(issue("warning", "MASTER_IMAGE_FALLBACK", "physical_image", `Item ${rowKey ?? `row ${row.rowNumber}`} tidak memiliki physical image dan akan memakai primary image Product Master.`));
    }

    const normalizedPayload: Record<string, unknown> = {
      ...row.normalizedPayload,
      row_key: rowKey,
      master_key: masterKey,
      display_name: effectiveDisplayName,
      outlet_code: outletCode,
      weight_gram: weight.value,
      purity_percent: purity.value,
      exchange_purity_percent: exchangePurity.value,
      size,
      color,
      gemstone,
      cost_amount: cost.value,
      selling_amount: selling.value,
      price_per_gram: pricePerGram.value,
      deduction_per_gram: deductionPerGram.value ?? (isV2 ? "0" : null),
      condition,
      location_code: locationCode,
      physical_image: physicalImage,
      internal_notes: internalNotes,
      initial_availability: availability,
      _effective_image_source: effectiveImageSource,
      _row_fingerprint: row.rowFingerprint,
    };

    return {
      rowNumber: row.rowNumber,
      stagingRowKey: safeStagingKey(rowKey, "ITEM", row.rowNumber, duplicateOrder[index] ?? 0),
      rowKey,
      stagingMasterKey: safeStagingKey(masterKey, "MASTER_REF", row.rowNumber),
      masterKey,
      rawPayload: row.rawPayload,
      normalizedPayload,
      validationStatus: toStatus(errors, warnings),
      validationErrors: errors,
      validationWarnings: warnings,
      resolvedOutletId: outlet && allowedOutletIds.has(outlet.id) ? outlet.id : null,
    };
  });
}

function attachGlobalWarnings(
  masterRows: ProductBatchValidatedMasterRow[],
  itemRows: ProductBatchValidatedItemRow[],
  workbook: ParsedProductBatchWorkbook,
  images: ProductBatchImageManifest,
) {
  const target = masterRows[0] ?? itemRows[0] ?? null;
  if (!target) return;

  for (const warning of workbook.warnings) {
    target.validationWarnings.push(
      issue("warning", warning.code, null, warning.message, { scope: "workbook" }),
    );
  }
  for (const warning of images.warnings) {
    target.validationWarnings.push(
      issue("warning", warning.code, null, warning.message, {
        scope: "archive",
        archivePath: warning.archivePath,
      }),
    );
  }
  target.validationStatus = toStatus(
    target.validationErrors,
    target.validationWarnings,
  );
}

export function validateProductBatchImportPackage({
  workbook,
  images,
  lookups,
  auth,
}: {
  workbook: ParsedProductBatchWorkbook;
  images: ProductBatchImageManifest;
  lookups: ProductBatchValidationLookups;
  auth: AuthContext;
}): ProductBatchValidationResult {
  const masterRows = validateMasterRows({ workbook, images, lookups, auth });
  const itemRows = validateItemRows({
    workbook,
    images,
    lookups,
    auth,
    masterRows,
  });

  attachGlobalWarnings(masterRows, itemRows, workbook, images);

  const invalidRows = [...masterRows, ...itemRows].filter(
    (row) => row.validationStatus === "invalid",
  ).length;
  const warningCount = [...masterRows, ...itemRows].reduce(
    (total, row) => total + row.validationWarnings.length,
    0,
  );
  const validMasterRows = masterRows.filter(
    (row) => row.validationStatus !== "invalid",
  ).length;
  const validItemRows = itemRows.filter(
    (row) => row.validationStatus !== "invalid",
  ).length;

  return {
    masterRows,
    itemRows,
    warningCount,
    invalidRows,
    validMasterRows,
    validItemRows,
  };
}

export function collectProductBatchLookupCodes(workbook: ParsedProductBatchWorkbook) {
  return {
    categoryCodes: Array.from(
      new Set(
        workbook.masterRows
          .map((row: ParsedProductBatchMasterRow) => text(row.normalizedPayload.category_code))
          .filter(Boolean),
      ),
    ),
    outletCodes: Array.from(
      new Set(
        workbook.itemRows
          .map((row: ParsedProductBatchItemRow) => text(row.normalizedPayload.outlet_code))
          .filter(Boolean),
      ),
    ),
  };
}
