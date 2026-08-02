import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const generatedValues = new Map([
  ["SESSION_SECRET", randomBytes(48).toString("base64url")],
  ["RECEIPT_VERIFICATION_SECRET", randomBytes(48).toString("base64url")],
  ["CUSTOMER_HISTORY_SESSION_SECRET", randomBytes(48).toString("base64url")],
  ["CUSTOMER_HISTORY_PIN_PEPPER", randomBytes(48).toString("base64url")],
  ["SECURITY_RATE_LIMIT_SECRET", randomBytes(48).toString("base64url")],
  ["PDF_RENDER_TOKEN_SECRET", randomBytes(48).toString("base64url")],
  [
    "HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY",
    randomBytes(48).toString("base64url"),
  ],
  ["BOOTSTRAP_ADMIN_PASSWORD", randomBytes(24).toString("base64url")],
  ["HARDWARE_AGENT_SECRET", randomBytes(48).toString("base64url")],
]);

function printValues() {
  for (const [name, value] of generatedValues) {
    console.log(`${name}=${value}`);
  }
}

function writeValues(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`${filePath} tidak ditemukan. Salin .env.example terlebih dahulu.`);
  }

  let content = readFileSync(filePath, "utf8");
  const updated = [];
  const skipped = [];

  for (const [name, value] of generatedValues) {
    const pattern = new RegExp(`^${name}=(.*)$`, "m");
    const match = content.match(pattern);

    if (!match) {
      content = `${content.replace(/\s*$/, "")}\n${name}=${value}\n`;
      updated.push(name);
      continue;
    }

    const currentValue = match[1]?.trim() ?? "";
    if (currentValue && currentValue !== "CHANGE_ME") {
      skipped.push(name);
      continue;
    }

    content = content.replace(pattern, `${name}=${value}`);
    updated.push(name);
  }

  writeFileSync(filePath, content, "utf8");
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Windows dapat mengabaikan mode POSIX; file tetap berada di .gitignore.
  }

  console.log(`Secret baru ditulis ke ${path.resolve(filePath)}.`);
  console.log(`Diperbarui: ${updated.join(", ") || "tidak ada"}.`);
  if (skipped.length > 0) {
    console.log(
      `Dilewati karena sudah memiliki value non-placeholder: ${skipped.join(", ")}.`,
    );
  }
}

const args = process.argv.slice(2);
const writeIndex = args.indexOf("--write");
if (writeIndex < 0) {
  printValues();
} else {
  const filePath = args[writeIndex + 1];
  if (!filePath) {
    throw new Error("Gunakan --write <path>, contoh: --write .env");
  }
  writeValues(filePath);
}
