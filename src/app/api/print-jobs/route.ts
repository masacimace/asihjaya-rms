import { and, asc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { productItems, productMasters, registers } from "@/db/schema";
import {
  DEFAULT_POS_REGISTER_MISSING_MESSAGE,
  getDefaultPosRegisterCondition,
} from "@/features/pos/context";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";
import { buildInventoryLabelPayloadV2 } from "@/lib/hardware/job-payload-contracts-v2";
import { createHardwareJobV2 } from "@/lib/hardware/job-producer-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LABEL_PRINTABLE_AVAILABILITY = ["draft", "available", "reserved"] as const;

function readCopies(value: unknown) {
  const copies = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(copies) || copies < 1 || copies > 20) {
    return null;
  }
  return copies;
}

function getRequestIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) ??
    req.headers.get("x-real-ip")?.slice(0, 64) ??
    null
  );
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(auth, "inventory.print_label")) {
      return NextResponse.json(
        { error: "Anda tidak memiliki permission cetak label inventaris." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    const requestId =
      typeof body.requestId === "string" ? body.requestId.trim() : "";
    const copies = readCopies(body.copies ?? 1);

    if (!UUID_PATTERN.test(itemId) || !UUID_PATTERN.test(requestId) || !copies) {
      return NextResponse.json(
        { error: "Intent cetak label tidak valid." },
        { status: 400 },
      );
    }

    const accessibleOutletIds = auth.outlets.map((outlet) => outlet.id);
    if (accessibleOutletIds.length === 0) {
      return NextResponse.json(
        { error: "User belum memiliki akses outlet aktif." },
        { status: 400 },
      );
    }

    const [item] = await db
      .select({
        id: productItems.id,
        organizationId: productItems.organizationId,
        currentOutletId: productItems.currentOutletId,
        sku: productItems.sku,
        barcode: productItems.barcode,
        displayName: productItems.displayName,
        productName: productMasters.name,
        weightGram: productItems.weightGram,
        purityPercent: productItems.purityPercent,
        exchangePurityPercent: productItems.exchangePurityPercent,
        size: productItems.size,
        color: productItems.color,
        gemstone: productItems.gemstone,
        sellingAmount: productItems.sellingAmount,
        availability: productItems.availability,
        isActive: productItems.isActive,
      })
      .from(productItems)
      .innerJoin(
        productMasters,
        eq(productItems.productMasterId, productMasters.id),
      )
      .where(
        and(
          eq(productItems.id, itemId),
          eq(productItems.organizationId, auth.organization.id),
          inArray(productItems.currentOutletId, accessibleOutletIds),
        ),
      )
      .limit(1);

    if (!item || !item.currentOutletId) {
      return NextResponse.json(
        { error: "Item tidak ditemukan pada outlet yang dapat Anda akses." },
        { status: 404 },
      );
    }
    if (!item.isActive || !LABEL_PRINTABLE_AVAILABILITY.includes(item.availability as never)) {
      return NextResponse.json(
        { error: "Status item tidak mengizinkan pencetakan label baru." },
        { status: 409 },
      );
    }

    const [register] = await db
      .select({ id: registers.id, code: registers.code, name: registers.name })
      .from(registers)
      .where(getDefaultPosRegisterCondition(item.currentOutletId))
      .orderBy(asc(registers.createdAt))
      .limit(1);

    if (!register) {
      return NextResponse.json(
        { error: DEFAULT_POS_REGISTER_MISSING_MESSAGE },
        { status: 400 },
      );
    }

    const now = new Date();
    const payload = buildInventoryLabelPayloadV2({
      itemId: item.id,
      copies,
      sku: item.sku,
      barcode: item.barcode,
      productName: item.displayName ?? item.productName,
      weightGram: item.weightGram,
      purityPercent: item.purityPercent,
      exchangePurityPercent: item.exchangePurityPercent,
      size: item.size,
      color: item.color,
      gemstone: item.gemstone,
      sellingAmount: item.sellingAmount,
    });

    const { job, duplicate } = await createHardwareJobV2({
      organizationId: auth.organization.id,
      outletId: item.currentOutletId,
      registerId: register.id,
      createdByUserId: auth.user.id,
      jobType: "print_label_sato",
      mode: "manual",
      payload,
      idempotencyKey: `label:${item.id}:print:${requestId}`,
      sourceType: "product_item_label",
      sourceId: item.id,
      now,
      audit: {
        source: "admin.inventory.item",
        requestId,
        ipAddress: getRequestIp(req),
        userAgent: req.headers.get("user-agent"),
      },
    });

    return NextResponse.json({
      success: true,
      duplicate,
      job: {
        id: job.id,
        status: job.status,
        protocolVersion: job.protocolVersion,
        expiresAt: job.expiresAt,
      },
    });
  } catch (error) {
    console.error("Failed to create secure hardware label job:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
