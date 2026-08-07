import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";

const root = process.cwd();
const composeFile = path.join(root, "compose.database-deployment-test.yaml");
const projectName = `asihjaya-rms-shift-reopen-${process.pid}`;

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
      assert(address && typeof address === "object", "Port test shift reopen tidak tersedia.");
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function resolveNpm(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) throw new Error("Jalankan melalui npm run test:shift-reopen:local.");
  return { executable: process.execPath, args: [npmExecPath, ...args] };
}

function run(executable: string, args: string[], env: NodeJS.ProcessEnv, allowFailure = false) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env,
    stdio: allowFailure ? "ignore" : "inherit",
    shell: false,
  });
  if (result.error && !allowFailure) throw result.error;
  if ((result.status ?? 1) !== 0 && !allowFailure) {
    throw new Error(`${executable} ${args.join(" ")} gagal dengan exit code ${result.status}.`);
  }
  return result.status === 0;
}

function runNpm(args: string[], env: NodeJS.ProcessEnv) {
  const command = resolveNpm(args);
  run(command.executable, command.args, env);
}

async function waitForPostgres(composeArgs: string[], env: NodeJS.ProcessEnv, databaseUrl: string) {
  const deadline = Date.now() + 60_000;
  let consecutive = 0;
  while (Date.now() < deadline) {
    const containerReady = run(
      "docker",
      [...composeArgs, "exec", "-T", "postgres", "pg_isready", "-U", "asihjaya_migration_test", "-d", "asihjaya_rms_migration_test"],
      env,
      true,
    );
    let hostReady = false;
    if (containerReady) {
      const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000 });
      try {
        await client.connect();
        await client.query("select 1");
        hostReady = true;
      } catch {
        hostReady = false;
      } finally {
        await client.end().catch(() => undefined);
      }
    }
    if (hostReady) {
      consecutive += 1;
      if (consecutive >= 3) return;
      await delay(500);
    } else {
      consecutive = 0;
      await delay(1_000);
    }
  }
  throw new Error("PostgreSQL 17 shift reopen test belum stabil setelah 60 detik.");
}

const port = await findAvailablePort();
const databaseUrl = `postgresql://asihjaya_migration_test:asihjaya_migration_test_password@127.0.0.1:${port}/asihjaya_rms_migration_test`;
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: databaseUrl,
  DATABASE_DEPLOYMENT_TEST_PORT: String(port),
  TELEGRAM_INTEGRATION_ENABLED: "true",
  TELEGRAM_MAX_ATTEMPTS: "5",
};
const composeArgs = ["compose", "--project-name", projectName, "-f", composeFile];

console.log("Menyalakan PostgreSQL 17 disposable untuk Controlled Shift Reopen...");
run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"], env, true);
try {
  run("docker", [...composeArgs, "up", "-d"], env);
  await waitForPostgres(composeArgs, env, databaseUrl);
  runNpm(["run", "db:migrate"], env);
  runNpm(["run", "check:shift-reopen", "--", "--database"], env);
  console.log("Controlled Shift Reopen local rehearsal passed.");
} finally {
  console.log("Menghapus PostgreSQL disposable Controlled Shift Reopen...");
  run("docker", [...composeArgs, "down", "--volumes", "--remove-orphans"], env, true);
}
