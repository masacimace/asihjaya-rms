import { getCurrentAuth } from "@/lib/auth/session";
import {
  imageKeyBelongsToOrganization,
  readImageFile,
} from "@/lib/storage/image-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const auth = await getCurrentAuth();

  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key } = await context.params;
  const imageKey = key.map((segment) => decodeURIComponent(segment)).join("/");

  if (!imageKeyBelongsToOrganization(imageKey, auth.organization.id)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const image = await readImageFile(imageKey);

    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
