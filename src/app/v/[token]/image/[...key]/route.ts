import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { saleItems, sales } from "@/db/schema";
import { verifyReceiptVerificationToken } from "@/features/sales/verification/receipt-token";
import {
  imageKeyBelongsToOrganization,
  readImageFile,
} from "@/lib/storage/image-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    token: string;
    key: string[];
  }>;
};

type SaleItemSnapshot = {
  imageKey?: unknown;
  productImageKey?: unknown;
};

const PUBLIC_HISTORY_SALE_STATUSES = [
  "completed",
  "partially_refunded",
  "refunded",
] as const;

function normalizeImageKey(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

  return normalized || null;
}

function readImageKeyFromSegments(segments: string[]) {
  try {
    return normalizeImageKey(
      segments.map((segment) => decodeURIComponent(segment)).join("/"),
    );
  } catch {
    return null;
  }
}

function saleItemAllowsImageKey(snapshot: unknown, imageKey: string) {
  const value = snapshot as SaleItemSnapshot | null;

  return (
    normalizeImageKey(value?.imageKey) === imageKey ||
    normalizeImageKey(value?.productImageKey) === imageKey
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const { token, key } = await context.params;
  const parsedToken = verifyReceiptVerificationToken(token);

  if (!parsedToken) {
    return new Response("Not found", { status: 404 });
  }

  const [saleRow] = await db
    .select({
      organizationId: sales.organizationId,
      outletId: sales.outletId,
      customerId: sales.customerId,
    })
    .from(sales)
    .where(eq(sales.id, parsedToken.saleId))
    .limit(1);

  if (!saleRow?.customerId) {
    return new Response("Not found", { status: 404 });
  }

  const imageKey = readImageKeyFromSegments(key);

  if (
    !imageKey ||
    !imageKeyBelongsToOrganization(imageKey, saleRow.organizationId)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const saleItemRows = await db
    .select({
      snapshot: saleItems.snapshot,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(
      and(
        eq(sales.organizationId, saleRow.organizationId),
        eq(sales.outletId, saleRow.outletId),
        eq(sales.customerId, saleRow.customerId),
        inArray(sales.status, [...PUBLIC_HISTORY_SALE_STATUSES]),
      ),
    );

  if (
    !saleItemRows.some((item) => saleItemAllowsImageKey(item.snapshot, imageKey))
  ) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const image = await readImageFile(imageKey);

    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
