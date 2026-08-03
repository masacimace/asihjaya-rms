import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const generatedSecretBytes = new Map([
  ["POSTGRES_PASSWORD", 32],
  ["SESSION_SECRET", 48],
  ["RECEIPT_VERIFICATION_SECRET", 48],
  ["CUSTOMER_HISTORY_SESSION_SECRET", 48],
  ["CUSTOMER_HISTORY_PIN_PEPPER", 48],
  ["SECURITY_RATE_LIMIT_SECRET", 48],
  ["PDF_RENDER_TOKEN_SECRET", 48],
  ["HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY", 48],
  ["BOOTSTRAP_ADMIN_PASSWORD", 24],
  ["HARDWARE_AGENT_SECRET", 48],
]);

const rotatableSecretNames = new Set(
  [...generatedSecretBytes.keys()].filter((name) => name !== "POSTGRES_PASSWORD"),
);
const placeholderPattern =
  /^(?:|change[-_ ]?me|replace[-_ ]?me|generate[-_ ]?me|todo|<[^>]+>)$/i;

function fail(message) {
  throw new Error(message);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`${name} membutuhkan value.`);
  }
  return value;
}

function usage() {
  return [
    "Gunakan:",
    "  npm run env:generate-secrets -- --write .env.production --template .env.production.example",
    "  npm run env:generate-secrets -- --write .env.production --rotate SESSION_SECRET",
    "",
    "Generator tidak mencetak nilai secret ke terminal.",
  ].join("\n");
}

function readEnvironmentValue(content, name) {
  const match = content.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match?.[1]?.trim() ?? undefined;
}

function setEnvironmentValue(content, name, value) {
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, `${name}=${value}`);
  }
  return `${content.replace(/\s*$/, "")}\n${name}=${value}\n`;
}

function environmentVariableNames(content) {
  const names = new Set();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    names.add(line.slice(0, separatorIndex).trim());
  }
  return names;
}

function appendMissingTemplateVariables(content, templateContent) {
  const existingNames = environmentVariableNames(content);
  const missingLines = [];
  const missingNames = [];
  for (const rawLine of templateContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const name = line.slice(0, separatorIndex).trim();
    if (existingNames.has(name)) continue;
    missingLines.push(line);
    missingNames.push(name);
    existingNames.add(name);
  }
  if (missingLines.length === 0) return { content, missingNames };
  return {
    content: `${content.replace(/\s*$/, "")}\n\n# Variable baru dari template environment saat ini.\n${missingLines.join("\n")}\n`,
    missingNames,
  };
}

function isPlaceholder(value) {
  return value === undefined || placeholderPattern.test(value.trim());
}

function generateSecret(name) {
  const byteLength = generatedSecretBytes.get(name);
  if (!byteLength) fail(`Secret generator tidak mengenal ${name}.`);
  return randomBytes(byteLength).toString("base64url");
}

function updateDatabaseUrl(content, password) {
  const databaseName = readEnvironmentValue(content, "POSTGRES_DB");
  const databaseUser = readEnvironmentValue(content, "POSTGRES_USER");
  if (!databaseName || !databaseUser) {
    fail("POSTGRES_DB dan POSTGRES_USER wajib tersedia sebelum DATABASE_URL dibuat.");
  }

  const current = readEnvironmentValue(content, "DATABASE_URL");
  let hostname = "db";
  let port = "5432";
  let search = "";

  if (current && !current.includes("CHANGE_ME")) {
    try {
      const parsed = new URL(current);
      hostname = parsed.hostname || hostname;
      port = parsed.port || port;
      search = parsed.search;
    } catch {
      fail("DATABASE_URL yang ada tidak valid dan tidak dapat diperbarui dengan aman.");
    }
  }

  const databaseUrl = `postgresql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(
    password,
  )}@${hostname}:${port}/${encodeURIComponent(databaseName)}${search}`;
  return setEnvironmentValue(content, "DATABASE_URL", databaseUrl);
}

