import { randomBytes } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const processSuffix = `${process.pid}-${Date.now()}`;
const projectName = `asihjaya-rms-production-smoke-${process.pid}`;
const envFileName = `.env.production.container-smoke-${processSuffix}`;
const imageName = "asihjaya-rms:production-smoke";
const migratorImageName = "asihjaya-rms-migrator:production-smoke";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "Port smoke test tidak dapat dialokasikan.");
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function runDocker(
  args: string[],
  options: {
    allowFailure?: boolean;
    capture?: boolean;
    environment: NodeJS.ProcessEnv;
  },
): string {
  const result = spawnSync("docker", args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: options.environment,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `docker ${args.join(" ")} gagal dengan exit code ${result.status}.${detail ? `\n${detail}` : ""}`,
    );
  }

  return (result.stdout || "").trim();
}

function makeSecret(name: string): string {
  return `smoke-${name}-${randomBytes(32).toString("hex")}`;
}

function createSmokeEnvironment(port: number) {
  const databaseName = "asihjaya_rms_container_smoke";
  const databaseUser = "asihjaya_container_smoke";
  const databasePassword = randomBytes(24).toString("hex");
  const appUrl = `http://127.0.0.1:${port}`;

  const values: Record<string, string> = {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_NAME: "Asihjaya RMS Container Smoke",
    NEXT_PUBLIC_APP_URL: appUrl,
    APP_URL: appUrl,
    INTERNAL_RENDER_ORIGIN: "http://127.0.0.1:3000",
    DEFAULT_ORGANIZATION_SLUG: "asihjaya",
    SERVER_ACTION_BODY_SIZE_LIMIT: "20mb",
    PORT: "3000",
    POSTGRES_DB: databaseName,
    POSTGRES_USER: databaseUser,
    POSTGRES_PASSWORD: databasePassword,
    DATABASE_URL: `postgresql://${databaseUser}:${databasePassword}@db:5432/${databaseName}`,
    SESSION_SECRET: makeSecret("session"),
    RECEIPT_VERIFICATION_SECRET: makeSecret("receipt"),
    CUSTOMER_HISTORY_SESSION_SECRET: makeSecret("history-session"),
    CUSTOMER_HISTORY_PIN_PEPPER: makeSecret("history-pin"),
    SECURITY_RATE_LIMIT_SECRET: makeSecret("rate-limit"),
    PDF_RENDER_TOKEN_SECRET: makeSecret("pdf-render"),
    HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY: makeSecret("hardware-agent"),
    TRUST_PROXY: "false",
    TRUST_PROXY_HOPS: "1",
    HARDWARE_AGENT_AUTH_MODE: "signed-only",
    IMAGE_STORAGE_DRIVER: "local",
    IMAGE_STORAGE_ROOT: ".data/uploads",
    IMAGE_MAX_UPLOAD_MB: "5",
    PDF_RENDER_MAX_CONCURRENCY: "1",
    PDF_RENDER_MAX_QUEUE: "10",
    PDF_RENDER_DISABLE_SANDBOX: "false",
  };

  return `${Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n")}\n`;
}

async function waitFor(
  description: string,
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  const detail = lastError instanceof Error ? ` Detail terakhir: ${lastError.message}` : "";
  throw new Error(`Timeout menunggu ${description}.${detail}`);
}

const port = await findAvailablePort();
const cliEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  ASIHJAYA_ENV_FILE: envFileName,
  ASIHJAYA_BIND_ADDRESS: "127.0.0.1",
  ASIHJAYA_APP_PORT: String(port),
  ASIHJAYA_IMAGE: imageName,
  ASIHJAYA_MIGRATOR_IMAGE: migratorImageName,
  APP_RELEASE_ID: "20260806T000000Z-0123456789ab",
  APP_REVISION: "0123456789abcdef0123456789abcdef01234567",
  APP_BUILD_DATE: new Date().toISOString(),
};
const composePrefix = [
  "compose",
  "--env-file",
  envFileName,
  "--project-name",
  projectName,
  "-f",
  "compose.production.yaml",
];

function compose(args: string[], options: { allowFailure?: boolean; capture?: boolean } = {}) {
  return runDocker([...composePrefix, ...args], {
    ...options,
    environment: cliEnvironment,
  });
}

function inspect(format: string, target: string): string {
  return runDocker(["inspect", "--format", format, target], {
    capture: true,
    environment: cliEnvironment,
  });
}

writeFileSync(envFileName, createSmokeEnvironment(port), {
  encoding: "utf8",
  mode: 0o600,
});

