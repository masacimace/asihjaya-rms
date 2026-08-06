import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const scannerPath = path.join(
  process.cwd(),
  "src/components/scanner/camera-scanner-modal.tsx",
);
const scannerSource = readFileSync(scannerPath, "utf8");

const requiredContracts = [
  "function CameraScannerViewport",
  "function CameraScannerDialog",
  "paused: isPaused",
  'facingMode: { ideal: "environment" }',
  "result.rawValue?.trim()",
  "autoPlay",
  "muted",
  "playsInline",
  "trySkew: true",
  "Camera scanner error:",
  "Coba kamera lagi",
  "if (!isOpen)",
];

for (const contract of requiredContracts) {
  assert.ok(
    scannerSource.includes(contract),
    `Camera scanner wajib memiliki kontrak ${contract}.`,
  );
}

assert.ok(
  scannerSource.indexOf("function CameraScannerViewport") <
    scannerSource.indexOf("function CameraScannerDialog") &&
    scannerSource.indexOf("function CameraScannerDialog") <
      scannerSource.indexOf("export function CameraScannerModal"),
  "State dan hook kamera wajib berada di dialog yang hanya dimount ketika modal terbuka.",
);

assert.doesNotMatch(
  scannerSource,
  /useEffect\(\(\) => \{\s*if \(isOpen\)/,
  "Pembukaan scanner tidak boleh mereset state secara sinkron di dalam effect.",
);

console.log(
  "OK: camera scanner memulai kamera saat modal dibuka, memakai kamera belakang, menangani lifecycle stream, dan menyediakan error recovery mobile.",
);
