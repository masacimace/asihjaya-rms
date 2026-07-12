import "dotenv/config";

import { and, eq, isNull, lt } from "drizzle-orm";

import { db, pool } from "../src/db";
import { paymentEvidenceUploads } from "../src/db/schema";
import { deletePaymentEvidenceFile } from "../src/lib/storage/payment-evidence-storage";

const batchSize = 200;

async function main() {
  let deletedCount = 0;
  let failedCount = 0;

  while (true) {
    const expiredRows = await db
      .select({
        id: paymentEvidenceUploads.id,
        storageKey: paymentEvidenceUploads.storageKey,
      })
      .from(paymentEvidenceUploads)
      .where(
        and(
          isNull(paymentEvidenceUploads.saleId),
          lt(paymentEvidenceUploads.expiresAt, new Date()),
        ),
      )
      .limit(batchSize);

    if (expiredRows.length === 0) break;

    for (const row of expiredRows) {
      try {
        await deletePaymentEvidenceFile(row.storageKey);
        await db
          .delete(paymentEvidenceUploads)
          .where(
            and(
              eq(paymentEvidenceUploads.id, row.id),
              isNull(paymentEvidenceUploads.saleId),
            ),
          );
        deletedCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error(
          `[FAILED] ${row.id} ${row.storageKey}`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (failedCount > 0 || expiredRows.length < batchSize) break;
  }

  console.log(
    `Payment evidence cleanup selesai. deleted=${deletedCount} failed=${failedCount}`,
  );

  if (failedCount > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error("Payment evidence cleanup tidak dapat dijalankan.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
