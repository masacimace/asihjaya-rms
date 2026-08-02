import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sheetJsVersion = "0.20.3";
const officialUrl = `https://cdn.sheetjs.com/xlsx-${sheetJsVersion}/xlsx-${sheetJsVersion}.tgz`;
const officialIntegrity =
  "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==";
const vendoredDependency = `file:vendor/xlsx-${sheetJsVersion}.tgz`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  writeFileSync(
    path.join(projectRoot, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

async function main() {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const lockEntry = packageLock.packages?.["node_modules/xlsx"];

  assert(lockEntry, "Entry SheetJS tidak ditemukan pada package-lock.json.");
  assert(
    packageLock.packages?.[""]?.dependencies,
    "Root dependency map tidak ditemukan pada package-lock.json.",
  );
  assert(
    lockEntry.version === sheetJsVersion,
    `Versi SheetJS pada lockfile harus ${sheetJsVersion}.`,
  );

  if (packageJson.dependencies?.xlsx !== vendoredDependency) {
    assert(
      packageJson.dependencies?.xlsx === officialUrl,
      `Dependency xlsx harus berasal dari ${officialUrl} sebelum vendoring.`,
    );
    assert(
      lockEntry.integrity === officialIntegrity,
      "Integrity SheetJS pada lockfile tidak cocok dengan release resmi yang disetujui.",
    );
  }

  const response = await fetch(officialUrl, {
    headers: {
      "user-agent": "asihjaya-rms-vendor-script/1.0",
    },
    redirect: "follow",
  });
  assert(
    response.ok,
    `Gagal mengunduh SheetJS resmi: HTTP ${response.status} ${response.statusText}.`,
  );

  const archiveBytes = Buffer.from(await response.arrayBuffer());
  assert(archiveBytes.length > 0, "Archive SheetJS resmi kosong.");

  const digestBase64 = createHash("sha512").update(archiveBytes).digest("base64");
  const actualIntegrity = `sha512-${digestBase64}`;
  assert(
    actualIntegrity === officialIntegrity,
    "Integrity archive SheetJS hasil unduhan tidak cocok dengan release resmi.",
  );

  const digestHex = createHash("sha512").update(archiveBytes).digest("hex");
  const vendorDirectory = path.join(projectRoot, "vendor");
  mkdirSync(vendorDirectory, { recursive: true });
  writeFileSync(
    path.join(vendorDirectory, `xlsx-${sheetJsVersion}.tgz`),
    archiveBytes,
  );
  writeFileSync(
    path.join(vendorDirectory, `xlsx-${sheetJsVersion}.sha512`),
    `${digestHex}  vendor/xlsx-${sheetJsVersion}.tgz\n`,
    "utf8",
  );

  packageJson.dependencies.xlsx = vendoredDependency;
  packageLock.packages[""].dependencies.xlsx = vendoredDependency;
  lockEntry.resolved = vendoredDependency;
  lockEntry.integrity = actualIntegrity;
  writeJson("package.json", packageJson);
  writeJson("package-lock.json", packageLock);

  const refreshedLock = readJson("package-lock.json");
  const refreshedEntry = refreshedLock.packages?.["node_modules/xlsx"];
  assert(
    refreshedLock.packages?.[""]?.dependencies?.xlsx === vendoredDependency,
    "Root lockfile belum menunjuk archive SheetJS lokal.",
  );
  assert(
    refreshedEntry?.resolved === vendoredDependency,
    `Resolved SheetJS harus ${vendoredDependency}.`,
  );
  assert(
    refreshedEntry?.integrity === officialIntegrity,
    "Integrity archive vendored pada lockfile tidak cocok dengan file resmi.",
  );

  console.log(`SheetJS ${sheetJsVersion} resmi berhasil disimpan di vendor/xlsx-${sheetJsVersion}.tgz.`);
  console.log("Dependency dan package-lock.json telah diarahkan ke archive lokal.");
}

await main();
