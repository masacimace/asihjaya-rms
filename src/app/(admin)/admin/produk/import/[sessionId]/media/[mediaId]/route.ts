import { NextResponse } from "next/server";

import { getProductBatchImportMediaRecord } from "@/features/product-batch-import/preview-queries";
import { getCurrentAuth, hasPermission } from "@/lib/auth/session";
import {
  imageKeyBelongsToOrganization,
  readImageFile,
} from "@/lib/storage/image-storage";
import { readProductBatchImportStagingFile } from "@/lib/storage/product-batch-import-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; mediaId: string }> },
) {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json({ message: "Login diperlukan." }, { status: 401 });
  }
  if (!hasPermission(auth, "products.batch_import")) {
    return NextResponse.json({ message: "Akses ditolak." }, { status: 403 });
  }

  const { sessionId, mediaId } = await params;
  const media = await getProductBatchImportMediaRecord({ auth, sessionId, mediaId });
  if (!media || media.status === "deleted") {
    return NextResponse.json({ message: "Media import tidak ditemukan." }, { status: 404 });
  }

  try {
    const useFinalImage =
      media.status === "promoted" &&
      !!media.finalKey &&
      imageKeyBelongsToOrganization(media.finalKey, auth.organization.id);
    const buffer = useFinalImage
      ? await readImageFile(media.finalKey!)
      : await readProductBatchImportStagingFile(media.stagingKey);
    const contentType = useFinalImage ? "image/webp" : media.contentType;
    const body = new Uint8Array(buffer.length);
    body.set(buffer);
    return new Response(body.buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Media import sudah tidak tersedia." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
