import "dotenv/config";

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const composeFile = path.join(projectRoot, "compose.yaml");
const requiredConfirmation = "RESET_LOCAL_DATABASE";
const localDatabaseName = "asihjaya_rms";
const localDatabaseUser = "asihjaya";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveCommand(command: "npm" | "docker", args: string[]) {
  if (command === "docker") {
    return { executable: "docker", args };
  }

  const npmExecPath = process.env.npm_execpath?.trim();

  if (!npmExecPath) {
    throw new Error(
      "npm_execpath tidak tersedia. Jalankan reset melalui npm run db:fresh:local.",
    );
  }

  return {
    executable: process.execPath,
    args: [npmExecPath, ...args],
  };
}

function run(
  command: "npm" | "docker",
  args: string[],
  options: { allowFailure?: boolean; quiet?: boolean } = {},
) {
  const resolvedCommand = resolveCommand(command, args);
  const result = spawnSync(resolvedCommand.executable, resolvedCommand.args, {
    cwd: projectRoot,
    env: process.env,
    stdio: options.quiet ? "ignore" : "inherit",
    shell: false,
  });

  if (result.error && !options.allowFailure) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} gagal dengan exit code ${result.status}.`,
    );
  }

  return result.status === 0;
}

function readConfirmation(): string | null {
  const argument = process.argv.find((value) => value.startsWith("--confirm="));

  return argument?.slice("--confirm=".length).trim() || null;
}

function validateLocalDatabaseTarget() {
  assert(
    process.env.NODE_ENV !== "production",
    "Reset database lokal tidak boleh dijalankan dengan NODE_ENV=production.",
  );

  const databaseUrlValue = process.env.DATABASE_URL?.trim();
  assert(databaseUrlValue, "DATABASE_URL belum diatur pada file .env.");

  const databaseUrl = new URL(databaseUrlValue);
  const allowedProtocols = new Set(["postgres:", "postgresql:"]);
  const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
  const databaseUser = decodeURIComponent(databaseUrl.username);

  assert(
    allowedProtocols.has(databaseUrl.protocol),
    "DATABASE_URL lokal harus memakai protokol PostgreSQL.",
  );
  assert(
    allowedHosts.has(databaseUrl.hostname),
    "Reset ditolak: DATABASE_URL tidak menunjuk ke localhost.",
  );
  assert(
    !databaseUrl.port || databaseUrl.port === "5432",
    "Reset ditolak: port database bukan port Compose lokal 5432.",
  );
  assert(
    databaseName === localDatabaseName,
    `Reset ditolak: nama database harus ${localDatabaseName}.`,
  );
  assert(
    databaseUser === localDatabaseUser,
    `Reset ditolak: user database harus ${localDatabaseUser}.`,
  );
}

function validateComposeProject() {
  assert(existsSync(composeFile), "compose.yaml tidak ditemukan di root project.");

  const composeSource = readFileSync(composeFile, "utf8");
  assert(
    /^name:\s*asihjaya-rms\s*$/m.test(composeSource),
    "Reset ditolak: compose.yaml bukan project asihjaya-rms.",
  );
  assert(
    /^\s*container_name:\s*asihjaya-rms-db\s*$/m.test(composeSource),
    "Reset ditolak: service database lokal tidak dikenali.",
  );
}

function waitForPostgres() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    const ready = run(
      "docker",
      [
        "compose",
        "-f",
        composeFile,
        "exec",
        "-T",
        "db",
        "pg_isready",
        "-U",
        localDatabaseUser,
        "-d",
        localDatabaseName,
      ],
      { allowFailure: true, quiet: true },
    );

    if (ready) {
      return;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
  }

  throw new Error("PostgreSQL lokal belum siap setelah 60 detik.");
}

function purgeLocalStorage() {
  const storageDriver =
    process.env.IMAGE_STORAGE_DRIVER?.trim().toLowerCase() || "local";

  assert(
    storageDriver === "local",
    "Pembersihan storage ditolak karena IMAGE_STORAGE_DRIVER bukan local.",
  );

  const configuredRoot = process.env.IMAGE_STORAGE_ROOT?.trim() || ".data/uploads";
  const storageRoot = path.isAbsolute(configuredRoot)
    ? path.resolve(configuredRoot)
    : path.resolve(projectRoot, configuredRoot);
  const allowedRoot = path.resolve(projectRoot, ".data");

  assert(
    storageRoot === allowedRoot || storageRoot.startsWith(`${allowedRoot}${path.sep}`),
    "Pembersihan storage hanya diizinkan untuk folder .data di dalam project.",
  );

  rmSync(storageRoot, { recursive: true, force: true });
  console.log(`✅ Storage lokal dibersihkan: ${path.relative(projectRoot, storageRoot)}`);
}

function main() {
  const confirmation = readConfirmation();
  const shouldPurgeLocalStorage = process.argv.includes("--purge-local-storage");

  assert(
    confirmation === requiredConfirmation,
    `Reset dibatalkan. Jalankan dengan --confirm=${requiredConfirmation}.`,
  );

  validateLocalDatabaseTarget();
  validateComposeProject();

  console.log("⚠️  Menghapus database development lokal beserta seluruh datanya...");
  run("docker", [
    "compose",
    "-f",
    composeFile,
    "down",
    "--volumes",
    "--remove-orphans",
  ]);

  if (shouldPurgeLocalStorage) {
    purgeLocalStorage();
  }

  console.log("Menyalakan PostgreSQL 17 lokal...");
  run("docker", ["compose", "-f", composeFile, "up", "-d", "db"]);
  waitForPostgres();

  console.log("Menjalankan seluruh database migration...");
  run("npm", ["run", "db:migrate"]);

  console.log("Menjalankan seed database baru...");
  run("npm", ["run", "db:seed"]);

  console.log("Memvalidasi migration pada database baru...");
  run("npm", ["run", "check:database:live"]);

  console.log("✅ Database development lokal sudah fresh dan siap digunakan.");
}

try {
  main();
} catch (error) {
  console.error("❌ Reset database lokal gagal:", error);
  process.exitCode = 1;
}
