import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const EXPECTED_HEAD = "6933bcf56f9117941b6f26f6f3b5d0002eb4ba6e";
const PATCH_NAME = process.argv[2] ?? "quick-create-category-color.patch";
const root = process.cwd();
const patchPath = path.resolve(root, PATCH_NAME);

function runGit(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fail(message) {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

let head;
try {
  head = runGit(["rev-parse", "HEAD"]);
} catch {
  fail("Jalankan script ini dari root repository Git asihjaya-rms.");
}

if (head !== EXPECTED_HEAD) {
  fail(`HEAD harus ${EXPECTED_HEAD.slice(0, 7)}, tetapi saat ini ${head.slice(0, 7)}.`);
}

const status = runGit(["status", "--porcelain"]);
if (status) {
  fail("Working tree harus bersih sebelum menerapkan revisi. Commit/stash perubahan lain terlebih dahulu.");
}

if (!existsSync(patchPath)) {
  fail(`Patch tidak ditemukan: ${patchPath}`);
}

const patch = readFileSync(patchPath, "utf8").replace(/\r\n/g, "\n");
const lines = patch.split("\n");
const files = [];
let current = null;
let currentHunk = null;

function finishHunk() {
  if (!currentHunk || !current) return;
  current.hunks.push(currentHunk);
  currentHunk = null;
}

function finishFile() {
  finishHunk();
  if (current) files.push(current);
  current = null;
}

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];

  if (line.startsWith("diff --git ")) {
    finishFile();
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (!match || match[1] !== match[2]) {
      fail(`Diff path tidak didukung pada baris ${i + 1}.`);
    }
    current = { path: match[1], isNew: false, hunks: [] };
    continue;
  }

  if (!current) continue;

  if (line === "new file mode 100644") {
    current.isNew = true;
    continue;
  }

  if (line.startsWith("@@ ")) {
    finishHunk();
    currentHunk = { header: line, lines: [] };
    continue;
  }

  if (currentHunk) {
    if (
      line.startsWith(" ") ||
      line.startsWith("+") ||
      line.startsWith("-") ||
      line === "\\ No newline at end of file"
    ) {
      currentHunk.lines.push(line);
    }
  }
}
finishFile();

if (files.length === 0) fail("Patch tidak berisi perubahan file.");

const outputs = new Map();

for (const file of files) {
  const absolutePath = path.join(root, file.path);
  let original = "";
  let lineEnding = "\n";

  if (file.isNew) {
    if (existsSync(absolutePath)) {
      fail(`File baru sudah ada: ${file.path}`);
    }
  } else {
    if (!existsSync(absolutePath)) {
      fail(`File target tidak ditemukan: ${file.path}`);
    }
    const raw = readFileSync(absolutePath, "utf8");
    lineEnding = raw.includes("\r\n") ? "\r\n" : "\n";
    original = raw.replace(/\r\n/g, "\n");
  }

  let content = original;

  for (const hunk of file.hunks) {
    const oldParts = [];
    const newParts = [];

    for (const hunkLine of hunk.lines) {
      if (hunkLine === "\\ No newline at end of file") continue;
      const marker = hunkLine[0];
      const body = hunkLine.slice(1);
      if (marker === " " || marker === "-") oldParts.push(body);
      if (marker === " " || marker === "+") newParts.push(body);
    }

    const oldText = oldParts.join("\n");
    const newText = newParts.join("\n");

    if (file.isNew && oldText === "") {
      if (content !== "") {
        fail(`Patch file baru ${file.path} memiliki lebih dari satu hunk yang tidak didukung.`);
      }
      content = newText;
      if (!content.endsWith("\n")) content += "\n";
      continue;
    }

    const first = content.indexOf(oldText);
    if (first < 0) {
      fail(`Context tidak ditemukan untuk ${file.path} ${hunk.header}. Tidak ada file yang ditulis.`);
    }
    const second = content.indexOf(oldText, first + Math.max(1, oldText.length));
    if (second >= 0) {
      fail(`Context ambigu untuk ${file.path} ${hunk.header}. Tidak ada file yang ditulis.`);
    }

    content = content.slice(0, first) + newText + content.slice(first + oldText.length);
  }

  outputs.set(file.path, {
    content: lineEnding === "\r\n" ? content.replace(/\n/g, "\r\n") : content,
  });
}

// Semua hunk sudah tervalidasi di memory. Baru sekarang tulis ke working tree.
for (const [relativePath, output] of outputs) {
  const absolutePath = path.join(root, relativePath);
  writeFileSync(absolutePath, output.content, "utf8");
}

console.log(`OK: ${outputs.size} file source berhasil diperbarui dari baseline ${EXPECTED_HEAD.slice(0, 7)}.`);
console.log("\nFile berubah:");
console.log(runGit(["status", "--short"]));
console.log("\nLanjutkan dengan:");
console.log("  npm run lint");
console.log("  npm run typecheck");
console.log("  npx tsx scripts/check-buyback-b3-processing.ts");
