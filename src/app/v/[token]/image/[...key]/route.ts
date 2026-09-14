import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  buybackItems,
  buybacks,
  productItems,
  productMasters,
  saleItems,
  sales,
} from "@/db/schema";
import { getCurrentCustomerHistorySession } from "@/features/customers/history-access";
import { getPublicCustomerHistoryAccessContext } from "@/features/customers/public-history";
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

export async function GET(_request: Request, context: RouteContext) {
  const { token, key } = await context.params;
  const accessContext = await getPublicCustomerHistoryAccessContext(token);

  if (accessContext.status !== "valid") {
    return new Response("Not found", { status: 404 });
  }

  const session = await getCurrentCustomerHistorySession({
    organizationId: accessContext.organizationId,
    customerId: accessContext.customer.id,
  });

  if (!session || session.requiresPinChange) {
    return new Response("Not found", { status: 404 });
  }

  const imageKey = readImageKeyFromSegments(key);

  if (
    !imageKey ||
    !imageKeyBelongsToOrganization(imageKey, accessContext.organizationId)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const [saleImageRow, buybackImageRow] = await Promise.all([
    db
      .select({ id: saleItems.id })
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .innerJoin(productItems, eq(saleItems.productItemId, productItems.id))
      .innerJoin(
        productMasters,
        eq(productItems.productMasterId, productMasters.id),
      )
      .where(
        and(
          eq(sales.organizationId, accessContext.organizationId),
          eq(sales.customerId, accessContext.customer.id),
          inArray(sales.status, [...PUBLIC_HISTORY_SALE_STATUSES]),
          or(
            sql`${saleItems.snapshot}->>'imageKey' = ${imageKey}`,
            sql`${saleItems.snapshot}->>'productImageKey' = ${imageKey}`,
            eq(productItems.imageKey, imageKey),
            eq(productMasters.imageKey, imageKey),
          ),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),

    db
      .select({ id: buybackItems.id })
      .from(buybackItems)
      .innerJoin(buybacks, eq(buybackItems.buybackId, buybacks.id))
      .leftJoin(productItems, eq(buybackItems.productItemId, productItems.id))
      .leftJoin(
        productMasters,
        eq(productItems.productMasterId, productMasters.id),
      )
      .where(
        and(
          eq(buybacks.organizationId, accessContext.organizationId),
          eq(buybacks.customerId, accessContext.customer.id),
          eq(buybacks.status, "completed"),
          or(
            sql`${buybackItems.snapshot}->>'imageKey' = ${imageKey}`,
            sql`${buybackItems.snapshot}->>'productImageKey' = ${imageKey}`,
            eq(productItems.imageKey, imageKey),
            eq(productMasters.imageKey, imageKey),
          ),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!saleImageRow && !buybackImageRow) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const image = await readImageFile(imageKey);

    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
