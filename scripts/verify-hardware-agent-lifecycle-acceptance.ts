import "dotenv/config";

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";

const DEFAULT_REGISTER_CODE = "DEV-HW-TEST";

type AgentRow = {
  id: string;
  code: string;
  name: string;
  secret_hash: string;
  status: "online" | "offline" | "disabled";
  is_active: boolean;
  register_id: string;
  outlet_id: string;
  last_seen_at: Date | null;
  last_ip_address: string | null;
  last_user_agent: string | null;
  capabilities: Record<string, unknown> | null;
};

type AuditRow = {
  action: string;
  entity_id: string | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function requireLocalDatabase(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  const allowedHosts = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    "host.docker.internal",
  ]);

  if (
    !allowedHosts.has(parsed.hostname) &&
    process.env.ALLOW_HARDWARE_ACCEPTANCE_NONLOCAL_DB !== "1"
  ) {
    throw new Error(
      `Safety stop: DATABASE_URL mengarah ke host "${parsed.hostname}", bukan database local.`,
    );
  }
}

function pass(message: string) {
  console.log(`[PASS] ${message}`);
}

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    result[line.slice(0, separator).trim()] =
      line.slice(separator + 1).trim();
  }

  return result;
}

function findNewestDownloadedEnv(agentCode: string): string | null {
  const downloads = path.join(os.homedir(), "Downloads");

  if (!existsSync(downloads)) {
    return null;
  }

  const prefix = `hardware-hub-${agentCode.toLowerCase()}`;
  const candidates = readdirSync(downloads)
    .filter((name) => {
      const normalized = name.toLowerCase();
      return (
        normalized.startsWith(prefix) &&
        normalized.endsWith(".env")
      );
    })
    .map((name) => path.join(downloads, name))
    .sort(
      (left, right) =>
        statSync(right).mtimeMs - statSync(left).mtimeMs,
    );

  return candidates[0] ?? null;
}

function hasSensitiveAuditKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((item) => hasSensitiveAuditKey(item));
  }

  const forbidden = new Set([
    "secret",
    "agentsecret",
    "hardwareagentsecret",
    "secrethash",
    "encryptedsecret",
  ]);

  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (forbidden.has(key.toLowerCase())) return true;
    if (hasSensitiveAuditKey(nested)) return true;
  }

  return false;
}

function requireLifecycleAction(
  audits: AuditRow[],
  action: string,
) {
  if (!audits.some((audit) => audit.action === action)) {
    throw new Error(
      `Audit ${action} belum ditemukan pada register acceptance. Jalankan workflow tersebut dari web terlebih dahulu.`,
    );
  }
}