function writePrivateFile(filePath, content) {
  const absolutePath = path.resolve(filePath);
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  const descriptor = openSync(temporaryPath, "wx", 0o600);
  try {
    writeFileSync(descriptor, content, "utf8");
  } finally {
    closeSync(descriptor);
  }

  try {
    chmodSync(temporaryPath, 0o600);
  } catch {
    // Windows tidak selalu menerapkan mode POSIX.
  }

  try {
    renameSync(temporaryPath, absolutePath);
  } catch (error) {
    if (process.platform !== "win32") throw error;
    rmSync(absolutePath, { force: true });
    renameSync(temporaryPath, absolutePath);
  }

  try {
    chmodSync(absolutePath, 0o600);
  } catch {
    // Windows tetap mengandalkan ACL user dan file berada di .gitignore.
  }
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(usage());
  process.exit(0);
}

const targetPath = optionValue(args, "--write");
if (!targetPath) fail(`${usage()}\n\n--write wajib diberikan agar secret tidak bocor ke stdout.`);

const templatePath = optionValue(args, "--template") ?? ".env.production.example";
const rotateOption = optionValue(args, "--rotate");
const rotateNames = new Set(
  rotateOption
    ? rotateOption
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [],
);

for (const name of rotateNames) {
  if (!rotatableSecretNames.has(name)) {
    fail(
      `${name} tidak dapat dirotasi otomatis. Rotasi database/storage harus mengikuti runbook credential terkait.`,
    );
  }
}

const targetExisted = existsSync(targetPath);
if (!targetExisted) {
  if (rotateNames.size > 0) {
    fail("--rotate hanya boleh digunakan pada environment file yang sudah tersedia.");
  }
  if (!existsSync(templatePath)) {
    fail(`${templatePath} tidak ditemukan.`);
  }
  copyFileSync(templatePath, targetPath);
}

let content = readFileSync(targetPath, "utf8");
let addedTemplateVariables = [];
if (existsSync(templatePath)) {
  const merged = appendMissingTemplateVariables(content, readFileSync(templatePath, "utf8"));
  content = merged.content;
  addedTemplateVariables = merged.missingNames;
}
const updated = [];
const preserved = [];
let generatedDatabasePassword;

for (const name of generatedSecretBytes.keys()) {
  const currentValue = readEnvironmentValue(content, name);
  if (
    name === "POSTGRES_PASSWORD" &&
    currentValue === undefined &&
    (!readEnvironmentValue(content, "POSTGRES_DB") ||
      !readEnvironmentValue(content, "POSTGRES_USER"))
  ) {
    continue;
  }

  const shouldRotate = rotateNames.has(name);
  const shouldInitialize = isPlaceholder(currentValue);

  if (!shouldRotate && !shouldInitialize) {
    preserved.push(name);
    continue;
  }

  const value = generateSecret(name);
  content = setEnvironmentValue(content, name, value);
  updated.push(name);
  if (name === "POSTGRES_PASSWORD") generatedDatabasePassword = value;
}

if (generatedDatabasePassword) {
  content = updateDatabaseUrl(content, generatedDatabasePassword);
  updated.push("DATABASE_URL");
}

writePrivateFile(targetPath, `${content.replace(/\s*$/, "")}\n`);

console.log(`Environment private diperbarui di ${path.resolve(targetPath)}.`);
console.log(`Variable diperbarui: ${updated.join(", ") || "tidak ada"}.`);
if (addedTemplateVariables.length > 0) {
  console.log(`Variable template baru ditambahkan: ${addedTemplateVariables.join(", ")}.`);
}
if (preserved.length > 0) {
  console.log(`Variable existing dipertahankan: ${preserved.join(", ")}.`);
}
console.log("Nilai secret tidak ditampilkan. Simpan file dengan akses terbatas.");
