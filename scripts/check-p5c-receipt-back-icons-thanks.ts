import { readFileSync } from "node:fs";

const receiptPath = "src/features/sales/documents/receipt-certificate-html.tsx";
const source = readFileSync(receiptPath, "utf8");

const requiredSnippets = [
  "type BackSectionIconName =",
  "function BackSectionIcon",
  "function BackSectionTitle",
  "aj-back-section-icon",
  "icon=\"terms\"",
  "icon=\"care\"",
  "icon=\"services\"",
  "aj-back-thanks-card",
  "Terimakasih",
  "Telah berbelanja di Toko Emas Asih Jaya",
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Missing receipt back page icon/thanks snippet: ${snippet}`);
  }
}

if (source.includes(".aj-back-section-title::before")) {
  throw new Error("Back page section titles should use icons, not the old pseudo-line marker.");
}

console.log("P5-C receipt back page icons and thanks checks passed.");
