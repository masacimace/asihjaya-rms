import type { ParsedLegacyProductRow } from "@/features/legacy-migration/contracts";

const CATEGORY_ALIASES: Record<string, string> = {
  ANTING: "EARRING",
  CINCIN: "RING",
  GELANG: "BRACELET",
  GIWANG: "EARRING",
  KALUNG: "NECKLACE",
  LIONTIN: "PENDANT",
  "LOGAM MULIA": "PRECIOUS_METAL",
};

export function normalizeLegacyLabel(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeLegacyCategoryName(
  value: string | null | undefined,
) {
  const normalized = normalizeLegacyLabel(value).toLocaleLowerCase("id-ID");
  if (!normalized) return null;

  return normalized.replace(/(^|\s)\S/g, (character) =>
    character.toLocaleUpperCase("id-ID"),
  );
}

export function getSuggestedCategoryCode(
  value: string | null | undefined,
) {
  const normalized = normalizeLegacyLabel(value).toLocaleUpperCase("id-ID");
  return CATEGORY_ALIASES[normalized] ?? null;
}

export function buildLegacyProductMasterCode(legacyMasterCode: string) {
  const normalized = normalizeLegacyLabel(legacyMasterCode)
    .toLocaleUpperCase("id-ID")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);

  return `LEG-${normalized || "MASTER"}`;
}

export type LegacyMasterMappingSeed = {
  legacyMasterCode: string;
  legacyMasterName: string;
  legacyCategory: string | null;
  normalizedCategoryName: string | null;
  itemCount: number;
};

export function collectLegacyMasterMappingSeeds(
  rows: ParsedLegacyProductRow[],
): LegacyMasterMappingSeed[] {
  const mappings = new Map<string, LegacyMasterMappingSeed>();

  for (const row of rows) {
    const legacyMasterCode = normalizeLegacyLabel(row.legacyMasterCode);
    if (!legacyMasterCode) continue;

    const legacyMasterName =
      normalizeLegacyLabel(row.legacyMasterName) || legacyMasterCode;
    const legacyCategory = normalizeLegacyLabel(row.legacyCategory) || null;
    const current = mappings.get(legacyMasterCode);

    if (current) {
      current.itemCount += 1;
      continue;
    }

    mappings.set(legacyMasterCode, {
      legacyMasterCode,
      legacyMasterName,
      legacyCategory,
      normalizedCategoryName: normalizeLegacyCategoryName(legacyCategory),
      itemCount: 1,
    });
  }

  return Array.from(mappings.values()).sort((left, right) =>
    left.legacyMasterCode.localeCompare(right.legacyMasterCode, "id-ID"),
  );
}
