import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { saleReturnCases, saleReturnItems } from "@/db/schema";
import { RETURN_VIEW_PERMISSION } from "@/features/returns/authorization";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";
import {
  readReturnInspectionPhoto,
  returnPhotoKeyBelongsToOrganization,
} from "@/lib/storage/return-inspection-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const auth = await getCurrentAuth();

  if (!auth || !hasPermission(auth, RETURN_VIEW_PERMISSION)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key } = await context.params;
  const photoKey = key.map((segment) => decodeURIComponent(segment)).join("/");

  if (!returnPhotoKeyBelongsToOrganization(photoKey, auth.organization.id)) {
    return new Response("Not found", { status: 404 });
  }

  const outletIds = auth.outlets.map((outlet) => outlet.id);
  if (outletIds.length === 0) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ id: saleReturnItems.id })
    .from(saleReturnItems)
    .innerJoin(
      saleReturnCases,
      eq(saleReturnItems.returnCaseId, saleReturnCases.id),
    )
    .where(
      and(
        eq(saleReturnCases.organizationId, auth.organization.id),
        inArray(saleReturnCases.outletId, outletIds),
        eq(saleReturnItems.photoKey, photoKey),
      ),
    )
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  try {
    const image = await readReturnInspectionPhoto(photoKey);

    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
