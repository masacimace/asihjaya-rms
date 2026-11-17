import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { requestScannerAutoFocus } from "../src/components/scanner/camera-focus";

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

assert.ok(scannerSource.includes("width: { ideal: 1920 }") && scannerSource.includes("height: { ideal: 1080 }"));
assert.ok(scannerSource.includes("requestScannerAutoFocus(track)"));
const focusCalls: MediaTrackConstraints[] = [];
const makeTrack = (overrides: Record<string, unknown> = {}) => ({
  readyState: "live", getCapabilities: () => ({ focusMode: ["manual", "continuous"] }),
  applyConstraints: async (constraints: MediaTrackConstraints) => { focusCalls.push(constraints); },
  ...overrides,
} as unknown as MediaStreamTrack);
await requestScannerAutoFocus(makeTrack());
assert.deepEqual(focusCalls, [{ advanced: [{ focusMode: "continuous" }] }]);
focusCalls.length = 0;
await requestScannerAutoFocus(makeTrack({ readyState: "ended" }));
await requestScannerAutoFocus(makeTrack({ getCapabilities: () => ({ focusMode: ["manual"] }) }));
await requestScannerAutoFocus(makeTrack({ getCapabilities: undefined }));
await requestScannerAutoFocus(makeTrack({ getCapabilities: () => { throw new Error("Unsupported capability query"); } }));
assert.equal(focusCalls.length, 0, "Unsupported / closed cameras must keep their existing focus settings.");
await requestScannerAutoFocus(makeTrack({ applyConstraints: async () => { throw new Error("Autofocus rejected"); } }));

console.log(
  "OK: camera scanner memulai kamera saat modal dibuka, memakai kamera belakang, menangani lifecycle stream, dan menyediakan error recovery mobile.",
);