async function main() {
  const registerCode =
    readArg("--register-code") ?? DEFAULT_REGISTER_CODE;
  const explicitEnvFile = readArg("--env-file");
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL tidak tersedia.");
  }

  requireLocalDatabase(databaseUrl);

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  try {
    const registerRows = await pool.query<{
      id: string;
      outlet_id: string;
    }>(
      `
        select id, outlet_id
        from registers
        where code = $1
        limit 1
      `,
      [registerCode],
    );

    const register = registerRows.rows[0];

    if (!register) {
      throw new Error(
        `Register acceptance ${registerCode} tidak ditemukan.`,
      );
    }

    const agentRows = await pool.query<AgentRow>(
      `
        select
          id,
          code,
          name,
          secret_hash,
          status,
          is_active,
          register_id,
          outlet_id,
          last_seen_at,
          last_ip_address,
          last_user_agent,
          capabilities
        from hardware_agents
        where register_id = $1
        order by created_at asc
      `,
      [register.id],
    );

    if (agentRows.rows.length < 2) {
      throw new Error(
        "Lifecycle acceptance mengharapkan minimal dua agent pada register test setelah workflow Ganti Mini PC.",
      );
    }

    const activeAgents = agentRows.rows.filter(
      (agent) => agent.is_active && agent.status !== "disabled",
    );

    if (activeAgents.length !== 1) {
      throw new Error(
        `Expected tepat satu active agent, ditemukan ${activeAgents.length}.`,
      );
    }

    const activeAgent = activeAgents[0];

    if (!activeAgent) {
      throw new Error("Active agent tidak ditemukan.");
    }

    if (activeAgent.status !== "offline") {
      throw new Error(
        `Setelah reactivation, status awal harus offline; sekarang ${activeAgent.status}.`,
      );
    }

    if (
      activeAgent.last_seen_at !== null ||
      activeAgent.last_ip_address !== null ||
      activeAgent.last_user_agent !== null
    ) {
      throw new Error(
        "Presence lama belum direset saat reactivation.",
      );
    }

    if (
      activeAgent.capabilities &&
      Object.keys(activeAgent.capabilities).length > 0
    ) {
      throw new Error(
        "Capability lama belum direset saat reactivation.",
      );
    }

    if (!activeAgent.secret_hash.startsWith("hws2.")) {
      throw new Error(
        "Credential active agent tidak menggunakan encrypted hws2.",
      );
    }

    pass(
      `Tepat satu agent aktif setelah reactivation: ${activeAgent.code}.`,
    );
    pass("Reactivation mengembalikan agent ke offline.");
    pass("Presence dan capability stale berhasil direset.");
    pass("Credential reactivation tersimpan sebagai hws2.");

    const agentIds = agentRows.rows.map((agent) => agent.id);

    const auditRows = await pool.query<AuditRow>(
      `
        select
          action,
          entity_id,
          after_data,
          metadata,
          created_at
        from audit_logs
        where entity_type = 'hardware_agent'
          and entity_id = any($1::text[])
          and action in (
            'hardware.agent.rotate_credential',
            'hardware.agent.disable',
            'hardware.agent.replace_old_device',
            'hardware.agent.replace_new_device',
            'hardware.agent.reactivate'
          )
        order by created_at asc
      `,
      [agentIds],
    );

    const audits = auditRows.rows;

    requireLifecycleAction(
      audits,
      "hardware.agent.rotate_credential",
    );
    requireLifecycleAction(audits, "hardware.agent.disable");
    requireLifecycleAction(
      audits,
      "hardware.agent.replace_old_device",
    );
    requireLifecycleAction(
      audits,
      "hardware.agent.replace_new_device",
    );
    requireLifecycleAction(
      audits,
      "hardware.agent.reactivate",
    );

    for (const audit of audits) {
      if (
        hasSensitiveAuditKey(audit.after_data) ||
        hasSensitiveAuditKey(audit.metadata)
      ) {
        throw new Error(
          `Audit ${audit.action} mengandung key credential sensitif.`,
        );
      }

      const serialized = JSON.stringify({
        afterData: audit.after_data,
        metadata: audit.metadata,
      });

      if (
        agentRows.rows.some((agent) =>
          serialized.includes(agent.secret_hash),
        )
      ) {
        throw new Error(
          `Audit ${audit.action} menyimpan encrypted credential.`,
        );
      }
    }

    pass("Rotate Credential memiliki audit.");
    pass("Disable Agent memiliki audit.");
    pass("Replace Mini PC memiliki audit old + new device.");
    pass("Reactivate Agent memiliki audit.");
    pass("Lifecycle audit tidak menyimpan credential.");

    const reactivateAudit = [...audits]
      .reverse()
      .find(
        (audit) =>
          audit.action === "hardware.agent.reactivate" &&
          audit.entity_id === activeAgent.id,
      );

    if (!reactivateAudit) {
      throw new Error(
        "Audit reactivation terbaru tidak terkait active agent saat ini.",
      );
    }

    const afterData = reactivateAudit.after_data ?? {};

    if (
      afterData.credentialRotated !== true ||
      afterData.presenceReset !== true
    ) {
      throw new Error(
        "Audit reactivation tidak mencatat credential rotation + presence reset.",
      );
    }

    pass(
      "Audit reactivation mencatat credential rotation dan presence reset.",
    );

    const envFile =
      explicitEnvFile ??
      findNewestDownloadedEnv(activeAgent.code);

    if (!envFile || !existsSync(envFile)) {
      throw new Error(
        `File hardware-hub.env reactivation untuk ${activeAgent.code} tidak ditemukan. Gunakan --env-file PATH jika file tidak ada di Downloads.`,
      );
    }

    const env = parseEnvFile(envFile);

    if (env.HARDWARE_AGENT_ID !== activeAgent.id) {
      throw new Error(
        "HARDWARE_AGENT_ID hasil reactivation tidak cocok dengan active agent.",
      );
    }

    const secret = env.HARDWARE_AGENT_SECRET ?? "";

    if (secret.length < 32) {
      throw new Error(
        "HARDWARE_AGENT_SECRET hasil reactivation tidak valid.",
      );
    }

    if (
      env.HARDWARE_AGENT_REQUEST_AUTH_MODE !== "signed" ||
      env.HARDWARE_PROTOCOL_MODE !== "v2-preferred"
    ) {
      throw new Error(
        "Reactivation env wajib memakai signed + v2-preferred.",
      );
    }

    for (const key of [
      "HARDWARE_ADAPTER_MODE",
      "LABEL_PRINTER_ADAPTER",
      "DOCUMENT_PRINTER_ADAPTER",
      "CASH_DRAWER_ADAPTER",
    ]) {
      if (env[key] !== "fake") {
        throw new Error(
          `${key} wajib fake pada reactivation env.`,
        );
      }
    }

    const credential = await import(
      "../src/lib/hardware/agent-credential"
    );

    const decrypted =
      credential.decryptHardwareAgentSecret(
        activeAgent.id,
        activeAgent.secret_hash,
      );

    if (!decrypted || decrypted !== secret) {
      throw new Error(
        "Secret hasil reactivation tidak cocok dengan encrypted credential DB.",
      );
    }

    pass(
      "Reactivation env memakai signed + v2 + safe-first fake.",
    );
    pass(
      "Secret one-time reactivation cocok dengan encrypted credential DB.",
    );

    const disabledHistorical = agentRows.rows.filter(
      (agent) =>
        agent.id !== activeAgent.id &&
        (!agent.is_active || agent.status === "disabled"),
    );

    if (disabledHistorical.length === 0) {
      throw new Error(
        "Tidak ditemukan historical disabled agent setelah replacement.",
      );
    }

    pass(
      `Historical disabled agent tetap tersimpan: ${disabledHistorical
        .map((agent) => agent.code)
        .join(", ")}.`,
    );

    console.log("");
    console.log("2D.1E LIFECYCLE ACCEPTANCE PASS");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Lifecycle acceptance gagal.",
  );
  process.exitCode = 1;
});
