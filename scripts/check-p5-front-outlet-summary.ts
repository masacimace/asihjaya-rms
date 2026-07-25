import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/features/sales/documents/receipt-certificate-html.tsx",
  "utf8",
);

const requiredSnippets = [
  '<span>Outlet :</span>',
  'aj-summary-value aj-summary-value-compact',
  '{data.outlet.name}',
  '.aj-summary-value-compact',
  'overflow-wrap: anywhere;',
  '<div className="aj-brand-kicker">Toko Emas</div>',
  '<div className="aj-brand-main">Asih Jaya</div>',
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));

if (missing.length > 0) {
  throw new Error(`Missing receipt outlet summary snippets: ${missing.join(", ")}`);
}

const salesIndex = source.indexOf('<span>Sales :</span>');
const outletIndex = source.indexOf('<span>Outlet :</span>');

if (salesIndex === -1 || outletIndex === -1 || outletIndex < salesIndex) {
  throw new Error("Outlet summary row must appear below the Sales row.");
}

console.log("P5 front outlet summary checks passed.");
