import "dotenv/config";

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

const DEFAULT_REGISTER_CODE = "DEV-HW-TEST";
const DEFAULT_AGENT_CODE = "DEV-HW-TEST-HH";
const ACTIVE_AGENT_CONSTRAINT = "hardware_agents_one_active_per_register_uq";

type CliArgs = {
  registerCode: string;
  agentCode: string;
  envFile: string | null;
};

type AgentRow = {
  id: string;
  organization_id: string;
  outlet_id: string;
  outlet_code: string;
  outlet_name: string;
  register_id: string;
  register_code: string;
  register_name: string;
  code: string;
  name: string;
  secret_hash: string;
  status: "online" | "offline" | "disabled";
  is_active: boolean;
};

type AuditRow = {
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  action: string;
};

function readArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;

  const value = process.argv[index + 1];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getArgs(): CliArgs {
  return {
    registerCode: readArg("--register-code") ?? DEFAULT_REGISTER_CODE,
    agentCode: readArg("--agent-code") ?? DEFAULT_AGENT_CODE,
    envFile: readArg("--env-file"),
  };
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
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    result[key] = value;
  }

  return result;
}

function findDownloadedEnv(agentCode: string): string | null {
  const expected = `hardware-hub-${agentCode.toLowerCase()}.env`;
  const candidate = path.join(os.homedir(), "Downloads", expected);

  return existsSync(candidate) ? candidate : null;
}

function hasForbiddenSensitiveKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((entry) => hasForbiddenSensitiveKey(entry));
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
    if (hasForbiddenSensitiveKey(nested)) return true;
  }

  return false;
}

async function verifyDuplicateGuard(
  client: PoolClient,
  agent: AgentRow,
): Promise<void> {
  let blockedByExpectedConstraint = false;

  await client.query("begin");

  try {
    await client.query(
      `
        insert into hardware_agents (
          id,
          organization_id,
          outlet_id,
          register_id,
          code,
          name,
          secret_hash,
          status,
          is_active,
          capabilities,
          settings,
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7,
          'offline', true, '{}'::jsonb, '{}'::jsonb, now(), now()
        )
      `,
      [
        randomUUID(),
        agent.organization_id,
        agent.outlet_id,
        agent.register_id,
        `DUP-PROBE-${Date.now()}`,
        "Duplicate Guard Probe",
        "hws2.probe.only",
      ],
    );
  } catch (error) {
    const pgError = error as { code?: string; constraint?: string };

    if (
      pgError.code === "23505" &&
      pgError.constraint === ACTIVE_AGENT_CONSTRAINT
    ) {
      blockedByExpectedConstraint = true;
    } else {
      throw error;
    }
  } finally {
    await client.query("rollback");
  }

  if (!blockedByExpectedConstraint) {
    throw new Error(
      `Constraint ${ACTIVE_AGENT_CONSTRAINT} tidak memblokir active agent kedua.`,
    );
  }
}

