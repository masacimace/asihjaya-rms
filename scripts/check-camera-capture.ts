import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getSquareCameraCrop } from "../src/components/media/camera-capture-geometry";

const cases = [
  { width: 1920, height: 1080, x: 420, y: 0, size: 1080, output: 1080 },
  { width: 1080, height: 1920, x: 0, y: 420, size: 1080, output: 1080 },
  { width: 4000, height: 3000, x: 500, y: 0, size: 3000, output: 1600 },
  { width: 3000, height: 4000, x: 0, y: 500, size: 3000, output: 1600 },
  { width: 1600, height: 1600, x: 0, y: 0, size: 1600, output: 1600 },
  { width: 320, height: 240, x: 40, y: 0, size: 240, output: 240 },
  { width: 641, height: 480, x: 80.5, y: 0, size: 480, output: 480 },
];

for (const { width, height, x, y, size, output } of cases) {
  assert.deepEqual(getSquareCameraCrop(width, height, 1600), {
    sourceX: x,
    sourceY: y,
    sourceSize: size,
    outputSize: output,
  }, `${width}x${height}: crop harus persegi, di tengah, dan tanpa memperbesar sumber.`);
}

const root = process.cwd();
const camera = readFileSync(path.join(root, "src/components/media/camera-capture-modal.tsx"), "utf8");
assert.match(camera, /data-camera-preview="square"/);
assert.match(camera, /data-camera-guide="square"/);
assert.match(camera, /Foto 1:1/);
assert.match(camera, /size-full object-cover object-center/);
assert.match(camera, /canvas\.width = outputSize;\s*canvas\.height = outputSize;/);
assert.match(camera, /context\.drawImage\(\s*video,\s*sourceX,\s*sourceY,\s*sourceSize,\s*sourceSize,\s*0,\s*0,\s*outputSize,\s*outputSize,?\s*\)/);

for (const relativePath of [
  "src/components/media/single-image-input.tsx",
  "src/components/buybacks/buyback-workspace.tsx",
  "src/components/buybacks/buyback-processing-workspace.tsx",
]) {
  const source = readFileSync(path.join(root, relativePath), "utf8");
  assert.match(source, /<CameraCaptureModal/, `${relativePath}: gunakan kamera persegi bersama.`);
}

console.log("PASS: Kamera produk, Buyback, dan pemrosesan memakai panduan 1:1 serta crop persegi sesuai preview.");
