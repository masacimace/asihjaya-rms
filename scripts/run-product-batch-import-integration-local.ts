import { spawnSync } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const composeFile = path.join(projectRoot, "compose.product-batch-test.yaml");
const testDatabaseUrl =
  "postgresql://asihjaya_test:asihjaya_test_password@127.0.0.1:55438/asihjaya_rms_product_batch_test";

function resolveCommand(command: "npm" | "docker", args: string[]) {
  if (command === "docker") {
    return { executable: "docker", args };
  }

  const npmExecPath = process.env.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error(
      "npm_execpath tidak tersedia. Jalankan runner melalui npm run test:product-batch:local.",
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
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.executable, resolved.args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      NODE_ENV: "test",
      IMAGE_STORAGE_DRIVER: "local",
      IMAGE_STORAGE_ROOT: ".data/product-batch-integration-test",
    },
    stdio: options.quiet ? "ignore" : "inherit",
    shell: false,
  });

  if (result.error && !options.allowFailure) throw result.error;
  if ((result.status ?? 1) !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} gagal dengan exit code ${result.status}.`,
    );
  }
  return result.status === 0;
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
        "postgres",
        "pg_isready",
        "-U",
        "asihjaya_test",
        "-d",
        "asihjaya_rms_product_batch_test",
      ],
      { allowFailure: true, quiet: true },
    );

    if (ready) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
  }

  throw new Error("PostgreSQL 17 product-batch-test belum siap setelah 60 detik.");
}

console.log("Menyalakan PostgreSQL 17 disposable untuk Product Batch Import test...");
run(
  "docker",
  ["compose", "-f", composeFile, "down", "--volumes", "--remove-orphans"],
  { allowFailure: true, quiet: true },
);

try {
  run("docker", ["compose", "-f", composeFile, "up", "-d"]);
  waitForPostgres();

  console.log("Menjalankan migration pada database disposable...");
  run("npm", ["run", "db:migrate"]);

  console.log("Menjalankan Product Batch Import integration suite...");
  run("npm", ["run", "test:product-batch"]);
} finally {
  console.log("Menghapus PostgreSQL product-batch-test beserta volume sementara...");
  run(
    "docker",
    ["compose", "-f", composeFile, "down", "--volumes", "--remove-orphans"],
    { allowFailure: true },
  );
}
