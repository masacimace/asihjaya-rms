/* eslint-disable */
const path = require("path");
const { switchAdapter } = require("../lib/outlet-operations");

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const device = readArg("device");
  const mode = readArg("mode");
  if (!device || !mode) {
    throw new Error("Usage: node scripts/outlet-adapter-switch.js --device label|document|drawer|all --mode fake|real");
  }

  const result = switchAdapter({ rootDir, device, mode });
  console.log(`[PASS] Adapter ${result.device} diubah ke ${result.mode}.`);
  console.log(`[INFO] Backup .env: ${result.backupPath}`);
  if (result.configCheckOutput) console.log(result.configCheckOutput);
  console.log("[NEXT] Jalankan npm start atau restart Scheduled Task, lalu npm run health.");
}

try {
  main();
} catch (error) {
  console.error(`[BLOCKED] ${error.message}`);
  process.exitCode = 1;
}
