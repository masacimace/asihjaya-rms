import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getReturnInspectionPhotoUrl } from "@/lib/storage/return-inspection-storage";

async function main() {
  const organizationId = "11111111-1111-4111-8111-111111111111";
  const photoId = "22222222-2222-4222-8222-222222222222";
  const photoKey = `organizations/${organizationId}/return-inspection/${photoId}.webp`;
  assert.equal(
    getReturnInspectionPhotoUrl(photoKey),
    `/media/return-inspection/organizations/${organizationId}/return-inspection/${photoId}.webp`,
  );
  assert.equal(getReturnInspectionPhotoUrl("invalid-key"), null);

  const authorization = await readFile(
    "src/features/returns/authorization.ts",
    "utf8",
  );
  const transactionService = await readFile(
    "src/features/sales/transaction-service.ts",
    "utf8",
  );
  const returnService = await readFile(
    "src/features/returns/transaction-service.ts",
    "utf8",
  );
  const schema = await readFile("src/db/schema/index.ts", "utf8");

  assert.match(authorization, /returns\.view/);
  assert.match(authorization, /returns\.receive/);
  assert.match(authorization, /returns\.inspect/);
  assert.match(transactionService, /input\.kind === "void"/);
  assert.match(transactionService, /insert\(saleReturnCases\)/);
  assert.match(transactionService, /status: "awaiting_receipt"/);
  assert.match(returnService, /availability: "inspection"/);
  assert.match(
    returnService,
    /eq\(saleReturnItems\.status, "awaiting_receipt"\)/,
  );
  assert.match(
    returnService,
    /eq\(saleReturnItems\.status, "pending_inspection"\)/,
  );
  assert.match(returnService, /WEIGHT_TOLERANCE_GRAM = 0\.01/);
  assert.match(schema, /export const saleReturnCases = pgTable/);
  assert.match(schema, /export const saleReturnItems = pgTable/);
  assert.match(schema, /"inspection",/);

  console.log("P1-B refund and return inspection workflow checks passed.");
}

main().catch((error: unknown) => {
  console.error("P1-B return workflow checks failed.", error);
  process.exitCode = 1;
});
