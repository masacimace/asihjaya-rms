import "dotenv/config";

import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const REQUIRED_CONFIRMATION = "RESET_LOCAL_DATABASE";

function readArgument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() ?? null;
}

function assertLocalDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Fresh local acceptance tidak boleh dijalankan dengan NODE_ENV=production.");
  }

  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL belum tersedia pada environment lokal.");
  }

  const parsed = new URL(value);
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `Fresh local acceptance ditolak: DATABASE_URL mengarah ke ${parsed.hostname}, bukan localhost.`,
    );
  }
}

function resolveNpm(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error(
      "npm_execpath tidak tersedia. Jalankan melalui npm run test:product-batch-acceptance:fresh.",
    );
  }

  return {
    executable: process.execPath,
    args: [npmExecPath, ...args],
  };
}

function runNpm(args: string[]) {
  const command = resolveNpm(args);
  const result = spawnSync(command.executable, command.args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    throw new Error(`npm ${args.join(" ")} gagal dengan exit code ${result.status}.`);
  }
}

const confirmation = readArgument("confirm");
if (confirmation !== REQUIRED_CONFIRMATION) {
  throw new Error(
    `Fresh rehearsal menghapus database + storage development lokal. Jalankan ulang dengan --confirm=${REQUIRED_CONFIRMATION}.`,
  );
}

assertLocalDatabase();

console.log("PERINGATAN: Fresh rehearsal akan menghapus database development lokal dan storage image lokal di bawah .data.");
console.log("Pastikan existing-DB acceptance sudah selesai dan data lokal yang ingin dipertahankan sudah diamankan.");
console.log("");

runNpm([
  "run",
  "db:fresh:local",
  "--",
  `--confirm=${REQUIRED_CONFIRMATION}`,
  "--purge-local-storage",
]);

runNpm([
  "run",
  "test:product-batch-acceptance:checks",
  "--",
  "--profile=fresh",
]);

console.log("");
console.log("PASS: fresh local DB technical acceptance selesai.");
console.log("Sekarang jalankan manual acceptance pada fresh DB sebelum pre-merge gate.");
