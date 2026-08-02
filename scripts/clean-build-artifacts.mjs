import { rmSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const removablePaths = [
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
  "tsconfig.tsbuildinfo",
];

for (const relativePath of removablePaths) {
  rmSync(path.join(projectRoot, relativePath), {
    force: true,
    recursive: true,
  });
}

console.log(`Build artifacts dibersihkan: ${removablePaths.join(", ")}`);
