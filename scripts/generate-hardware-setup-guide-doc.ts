import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  HARDWARE_SETUP_GUIDE_VERSION,
  hardwareSetupFinalChecklist,
  hardwareSetupGuideSections,
} from "../src/features/hardware/setup-guide";

function render() {
  const lines: string[] = [
    "# Hardware Hub Windows Setup Guide",
    "",
    `**Version:** ${HARDWARE_SETUP_GUIDE_VERSION}`,
    "",
    "Sumber utama panduan ini juga dirender di `/admin/operasional/hardware/setup-guide`.",
    "",
    "> Mulai selalu dari fake adapter. Aktifkan hardware real satu perangkat pada satu waktu dan jangan menghapus SQLite execution journal ketika troubleshooting.",
    "",
  ];

  for (const section of hardwareSetupGuideSections) {
    lines.push(`## ${section.title}`, "", section.summary, "");
    for (const step of section.steps) {
      lines.push(`### ${step.title}`, "");
      for (const paragraph of step.body) lines.push(paragraph, "");
      for (const command of step.commands ?? []) {
        if (command.label) lines.push(`**${command.label}**`, "");
        lines.push("```powershell", command.code, "```", "");
      }
      if (step.checks?.length) {
        for (const check of step.checks) lines.push(`- [ ] ${check}`);
        lines.push("");
      }
      if (step.callout) {
        lines.push(`> **${step.callout.title}:** ${step.callout.body}`, "");
      }
    }
  }

  lines.push("## Final outlet checklist", "");
  for (const check of hardwareSetupFinalChecklist) lines.push(`- [ ] ${check}`);
  lines.push("");
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

async function main() {
  const output = path.resolve(process.cwd(), "docs/hardware-hub/windows-setup-guide.md");
  await writeFile(output, render(), "utf8");
  console.log(`Generated ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
