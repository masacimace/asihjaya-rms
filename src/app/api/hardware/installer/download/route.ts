import { NextResponse } from "next/server";

import { getCurrentAuth, hasPermission } from "@/lib/auth/session";
import { resolveHardwareInstallerDownloadUrl } from "@/lib/hardware-installer-environment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!hasPermission(auth, "hardware.agents.manage")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const downloadUrl = resolveHardwareInstallerDownloadUrl(process.env);
  if (!downloadUrl) {
    return NextResponse.json(
      {
        error: "INSTALLER_NOT_PUBLISHED",
        message: "ASIHJAYA Hardware Hub Setup belum dipublish oleh administrator.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const response = NextResponse.redirect(downloadUrl, 302);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
