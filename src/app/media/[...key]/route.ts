import { getCurrentAuth } from "@/lib/auth/session";
import { authenticateHardwareAgentHeaders } from "@/lib/hardware/agent-auth";
import {
  imageKeyBelongsToOrganization,
  readImageFile,
} from "@/lib/storage/image-storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const auth = await getCurrentAuth();
  const hardwareAuth = auth
    ? null
    : await authenticateHardwareAgentHeaders(request.headers);
  const organizationId = auth?.organization.id ?? hardwareAuth?.agent.organizationId;

  if (!organizationId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key } = await context.params;
  const imageKey = key.map((segment) => decodeURIComponent(segment)).join("/");

  if (!imageKeyBelongsToOrganization(imageKey, organizationId)) {
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