async function main() {
  const args = getArgs();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL tidak tersedia.");
  }

  requireLocalDatabase(databaseUrl);

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  const client = await pool.connect();

  try {
    const permissionRows = await client.query<{ code: string }>(
      `
        select code
        from permissions
        where code = 'hardware.agents.manage'
        limit 1
      `,
    );

    if (!permissionRows.rows[0]) {
      throw new Error("Permission hardware.agents.manage belum ada di DB local.");
    }
    pass("Permission hardware.agents.manage tersedia.");

    const roleRows = await client.query<{ code: string }>(
      `
        select distinct r.code
        from roles r
        inner join role_permissions rp on rp.role_id = r.id
        inner join permissions p on p.id = rp.permission_id
        where p.code = 'hardware.agents.manage'
        order by r.code
      `,
    );

    const roleCodes = new Set(roleRows.rows.map((row) => row.code));

    if (!roleCodes.has("system_admin") || !roleCodes.has("owner")) {
      throw new Error(
        "Permission provisioning belum diberikan ke system_admin dan owner.",
      );
    }

    if (roleCodes.has("manager")) {
      throw new Error(
        "Manager tidak boleh memiliki permission hardware.agents.manage.",
      );
    }
    pass("RBAC provisioning sesuai: system_admin/owner, bukan manager.");

    const indexRows = await client.query<{ indexdef: string }>(
      `
        select indexdef
        from pg_indexes
        where schemaname = 'public'
          and indexname = $1
        limit 1
      `,
      [ACTIVE_AGENT_CONSTRAINT],
    );

    const indexDef = indexRows.rows[0]?.indexdef ?? "";

    if (
      !indexDef ||
      !/UNIQUE INDEX/i.test(indexDef) ||
      !/register_id/i.test(indexDef) ||
      !/is_active/i.test(indexDef)
    ) {
      throw new Error(
        `Unique partial index ${ACTIVE_AGENT_CONSTRAINT} belum sesuai.`,
      );
    }
    pass("DB guard satu active Hardware Agent per register tersedia.");

    const agentRows = await client.query<AgentRow>(
      `
        select
          ha.id,
          ha.organization_id,
          ha.outlet_id,
          o.code as outlet_code,
          o.name as outlet_name,
          ha.register_id,
          r.code as register_code,
          r.name as register_name,
          ha.code,
          ha.name,
          ha.secret_hash,
          ha.status,
          ha.is_active
        from hardware_agents ha
        inner join registers r on r.id = ha.register_id
        inner join outlets o on o.id = ha.outlet_id
        where ha.code = $1
          and r.code = $2
        order by ha.created_at desc
        limit 1
      `,
      [args.agentCode, args.registerCode],
    );

    const agent = agentRows.rows[0];

    if (!agent) {
      throw new Error(
        `Agent ${args.agentCode} pada register ${args.registerCode} belum ditemukan. ` +
          "Buat agent dari web terlebih dahulu.",
      );
    }

    if (!agent.is_active || agent.status === "disabled") {
      throw new Error("Agent acceptance tidak berada pada state aktif.");
    }
    pass(
      `Agent ${agent.code} terikat ke ${agent.outlet_code}/${agent.register_code}.`,
    );

    if (!agent.secret_hash.startsWith("hws2.")) {
      throw new Error(
        "Credential DB tidak menggunakan format encrypted hws2.",
      );
    }
    pass("Credential DB terenkripsi dengan format hws2.");

    const auditRows = await client.query<AuditRow>(
      `
        select action, after_data, metadata
        from audit_logs
        where entity_type = 'hardware_agent'
          and entity_id = $1
          and action = 'hardware.agent.create'
        order by created_at desc
        limit 1
      `,
      [agent.id],
    );

    const audit = auditRows.rows[0];

    if (!audit) {
      throw new Error("Audit hardware.agent.create tidak ditemukan.");
    }

    if (
      hasForbiddenSensitiveKey(audit.after_data) ||
      hasForbiddenSensitiveKey(audit.metadata)
    ) {
      throw new Error("Audit create agent mengandung key credential sensitif.");
    }

    const serializedAudit = JSON.stringify({
      afterData: audit.after_data,
      metadata: audit.metadata,
    });

    if (serializedAudit.includes(agent.secret_hash)) {
      throw new Error("Encrypted credential tidak boleh disalin ke audit log.");
    }
    pass("Audit create tersedia dan tidak menyimpan credential.");

    await verifyDuplicateGuard(client, agent);
    pass("Constraint DB memblokir active agent kedua pada register yang sama.");

    const envPath = args.envFile ?? findDownloadedEnv(args.agentCode);

    if (!envPath) {
      throw new Error(
        "File hardware-hub.env belum ditemukan. Gunakan --env-file PATH atau simpan hasil download pada folder Downloads.",
      );
    }

    if (!existsSync(envPath)) {
      throw new Error(`File env tidak ditemukan: ${envPath}`);
    }

    const downloadedEnv = parseEnvFile(envPath);

    if (downloadedEnv.HARDWARE_AGENT_ID !== agent.id) {
      throw new Error(
        "HARDWARE_AGENT_ID pada file download tidak cocok dengan DB.",
      );
    }

    const secret = downloadedEnv.HARDWARE_AGENT_SECRET ?? "";

    if (secret.length < 32) {
      throw new Error(
        "HARDWARE_AGENT_SECRET pada file download tidak valid.",
      );
    }

    if (downloadedEnv.HARDWARE_AGENT_REQUEST_AUTH_MODE !== "signed") {
      throw new Error("File download wajib memakai signed auth.");
    }

    if (downloadedEnv.HARDWARE_PROTOCOL_MODE !== "v2-preferred") {
      throw new Error("File download wajib memakai protocol v2-preferred.");
    }

    for (const key of [
      "HARDWARE_ADAPTER_MODE",
      "LABEL_PRINTER_ADAPTER",
      "DOCUMENT_PRINTER_ADAPTER",
      "CASH_DRAWER_ADAPTER",
    ]) {
      if (downloadedEnv[key] !== "fake") {
        throw new Error(`${key} wajib fake pada onboarding file.`);
      }
    }
    pass(
      "Downloaded hardware-hub.env menggunakan signed + v2 + safe-first fake.",
    );

    const credential = await import(
      "../src/lib/hardware/agent-credential"
    );

    const decrypted = credential.decryptHardwareAgentSecret(
      agent.id,
      agent.secret_hash,
    );

    if (!decrypted || decrypted !== secret) {
      throw new Error(
        "Secret pada downloaded env tidak cocok dengan encrypted credential di DB.",
      );
    }
    pass("Secret one-time download cocok dengan encrypted credential DB.");

    console.log("");
    console.log("2D.1D DATABASE + CREDENTIAL ACCEPTANCE PASS");
    console.log("");
    console.log("Manual final check:");
    console.log(
      "- Tutup dialog sukses / refresh halaman dan pastikan secret lama tidak dapat ditampilkan kembali.",
    );
    console.log(
      "- Jangan commit atau upload file hardware-hub.env karena berisi plaintext agent secret.",
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Acceptance verifier gagal.",
  );
  process.exitCode = 1;
});
