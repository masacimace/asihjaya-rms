import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function assertIncludes(file: string, snippet: string) {
  const content = read(file);

  if (!content.includes(snippet)) {
    throw new Error(`${file} tidak berisi snippet wajib: ${snippet}`);
  }
}

assertIncludes(
  ".env.example",
  "RECEIPT_DOCUMENT_PROFILE_ID=receipt_a4_landscape_v1",
);
assertIncludes(
  "src/features/sales/documents/receipt-document-profiles.ts",
  "RECEIPT_DOCUMENT_PROFILE_ENV_KEY",
);
assertIncludes(
  "src/features/sales/documents/receipt-document-profiles.ts",
  "getConfiguredReceiptDocumentProfileId",
);
assertIncludes(
  "src/features/sales/documents/receipt-document-profiles.ts",
  "getConfiguredReceiptDocumentProfile",
);
assertIncludes(
  "src/lib/hardware/job-payload-contracts-v2.ts",
  "input.documentProfileId ?? getConfiguredReceiptDocumentProfileId()",
);
assertIncludes(
  "src/app/api/sales/[saleId]/receipt-certificate/route.ts",
  ": getConfiguredReceiptDocumentProfileId();",
);
assertIncludes(
  "src/app/api/sales/receipt-certificate-preview/route.ts",
  ": getConfiguredReceiptDocumentProfileId();",
);
assertIncludes(
  "src/app/documents/sales/[saleId]/receipt-certificate-html/page.tsx",
  "query.profile ?? getConfiguredReceiptDocumentProfileId()",
);
assertIncludes(
  "src/app/documents/sales/receipt-certificate-preview-html/page.tsx",
  "query.profile ?? getConfiguredReceiptDocumentProfileId()",
);
assertIncludes(
  "src/app/(admin)/admin/penjualan/[transactionId]/page.tsx",
  "Profile nota",
);
assertIncludes(
  "src/app/(admin)/admin/penjualan/[transactionId]/page.tsx",
  "receiptDocumentProfile.paper.toLowerCase()",
);
assertIncludes(
  "src/app/(admin)/admin/penjualan/preview-nota/page.tsx",
  "getConfiguredReceiptDocumentProfile()",
);

console.log("P6-D receipt profile runtime config checks passed.");
