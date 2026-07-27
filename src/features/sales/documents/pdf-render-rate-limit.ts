import { getClientIp } from "@/lib/http/client-ip";
import {
  consumeSecurityRateLimit,
  type SecurityRateLimitPolicy,
} from "@/lib/security/rate-limit";

type PdfRenderActor =
  | { type: "user"; id: string }
  | { type: "hardware-agent"; id: string };

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function getActorPolicy(): SecurityRateLimitPolicy {
  return {
    limit: positiveInteger("PDF_RATE_LIMIT_ACTOR_REQUESTS", 12),
    windowMs: positiveInteger("PDF_RATE_LIMIT_WINDOW_MS", 60_000),
    blockMs: positiveInteger("PDF_RATE_LIMIT_BLOCK_MS", 60_000),
  };
}

function getIpPolicy(): SecurityRateLimitPolicy {
  return {
    limit: positiveInteger("PDF_RATE_LIMIT_IP_REQUESTS", 30),
    windowMs: positiveInteger("PDF_RATE_LIMIT_WINDOW_MS", 60_000),
    blockMs: positiveInteger("PDF_RATE_LIMIT_BLOCK_MS", 60_000),
  };
}

export async function enforcePdfRenderRateLimit(input: {
  request: Request;
  actor: PdfRenderActor;
}): Promise<Response | null> {
  const ipAddress = getClientIp(input.request);
  const checks = [
    consumeSecurityRateLimit({
      scope: "pdf.render.actor",
      key: `${input.actor.type}:${input.actor.id}`,
      policy: getActorPolicy(),
    }),
  ];

  if (ipAddress) {
    checks.push(
      consumeSecurityRateLimit({
        scope: "pdf.render.ip",
        key: ipAddress,
        policy: getIpPolicy(),
      }),
    );
  }

  const decisions = await Promise.all(checks);
  const rejected = decisions.find((decision) => !decision.allowed);

  if (!rejected) {
    return null;
  }

  return Response.json(
    {
      success: false,
      error: "Terlalu banyak permintaan PDF. Coba kembali beberapa saat lagi.",
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Retry-After": String(rejected.retryAfterSeconds),
      },
    },
  );
}
