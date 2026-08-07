import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";

const projectRoot = process.cwd();
const composeFile = path.join(projectRoot, "compose.database-deployment-test.yaml");
const projectName = `asihjaya-rms-telegram-weekly-${process.pid}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "Port test Telegram weekly finance tidak tersedia.");
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function resolveNpm(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error("npm_execpath tidak tersedia. Jalankan melalui npm run test:telegram-weekly:local.");
  }
  return { executable: process.execPath, args: [npmExecPath, ...args] };
}

function run(
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  allowFailure = false,
) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    env: environment,
    stdio: allowFailure ? "ignore" : "inherit",
    shell: false,
  });
  if (result.error && !allowFailure) throw result.error;
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`${executable} ${args.join(" ")} gagal dengan exit code ${result.status}.`);
  }
  return result.status === 0;
}

function runNpm(args: string[], environment: NodeJS.ProcessEnv) {
  const command = resolveNpm(args);
  run(command.executable, command.args, environment);
}

async function canConnectThroughPublishedPort(databaseUrl: string): Promise<boolean> {
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
  });
  let connected = false;

  try {
    await client.connect();
    connected = true;
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    if (connected) {
      await client.end().catch(() => undefined);
    }
  }
}

async function waitForPostgres(
  composeArgs: string[],
  environment: NodeJS.ProcessEnv,
  databaseUrl: string,
) {
  const deadline = Date.now() + 60_000;
  let consecutiveHostChecks = 0;

  while (Date.now() < deadline) {
    const containerReady = run(
      "docker",
      [
        ...composeArgs,
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "asihjaya_migration_test",
        "-d",
        "asihjaya_rms_migration_test",
      ],
      environment,
      true,
    );

    const hostReady = containerReady
      ? await canConnectThroughPublishedPort(databaseUrl)
      : false;

    if (hostReady) {
      consecutiveHostChecks += 1;
      if (consecutiveHostChecks >= 3) return;
      await delay(500);
      continue;
    }

    consecutiveHostChecks = 0;
    await delay(1_000);
  }

  throw new Error(
    "PostgreSQL 17 Telegram weekly finance test belum stabil melalui published port setelah 60 detik.",
  );
}

const port = await findAvailablePort();
const databaseUrl = `postgresql://asihjaya_migration_test:asihjaya_migration_test_password@127.0.0.1:${port}/asihjaya_rms_migration_test`;
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  DATABASE_DEPLOYMENT_TEST_PORT: String(port),
  TELEGRAM_INTEGRATION_ENABLED: "true",
  TELEGRAM_MAX_ATTEMPTS: "5",
};
const composeArgs = ["compose", "--project-name", projectName, "-f", composeFile];

console.log("Menyalakan PostgreSQL 17 disposable untuk Telegram 2C.7 weekly finance...");
run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"], environment, true);

try {
  run("docker", [...composeArgs, "up", "-d"], environment);
  await waitForPostgres(composeArgs, environment, databaseUrl);

  console.log("[weekly] Menjalankan migration sampai schema Telegram terbaru...");
  runNpm(["run", "db:migrate"], environment);

  console.log("[weekly] Menjalankan integration checks weekly aggregation + outbox...");
  runNpm(["run", "check:telegram-weekly", "--", "--database"], environment);

  console.log(
    "Telegram 2C.7 local weekly rehearsal passed: Monday–Sunday, immutable snapshot aggregation, delayed generation, cost completeness, previous-week comparison, Dana Titip, dan idempotency.",
  );
} finally {
  console.log("Menghapus PostgreSQL Telegram 2C.7 beserta volume sementara...");
  run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"], environment, true);
}
