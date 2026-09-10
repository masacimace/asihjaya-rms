import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { productColorPresets } from "@/db/schema";

export type ProductColorPresetOption = {
  id: string;
  name: string;
  description: string | null;
};

export type ProductColorPresetSettingsRow = ProductColorPresetOption & {
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function normalizeProductColorKey(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("id-ID");
}

export async function getActiveProductColorPresetOptions(
  organizationId: string,
): Promise<ProductColorPresetOption[]> {
  return db
    .select({
      id: productColorPresets.id,
      name: productColorPresets.name,
      description: productColorPresets.description,
    })
    .from(productColorPresets)
    .where(
      and(
        eq(productColorPresets.organizationId, organizationId),
        eq(productColorPresets.isActive, true),
      ),
    )
    .orderBy(asc(productColorPresets.name));
}

export async function getProductColorPresetSettingsData(
  organizationId: string,
): Promise<ProductColorPresetSettingsRow[]> {
  return db
    .select({
      id: productColorPresets.id,
      name: productColorPresets.name,
      description: productColorPresets.description,
      isActive: productColorPresets.isActive,
      createdAt: productColorPresets.createdAt,
      updatedAt: productColorPresets.updatedAt,
    })
    .from(productColorPresets)
    .where(eq(productColorPresets.organizationId, organizationId))
    .orderBy(desc(productColorPresets.isActive), asc(productColorPresets.name));
}

export async function getActiveProductColorPresetMap(organizationId: string) {
  const rows = await getActiveProductColorPresetOptions(organizationId);
  return new Map(rows.map((row) => [normalizeProductColorKey(row.name), row]));
}

export async function resolveActiveProductColorPresetName({
  organizationId,
  value,
}: {
  organizationId: string;
  value: string | null | undefined;
}) {
  const key = normalizeProductColorKey(value);
  if (!key) return null;

  const rows = await getActiveProductColorPresetOptions(organizationId);
  return rows.find((row) => normalizeProductColorKey(row.name) === key)?.name ?? null;
}
