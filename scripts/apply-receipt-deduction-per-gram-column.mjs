import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content, "utf8");
}

function ensureIncludes(path, anchor) {
  const content = read(path);
  if (!content.includes(anchor)) {
    throw new Error(`Anchor tidak ditemukan di ${path}: ${anchor}`);
  }
  return content;
}

function insertAfter(path, anchor, insertion, duplicateNeedle = insertion.trim()) {
  let content = ensureIncludes(path, anchor);
  if (content.includes(duplicateNeedle)) {
    return false;
  }
  content = content.replace(anchor, `${anchor}${insertion}`);
  write(path, content);
  return true;
}

function replaceExact(path, from, to, alreadyNeedle = to.trim()) {
  let content = read(path);
  if (content.includes(alreadyNeedle)) {
    return false;
  }
  if (!content.includes(from)) {
    throw new Error(`Pattern tidak ditemukan di ${path}: ${from}`);
  }
  content = content.replace(from, to);
  write(path, content);
  return true;
}

function replaceRegex(path, regex, replacer, duplicateNeedle) {
  let content = read(path);
  if (duplicateNeedle && content.includes(duplicateNeedle)) {
    return false;
  }
  if (!regex.test(content)) {
    throw new Error(`Regex tidak cocok di ${path}: ${regex}`);
  }
  content = content.replace(regex, replacer);
  write(path, content);
  return true;
}

const receiptDataPath = "src/features/sales/documents/receipt-certificate.ts";
const receiptHtmlPath = "src/features/sales/documents/receipt-certificate-html.tsx";
const receiptSamplePath = "src/features/sales/documents/receipt-certificate-sample-data.ts";
const posActionPath = "src/app/actions/pos.ts";

// 1) Persist potongan per gram into new sale item snapshots.
insertAfter(
  posActionPath,
  "          sellingAmount: productItems.sellingAmount,\n",
  "          deductionPerGram: productItems.deductionPerGram,\n",
  "deductionPerGram: productItems.deductionPerGram",
);

insertAfter(
  posActionPath,
  "              sellingAmount: item!.sellingAmount,\n",
  "              deductionPerGram: item!.deductionPerGram,\n",
  "deductionPerGram: item!.deductionPerGram",
);

// 2) Teach receipt data loader to read snapshot and fallback to current product item value.
insertAfter(
  receiptDataPath,
  "  sellingAmount?: string | null;\n",
  "  deductionPerGram?: string | null;\n",
  "deductionPerGram?: string | null",
);

insertAfter(
  receiptDataPath,
  "    sellingAmount: readString(\"sellingAmount\"),\n",
  "    deductionPerGram: readString(\"deductionPerGram\"),\n",
  "deductionPerGram: readString(\"deductionPerGram\")",
);

insertAfter(
  receiptDataPath,
  "      snapshot: saleItems.snapshot,\n",
  "      itemDeductionPerGram: productItems.deductionPerGram,\n",
  "itemDeductionPerGram: productItems.deductionPerGram",
);

insertAfter(
  receiptDataPath,
  "          productImageKey: snapshot.productImageKey ?? item.productImageKey,\n",
  "          deductionPerGram: snapshot.deductionPerGram ?? item.itemDeductionPerGram,\n",
  "deductionPerGram: snapshot.deductionPerGram ?? item.itemDeductionPerGram",
);

// 3) Add column and renderer to the receipt/certificate HTML.
replaceExact(
  receiptHtmlPath,
  "    grid-template-columns: 18mm 22mm 1fr 16mm 18mm 32mm;",
  "    grid-template-columns: 18mm 22mm 1fr 16mm 18mm 24mm 28mm;",
  "grid-template-columns: 18mm 22mm 1fr 16mm 18mm 24mm 28mm;",
);

replaceRegex(
  receiptHtmlPath,
  /(  \.aj-gram \{[\s\S]*?  \}\n)/,
  `$1\n  .aj-deduction {\n    color: var(--maroon);\n    font-size: 6.4pt;\n    font-weight: 900;\n    text-align: center;\n    white-space: nowrap;\n  }\n`,
  ".aj-deduction",
);

insertAfter(
  receiptHtmlPath,
  `function formatNegativeAmount(value: string | number | null | undefined) {\n  const amount = toNumber(value);\n\n  if (amount <= 0) {\n    return formatAmount(0);\n  }\n\n  return \`-\${formatAmount(amount)}\`;\n}\n`,
  `\nfunction formatDeductionPerGram(value: string | number | null | undefined) {\n  const amount = toNumber(value);\n\n  if (amount <= 0) {\n    return \"-\";\n  }\n\n  return formatAmount(amount);\n}\n`,
  "function formatDeductionPerGram",
);

insertAfter(
  receiptHtmlPath,
  "                <div>GRAM</div>\n",
  "                <div>POTONGAN /GRAM</div>\n",
  "POTONGAN /GRAM",
);

insertAfter(
  receiptHtmlPath,
  `                  <div className="aj-gram">\n                    {formatGram(item.snapshot.weightGram)}\n                  </div>\n`,
  `                  <div className="aj-deduction">\n                    {formatDeductionPerGram(item.snapshot.deductionPerGram)}\n                  </div>\n`,
  "formatDeductionPerGram(item.snapshot.deductionPerGram)",
);

// 4) Make preview/mockup data show the new column.
const sampleContent = read(receiptSamplePath);
if (!sampleContent.includes("deductionPerGram")) {
  let nextSample = sampleContent
    .replace('        sellingAmount: "3685000",', '        sellingAmount: "3685000",\n        deductionPerGram: "50000",')
    .replace('        sellingAmount: "2150000",', '        sellingAmount: "2150000",\n        deductionPerGram: "35000",')
    .replace('        sellingAmount: "1350000",', '        sellingAmount: "1350000",\n        deductionPerGram: "25000",');

  if (nextSample === sampleContent) {
    throw new Error(`Sample data tidak berubah. Cek manual file ${receiptSamplePath}.`);
  }

  write(receiptSamplePath, nextSample);
}

console.log("Receipt Potongan /Gram column berhasil diterapkan.");
