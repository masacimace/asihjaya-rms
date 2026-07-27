import {
  authorizePdfRenderMedia,
  PDF_RENDER_TOKEN_HEADER,
} from "@/features/sales/documents/pdf-render-access";
import { getCurrentAuth } from "@/lib/auth/session";
import { authenticateHardwareAgent } from "@/lib/hardware/agent-auth";
import {
  imageKeyBelongsToOrganization,
  readImageFile,
} from "@/lib/storage/image-storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const imageKey = key.map((segment) => decodeURIComponent(segment)).join("/");
  const pdfRenderToken = request.headers.get(PDF_RENDER_TOKEN_HEADER);
  const pdfRenderAccess = authorizePdfRenderMedia({
    token: pdfRenderToken,
    imageKey,
  });

  if (pdfRenderToken && !pdfRenderAccess) {
    return new Response("Unauthorized", { status: 401 });
  }

  let organizationId = pdfRenderAccess?.organizationId ?? null;

  if (!organizationId) {
    const auth = await getCurrentAuth();
    const hardwareAuth = auth
      ? null
      : await authenticateHardwareAgent(request);
    organizationId =
      auth?.organization.id ?? hardwareAuth?.agent.organizationId ?? null;
  }

  if (!organizationId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!imageKeyBelongsToOrganization(imageKey, organizationId)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const image = await readImageFile(imageKey);

    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": pdfRenderAccess
          ? "private, no-store, max-age=0"
          : "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
