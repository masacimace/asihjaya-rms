import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  HARDWARE_SETUP_GUIDE_VERSION,
  hardwareSetupFinalChecklist,
  hardwareSetupGuideSections,
} from "../src/features/hardware/setup-guide";

async function read(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main() {
  assert.ok(hardwareSetupGuideSections.length >= 14);
  assert.ok(hardwareSetupFinalChecklist.length >= 8);
  assert.match(HARDWARE_SETUP_GUIDE_VERSION, /^\d+\.\d+\.\d+-pr10$/);

  const page = await read("src/app/(admin)/admin/operasional/hardware/setup-guide/page.tsx");
  const client = await read("src/components/hardware/setup-guide-client.tsx");
  const dashboard = await read("src/app/(admin)/admin/operasional/hardware/page.tsx");
  const docs = await read("docs/hardware-hub/windows-setup-guide.md");
  const hubPackage = JSON.parse(await read("hardware-hub/package.json")) as {
    scripts: Record<string, string>;
  };

  assert.match(page, /HardwareSetupGuideClient/);
  assert.match(page, /getHardwareHubDashboard/);
  assert.match(client, /localStorage/);
  assert.match(client, /navigator\.clipboard/);
  assert.match(dashboard, /\/admin\/operasional\/hardware\/setup-guide/);
  assert.match(docs, new RegExp(HARDWARE_SETUP_GUIDE_VERSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const command of [
    "outlet:preflight",
    "outlet:fixtures",
    "outlet:enable-real-label",
    "outlet:enable-real-document",
    "outlet:rollback-to-fake",
    "outlet:report",
    "check:outlet",
  ]) {
    assert.ok(hubPackage.scripts[command], `Missing hardware-hub script ${command}`);
  }

  const envTemplate = await read("hardware-hub/.env.outlet.example");
  assert.match(envTemplate, /LABEL_PRINTER_ADAPTER=fake/);
  assert.match(envTemplate, /DOCUMENT_PRINTER_ADAPTER=fake/);
  assert.match(envTemplate, /CASH_DRAWER_ADAPTER=fake/);

  console.log("[PASS] Setup guide page, search, copy, and browser checklist are wired.");
  console.log("[PASS] Web guide exposes live Hardware Hub operational summary.");
  console.log("[PASS] Outlet scripts and safe fake defaults are present.");
  console.log("[PASS] Generated Markdown guide matches PR 10 version.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
