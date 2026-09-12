const DEFAULT_BASE_URL = "https://emas.maulanar.my.id";
const DEFAULT_CACHE_SECONDS = 60 * 60;
const DEFAULT_TIMEOUT_MS = 8_000;
const COLLECTION_LIMIT = 100;
const TARGET_WEIGHT_GRAMS = 1;

const DEFAULT_REFERENCE = {
  brand: "ANTAM",
  resource: "antam",
} as const;

const EXCLUDED_BRANDS = new Set([
  "ANTAM MULIA RETRO",
  "ANTAM NON PEGADAIAN",
  "LOTUS ARCHI",
  "SENTRA BUYBACK",
]);

type UnknownRecord = Record<string, unknown>;

type NormalizedPriceRecord = {
  referenceKey: string;
  brand: string;
  canonicalBrand: string;
  resource: string;
  weightGrams: number;
  sellPrice: number;
  buybackPrice: number | null;
  updatedAt: string | null;
  sortTimestamp: number | null;
  dateKey: string | null;
  originalIndex: number;
};

export type GoldReferenceSnapshot = {
  referenceKey: string;
  brand: string;
  resource: string;
  weightGrams: number;
  sellPrice: number;
  buybackPrice: number | null;
  sellPriceChange: number | null;
  buybackPriceChange: number | null;
  updatedAt: string | null;
  comparisonUpdatedAt: string | null;
};

export type GoldReferenceCollection = {
  provider: "Emas API ID";
  references: GoldReferenceSnapshot[];
  defaultReferenceKey: string;
  fetchedAt: string;
};

export type GoldReferenceResult =
  | {
      status: "ready";
      data: GoldReferenceCollection;
    }
  | {
      status: "not_configured";
    }
  | {
      status: "unavailable";
    };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeCandidates(payload: unknown): UnknownRecord[] {
  if (!isRecord(payload)) return [];

  const data = payload.data;
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  return isRecord(data) ? [data] : [];
}

function toSortTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateKey(value: string | null): string | null {
  if (!value) return null;

  const isoDateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  const isoDate = isoDateMatch?.[1];
  if (isoDate) return isoDate;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function createReferenceKey(brand: string, resource: string) {
  return `${brand.trim().toUpperCase()}::${resource.trim().toLowerCase()}`;
}

function normalizePriceRecord(
  candidate: UnknownRecord,
  originalIndex: number,
): NormalizedPriceRecord | null {
  const brand = toOptionalString(candidate.brand);
  const resource = toOptionalString(candidate.resource)?.toLowerCase();
  const weightGrams =
    toFiniteNumber(candidate.weight) ?? toFiniteNumber(candidate.gramasi);

  if (!brand || !resource || weightGrams === null) return null;

  const canonicalBrand = brand.toUpperCase();
  if (EXCLUDED_BRANDS.has(canonicalBrand)) return null;

  if (Math.abs(weightGrams - TARGET_WEIGHT_GRAMS) >= 0.0001) return null;

  const sellPrice = toFiniteNumber(candidate.sell_price);
  if (sellPrice === null || sellPrice <= 0) return null;

  const buybackPrice = toFiniteNumber(candidate.buyback_price);
  const updatedAt =
    toOptionalString(candidate.updated_at) ?? toOptionalString(candidate.date);

  return {
    referenceKey: createReferenceKey(canonicalBrand, resource),
    brand,
    canonicalBrand,
    resource,
    weightGrams,
    sellPrice,
    buybackPrice:
      buybackPrice !== null && buybackPrice > 0 ? buybackPrice : null,
    updatedAt,
    sortTimestamp: toSortTimestamp(updatedAt),
    dateKey: toDateKey(updatedAt),
    originalIndex,
  };
}

function sortPriceRecords(
  left: NormalizedPriceRecord,
  right: NormalizedPriceRecord,
) {
  if (left.sortTimestamp !== null && right.sortTimestamp !== null) {
    return right.sortTimestamp - left.sortTimestamp;
  }

  if (left.sortTimestamp !== null) return -1;
  if (right.sortTimestamp !== null) return 1;
  return left.originalIndex - right.originalIndex;
}

function toReferenceSnapshot(
  records: NormalizedPriceRecord[],
): GoldReferenceSnapshot | null {
  const sorted = [...records].sort(sortPriceRecords);
  const latest = sorted[0];
  if (!latest) return null;

  const previous = sorted.find((record, index) => {
    if (index === 0) return false;

    if (latest.dateKey && record.dateKey) {
      return record.dateKey !== latest.dateKey;
    }

    return record.updatedAt !== latest.updatedAt;
  });

  return {
    referenceKey: latest.referenceKey,
    brand: latest.brand,
    resource: latest.resource,
    weightGrams: latest.weightGrams,
    sellPrice: latest.sellPrice,
    buybackPrice: latest.buybackPrice,
    sellPriceChange: previous
      ? latest.sellPrice - previous.sellPrice
      : null,
    buybackPriceChange:
      previous && latest.buybackPrice !== null && previous.buybackPrice !== null
        ? latest.buybackPrice - previous.buybackPrice
        : null,
    updatedAt: latest.updatedAt,
    comparisonUpdatedAt: previous?.updatedAt ?? null,
  };
}

export function parseEmasApiPricesPayload(
  payload: unknown,
): Omit<GoldReferenceCollection, "provider" | "fetchedAt"> | null {
  const groupedRecords = new Map<string, NormalizedPriceRecord[]>();

  normalizeCandidates(payload)
    .map(normalizePriceRecord)
    .filter((record): record is NormalizedPriceRecord => record !== null)
    .forEach((record) => {
      const existing = groupedRecords.get(record.referenceKey);
      if (existing) {
        existing.push(record);
      } else {
        groupedRecords.set(record.referenceKey, [record]);
      }
    });

  const defaultReferenceKey = createReferenceKey(
    DEFAULT_REFERENCE.brand,
    DEFAULT_REFERENCE.resource,
  );

  const references = Array.from(groupedRecords.values())
    .map(toReferenceSnapshot)
    .filter((reference): reference is GoldReferenceSnapshot => reference !== null)
    .sort((left, right) => {
      if (left.referenceKey === defaultReferenceKey) return -1;
      if (right.referenceKey === defaultReferenceKey) return 1;

      const brandOrder = left.brand.localeCompare(right.brand, "id", {
        sensitivity: "base",
      });
      if (brandOrder !== 0) return brandOrder;
      return left.resource.localeCompare(right.resource, "id", {
        sensitivity: "base",
      });
    });

  const firstReference = references[0];
  if (!firstReference) return null;

  return {
    references,
    defaultReferenceKey: references.some(
      (reference) => reference.referenceKey === defaultReferenceKey,
    )
      ? defaultReferenceKey
      : firstReference.referenceKey,
  };
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function getConfig() {
  const apiKey = process.env.EMAS_API_ID_API_KEY?.trim() ?? "";
  const baseUrl =
    process.env.EMAS_API_ID_BASE_URL?.trim().replace(/\/$/, "") ??
    DEFAULT_BASE_URL;

  return {
    apiKey,
    baseUrl: baseUrl || DEFAULT_BASE_URL,
    cacheSeconds: parsePositiveInteger(
      process.env.EMAS_API_ID_CACHE_SECONDS,
      DEFAULT_CACHE_SECONDS,
      86_400,
    ),
    timeoutMs: parsePositiveInteger(
      process.env.EMAS_API_ID_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      30_000,
    ),
  };
}

function buildPricesUrl(baseUrl: string) {
  const url = new URL("/api/prices", baseUrl);
  url.searchParams.set("weight[eq]", String(TARGET_WEIGHT_GRAMS));
  url.searchParams.set("sort_by", "updated_at");
  url.searchParams.set("order", "desc");
  url.searchParams.set("limit", String(COLLECTION_LIMIT));
  return url;
}

export async function getGoldReference(): Promise<GoldReferenceResult> {
  const config = getConfig();

  if (!config.apiKey) {
    return { status: "not_configured" };
  }

  try {
    const response = await fetch(buildPricesUrl(config.baseUrl), {
      headers: {
        Accept: "application/json",
        "X-API-Key": config.apiKey,
      },
      next: {
        revalidate: config.cacheSeconds,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      console.warn(
        `[gold-reference] Emas API ID request failed with status ${response.status}.`,
      );
      return { status: "unavailable" };
    }

    const payload: unknown = await response.json();
    const parsed = parseEmasApiPricesPayload(payload);

    if (!parsed) {
      console.warn(
        "[gold-reference] Emas API ID response did not contain an allowed 1 gram reference.",
      );
      return { status: "unavailable" };
    }

    return {
      status: "ready",
      data: {
        provider: "Emas API ID",
        ...parsed,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.warn(`[gold-reference] Emas API ID request failed: ${detail}`);
    return { status: "unavailable" };
  }
}
