import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { registers } from "@/db/schema";
import {
  DEFAULT_POS_REGISTER_MISSING_MESSAGE,
  getDefaultPosRegisterCondition,
} from "@/features/pos/context";
import { getCurrentAuth } from "@/lib/auth/session";
import { createHardwareJobWithDuplicateGuard } from "@/lib/hardware/job-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStringValue(body: Record<string, unknown>, key: string) {
  const value = body[key];

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  return "";
}

function normalizeLabelPayload(body: Record<string, unknown>) {
  const sku = getStringValue(body, "sku");
  const productName = getStringValue(body, "productName");
  const barcode = getStringValue(body, "barcode");
  const weightGram = getStringValue(body, "weightGram");
  const purityPercent = getStringValue(body, "purityPercent");
  const exchangePurityPercent = getStringValue(body, "exchangePurityPercent");
  const size = getStringValue(body, "size");
  const color = getStringValue(body, "color");
  const gemstone = getStringValue(body, "gemstone");
  const sellingAmount = getStringValue(body, "sellingAmount");

  if (!sku || !productName || !barcode) {
    return null;
  }

  return {
    sku: sku.slice(0, 80),
    productName: productName.slice(0, 96),
    barcode: barcode.slice(0, 120),
    weightGram: weightGram.slice(0, 32),
    purityPercent: purityPercent.slice(0, 32),
    exchangePurityPercent: exchangePurityPercent.slice(0, 32),
    size: size.slice(0, 32),
    color: color.slice(0, 32),
    gemstone: gemstone.slice(0, 64),
    sellingAmount: sellingAmount.slice(0, 32),
    labelProfile: "jewelry_compact",
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getCurrentAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const primaryOutlet =
      auth.outlets.find((outlet) => outlet.isPrimary) ?? auth.outlets[0];

    if (!primaryOutlet) {
      return NextResponse.json(
        { error: "User belum memiliki akses outlet aktif." },
        { status: 400 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const payload = normalizeLabelPayload(body);

    if (!payload) {
      return NextResponse.json(
        { error: "Payload label tidak valid." },
        { status: 400 },
      );
    }

    const [register] = await db
      .select({ id: registers.id, code: registers.code, name: registers.name })
      .from(registers)
      .where(getDefaultPosRegisterCondition(primaryOutlet.id))
      .orderBy(asc(registers.createdAt))
      .limit(1);

    if (!register) {
      return NextResponse.json(
        { error: DEFAULT_POS_REGISTER_MISSING_MESSAGE },
        { status: 400 },
      );
    }

    const { job, duplicate } = await createHardwareJobWithDuplicateGuard({
      organizationId: auth.organization.id,
      outletId: primaryOutlet.id,
      registerId: register.id,
      createdByUserId: auth.user.id,
      jobType: "print_label_sato",
      deviceType: "label_printer",
      targetDevice: "label_printer",
      status: "pending",
      priority: 50,
      maxAttempts: 2,
      payload,
      sourceType: "product_item_label",
      sourceId: payload.sku,
    });

    return NextResponse.json({ success: true, job, duplicate });
  } catch (error) {
    console.error("Failed to create hardware label job:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
