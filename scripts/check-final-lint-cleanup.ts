import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  if (!existsSync(file)) throw new Error(`${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const processing = read(
  "src/components/buybacks/buyback-processing-workspace.tsx",
);
const buyback = read("src/components/buybacks/buyback-workspace.tsx");
const pricing = read(
  "src/components/pos/workspace/pos-item-pricing-dialog.tsx",
);
const catalog = read("src/features/pos/use-pos-catalog.ts");
const posActions = read("src/app/actions/pos.ts");
const processingService = read(
  "src/features/buybacks/processing-service.ts",
);
const checkout = read("src/features/pos/use-pos-checkout.ts");

assert(
  processing.includes("const suggestedPricePerGram = suggestedRate") &&
    processing.includes("const pricePerGram = priceTouched") &&
    !processing.includes(
      'setPricePerGram(suggestedRate ? formatRupiahInput(suggestedRate) : "")',
    ),
  "Buyback processing derived-price cleanup belum lengkap.",
);

assert(
  buyback.includes("queueMicrotask(() => {") &&
    buyback.includes("setItems([]);"),
  "Buyback success reset scheduling belum lengkap.",
);

assert(
  pricing.includes("function PosItemPricingDialogContent(") &&
    pricing.includes("<PosItemPricingDialogContent key={resetKey}") &&
    !pricing.includes("useEffect(") &&
    !pricing.includes("useMemo("),
  "POS item pricing dialog cleanup belum lengkap.",
);

assert(
  catalog.includes("loadPageRef.current = loadPage;") &&
    catalog.includes("}, [loadPage]);") &&
    (catalog.match(/queueMicrotask\(\(\) => \{/g) ?? []).length >= 2,
  "POS catalog React hook cleanup belum lengkap.",
);

for (const marker of ["  gt,\n", "  gte,\n", "  isNotNull,\n"]) {
  assert(!posActions.includes(marker), `Unused POS import masih ada: ${marker}`);
}

assert(
  !processingService.includes("type ProcessingTransaction =") &&
    !processingService.includes("and, eq, sql"),
  "Processing service unused cleanup belum lengkap.",
);

assert(
  checkout.includes(`    [
      applyCheckoutSuccess,
      getRecoveryStatus,
      setPaymentFeedback,
      waitForRecovery,
    ],`),
  "recoverCheckoutAttempt masih memiliki dependency invalidate yang tidak dipakai.",
);

assert(
  checkout.includes(`    [
      applyCheckoutSuccess,
      checkoutAttempt,
      completeCheckout,
      invalidateCheckoutAttempt,
      recoverCheckoutAttempt,
      setPaymentFeedback,
    ],`),
  "processCheckout kehilangan dependency invalidateCheckoutAttempt yang masih diperlukan.",
);

console.log(
  "OK: targeted lint cleanup structure valid. Lanjutkan dengan npm run lint.",
);