try {
  runDocker(["version"], { capture: true, environment: cliEnvironment });
  compose(["down", "--volumes", "--remove-orphans"], { allowFailure: true });

  console.log("Membangun application dan migrator image dari Docker context bersih...");
  compose(["build", "--pull", "app", "migrate"]);

  console.log("Menyalakan production Compose disposable...");
  compose(["up", "-d"]);

  const migrationContainerId = compose(["ps", "-a", "-q", "migrate"], { capture: true });
  assert(migrationContainerId, "Container migrate tidak ditemukan setelah compose up.");
  assert(
    inspect("{{.State.Status}}", migrationContainerId) === "exited" &&
      inspect("{{.State.ExitCode}}", migrationContainerId) === "0",
    "Migration service wajib selesai sukses sebelum application start.",
  );

  const appContainerId = compose(["ps", "-q", "app"], { capture: true });
  assert(appContainerId, "Container app tidak ditemukan setelah compose up.");

  await waitFor(
    "container app healthy",
    () => inspect("{{.State.Health.Status}}", appContainerId) === "healthy",
    240_000,
  );

  const livenessResponse = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(8_000),
  });
  assert(livenessResponse.ok, `Liveness endpoint gagal dengan HTTP ${livenessResponse.status}.`);
  const livenessPayload = (await livenessResponse.json()) as {
    release?: { releaseId?: string; revision?: string };
  };
  assert(
    livenessPayload.release?.releaseId === cliEnvironment.APP_RELEASE_ID,
    "Liveness endpoint wajib melaporkan release ID image yang aktif.",
  );
  assert(
    livenessPayload.release?.revision === cliEnvironment.APP_REVISION,
    "Liveness endpoint wajib melaporkan Git revision image yang aktif.",
  );

  const readinessResponse = await fetch(
    `http://127.0.0.1:${port}/api/health/database`,
    { signal: AbortSignal.timeout(8_000) },
  );
  assert(readinessResponse.ok, `Readiness endpoint gagal dengan HTTP ${readinessResponse.status}.`);

  const runtimeUid = compose(["exec", "-T", "app", "id", "-u"], { capture: true });
  assert(runtimeUid !== "0", "Container app tidak boleh berjalan sebagai root.");
  assert(
    inspect("{{.HostConfig.ReadonlyRootfs}}", appContainerId) === "true",
    "Root filesystem container app wajib read-only.",
  );
  assert(
    inspect("{{.HostConfig.RestartPolicy.Name}}", appContainerId) === "unless-stopped",
    "Restart policy app wajib unless-stopped.",
  );
  assert(Number(inspect("{{.HostConfig.Memory}}", appContainerId)) > 0, "Memory limit app belum aktif.");
  assert(Number(inspect("{{.HostConfig.NanoCpus}}", appContainerId)) > 0, "CPU limit app belum aktif.");
  assert(Number(inspect("{{.HostConfig.PidsLimit}}", appContainerId)) > 0, "PID limit app belum aktif.");

  compose([
    "exec",
    "-T",
    "app",
    "sh",
    "-lc",
    "touch /app/.data/uploads/.container-smoke && rm /app/.data/uploads/.container-smoke && touch /app/.next/cache/.container-smoke && rm /app/.next/cache/.container-smoke && touch /tmp/.container-smoke && rm /tmp/.container-smoke",
  ]);

  const rootWriteProbe = spawnSync(
    "docker",
    [
      ...composePrefix,
      "exec",
      "-T",
      "app",
      "sh",
      "-lc",
      "touch /app/.read-only-probe",
    ],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: cliEnvironment,
      stdio: "pipe",
    },
  );
  assert(rootWriteProbe.status !== 0, "Read-only root filesystem masih dapat ditulis.");

  const restartCountBefore = Number(inspect("{{.RestartCount}}", appContainerId));
  console.log("Menguji restart policy setelah proses aplikasi utama dihentikan secara tidak normal...");
  compose(
    [
      "exec",
      "-T",
      "app",
      "sh",
      "-lc",
      [
        "set -- $(cat /proc/1/task/1/children)",
        'for candidate do [ "$candidate" = "$$" ] || { kill -KILL "$candidate"; exit 0; }; done',
        'echo "Proses aplikasi child dari init tidak ditemukan." >&2',
        "exit 1",
      ].join("; "),
    ],
    { allowFailure: true },
  );

  await waitFor(
    "container restart dan kembali healthy",
    () => {
      const restartCount = Number(inspect("{{.RestartCount}}", appContainerId));
      const health = inspect("{{.State.Health.Status}}", appContainerId);
      return restartCount > restartCountBefore && health === "healthy";
    },
    180_000,
  );

  console.log(
    `OK: production container smoke test lulus pada http://127.0.0.1:${port}; migration guarded, non-root, read-only, healthy, resource-limited, dan restart otomatis.`,
  );
} catch (error) {
  compose(["logs", "--no-color", "--tail", "200"], { allowFailure: true });
  throw error;
} finally {
  compose(["down", "--volumes", "--remove-orphans", "--timeout", "15"], {
    allowFailure: true,
  });
  rmSync(envFileName, { force: true });
}
