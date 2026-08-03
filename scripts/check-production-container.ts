import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(relativePath: string): string {
  const absolutePath = path.join(projectRoot, relativePath);
  assert(existsSync(absolutePath), `${relativePath} wajib tersedia.`);
  return readFileSync(absolutePath, "utf8");
}

type PackageJson = {
  scripts?: Record<string, string>;
};

const dockerfile = readText("Dockerfile");
const compose = readText("compose.production.yaml");
const dockerignore = readText(".dockerignore");
const livenessRoute = readText("src/app/api/health/route.ts");
const readinessRoute = readText("src/app/api/health/database/route.ts");
const documentation = readText("docs/development/production-container.md");
const workflow = readText(".github/workflows/ci.yml");
const packageJson = JSON.parse(readText("package.json")) as PackageJson;

for (const requiredStage of [
  "FROM base AS toolchain",
  "FROM toolchain AS deps",
  "FROM toolchain AS builder",
  "FROM base AS runner",
]) {
  assert(dockerfile.includes(requiredStage), `Dockerfile wajib memuat ${requiredStage}.`);
}

assert(
  dockerfile.includes("COPY package.json package-lock.json .npmrc ./") &&
    dockerfile.includes("COPY vendor ./vendor"),
  "Dependency stage wajib memakai package metadata dan archive vendor yang deterministik.",
);
assert(dockerfile.includes("npm ci"), "Dockerfile wajib memasang dependency melalui npm ci.");
assert(
  dockerfile.includes("--uid 10001") &&
    dockerfile.includes("--gid 10001") &&
    dockerfile.includes("USER nextjs"),
  "Runtime container wajib memakai user non-root dengan UID/GID tetap.",
);
assert(
  dockerfile.includes("/app/.data/uploads") && dockerfile.includes("/app/.next/cache"),
  "Runtime image wajib menyiapkan direktori upload dan Next.js cache yang writable.",
);
assert(
  dockerfile.includes("HEALTHCHECK") &&
    dockerfile.includes("http://127.0.0.1:3000/api/health"),
  "Docker image wajib memiliki liveness health check internal.",
);
assert(dockerfile.includes("STOPSIGNAL SIGTERM"), "Docker image wajib memakai SIGTERM untuk shutdown.");
assert(
  !/COPY\s+.*\.env/i.test(dockerfile),
  "Dockerfile tidak boleh menyalin file environment ke image.",
);

for (const requiredComposeContract of [
  "name: asihjaya-rms-production",
  "  app:",
  "  db:",
  "restart: unless-stopped",
  "condition: service_healthy",
  "read_only: true",
  "/app/.data/uploads",
  "/app/.next/cache",
  "/api/health/database",
  "postgres:17-bookworm",
  "pg_isready",
  "max-size: 10m",
  "max-file: \"5\"",
  "mem_limit:",
  "cpus:",
  "pids: 512",
  "pids: 256",
  "internal: true",
]) {
  assert(
    compose.includes(requiredComposeContract),
    `compose.production.yaml wajib memuat kontrak ${requiredComposeContract}.`,
  );
}

assert(
  !compose.includes("pids_limit:"),
  "Compose production tidak boleh mencampur legacy pids_limit dengan deploy.resources.limits.pids.",
);
assert(
  compose.includes("${ASIHJAYA_BIND_ADDRESS:-127.0.0.1}"),
  "Port aplikasi production harus bind ke loopback secara default.",
);
assert(
  compose.includes("${ASIHJAYA_ENV_FILE:-.env.production}"),
  "Compose production wajib membaca file environment terpisah.",
);
for (const variableName of ["POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]) {
  assert(
    compose.includes(`${variableName}: \${${variableName}:?`),
    `${variableName} wajib fail-fast pada Compose production.`,
  );
}

const databaseServiceStart = compose.indexOf("\n  db:\n");
const volumesStart = compose.indexOf("\nvolumes:\n", databaseServiceStart);
assert(databaseServiceStart >= 0 && volumesStart > databaseServiceStart, "Blok service database tidak valid.");
const databaseService = compose.slice(databaseServiceStart, volumesStart);
assert(
  !databaseService.includes("\n    ports:"),
  "PostgreSQL production tidak boleh dipublikasikan ke host.",
);

for (const ignoredPath of [
  ".env*",
  ".data",
  "node_modules",
  ".next",
  "hardware-hub",
  "*.dump",
  "*.backup",
]) {
  assert(dockerignore.includes(ignoredPath), `.dockerignore wajib mengecualikan ${ignoredPath}.`);
}

for (const route of [livenessRoute, readinessRoute]) {
  assert(route.includes('dynamic = "force-dynamic"'), "Health route wajib selalu dinamis.");
  assert(route.includes('"Cache-Control": "no-store, max-age=0"'), "Health route tidak boleh di-cache.");
}
assert(
  readinessRoute.includes("select 1") && readinessRoute.includes("status: 503"),
  "Database readiness harus menjalankan query ringan dan mengembalikan HTTP 503 saat gagal.",
);

for (const scriptName of [
  "check:production-container",
  "container:production:config",
  "container:production:build",
  "container:production:up",
  "container:production:down",
  "test:container:production:local",
]) {
  assert(packageJson.scripts?.[scriptName], `package.json wajib memiliki script ${scriptName}.`);
}

assert(
  workflow.includes("Validate production Compose") &&
    workflow.includes("compose.production.yaml config"),
  "CI container-build wajib memvalidasi konfigurasi Compose production.",
);
assert(
  workflow.includes("npm run check:production-container"),
  "CI wajib menjalankan kontrak static production container.",
);

const smokeRunner = readText("scripts/run-production-container-smoke.ts");
assert(
  smokeRunner.includes("/proc/1/task/1/children") &&
    !smokeRunner.includes('"kill -KILL 1"'),
  "Restart smoke test wajib menghentikan proses aplikasi child dari init, bukan PID 1.",
);
assert(
  documentation.includes("npm run test:container:production:local") &&
    documentation.includes("read-only") &&
    documentation.includes("non-root"),
  "Dokumentasi production container wajib memuat smoke test dan boundary keamanan runtime.",
);

console.log(
  "OK: production container foundation memiliki image non-root, health/readiness, resource guard, persistent volume, log rotation, dan Compose terpisah.",
);
