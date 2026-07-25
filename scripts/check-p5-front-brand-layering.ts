import { readFileSync } from "node:fs";

const receiptTemplate = readFileSync(
  "src/features/sales/documents/receipt-certificate-html.tsx",
  "utf8",
);

const requiredSnippets = [
  ".aj-brand-kicker",
  ".aj-brand-main",
  "Toko Emas",
  "Asih Jaya",
  "aria-label=\"Toko Emas Asih Jaya\"",
  "<div className=\"aj-branch-title\">{data.outlet.name}</div>",
];

const forbiddenSnippets = [
  '<div className="aj-brand-title">Toko Emas Asih Jaya</div>',
];

const missing = requiredSnippets.filter(
  (snippet) => !receiptTemplate.includes(snippet),
);
const forbidden = forbiddenSnippets.filter((snippet) =>
  receiptTemplate.includes(snippet),
);

if (missing.length > 0) {
  throw new Error(
    `Missing receipt brand layering snippets: ${missing.join(", ")}`,
  );
}

if (forbidden.length > 0) {
  throw new Error(
    `Old single-line receipt brand title still exists: ${forbidden.join(", ")}`,
  );
}

console.log("P5 receipt front brand layering checks passed.");
