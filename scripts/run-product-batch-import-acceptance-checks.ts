import "dotenv/config";

import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();

type Profile = "existing" | "fresh";

type CheckStep = {
  label: string;
  script: string;
};

function readProfile(): Profile {
  const raw = process.argv
    .find((value) => value.startsWith("--profile="))
    ?.slice("--profile=".length)
    .trim();

  if (raw === "existing" || raw === "fresh") {
    return raw;
  }

  throw new Error("Gunakan --profile=existing atau --profile=fresh.");
}

function assertLocalDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local acceptance tidak boleh dijalankan dengan NODE_ENV=production.");
  }

  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL belum tersedia. Pastikan file .env lokal aktif.");
  }

  const parsed = new URL(value);
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      `Local acceptance ditolak: DATABASE_URL mengarah ke host ${parsed.hostname}, bukan localhost.`,
    );
  }
}

function resolveNpm(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error(
      "npm_execpath tidak tersedia. Jalankan acceptance melalui npm run test:product-batch-acceptance:existing/fresh.",
    );
  }

  return {
    executable: process.execPath,
    args: [npmExecPath, ...args],
  };
}

function runNpmScript(step: CheckStep, index: number, total: number) {
  console.log("");
  console.log(`[${index}/${total}] ${step.label}`);
  console.log(`> npm run ${step.script}`);

  const command = resolveNpm(["run", step.script]);
  const result = spawnSync(command.executable, command.args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(`Acceptance gate gagal pada npm run ${step.script}.`);
  }
}

const profile = readProfile();
assertLocalDatabase();

const steps: CheckStep[] = [
  { label: "TypeScript", script: "typecheck" },
  { label: "ESLint", script: "lint" },
  { label: "Route contract", script: "routes:check" },
  { label: "Production build", script: "build" },
  { label: "Database deployment contract", script: "check:database-deployment" },
  { label: "XLSX security regression", script: "check:xlsx-security" },
  { label: "Inventory label regression", script: "check:inventory-label" },
  { label: "Product Batch Import full contract", script: "check:product-batch-import" },
  { label: "Legacy Product Migration regression", script: "check:legacy-product-migration" },
  { label: "POS Stage 1C regression", script: "check:pos-stage-1c" },
  { label: "Current local database live contract", script: "check:database:live" },
  { label: "Disposable Product Batch integration 9-case suite", script: "test:product-batch:local" },
  { label: "Product Batch affected-business regression", script: "check:product-batch-regression" },
];

console.log(`Product Batch Import 2B.10 technical acceptance: ${profile.toUpperCase()} local DB.`);
console.log("Catatan: npm install dijalankan manual sebelum runner ini sesuai roadmap.");

for (const [index, step] of steps.entries()) {
  runNpmScript(step, index + 1, steps.length);
}

console.log("");
console.log(`PASS: technical acceptance ${profile} local DB selesai.`);
console.log("Lanjutkan manual browser/hardware checklist pada docs/development/product-batch-import-local-acceptance.md.");
