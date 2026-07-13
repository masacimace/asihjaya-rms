export type SaleCorrectionType = "void" | "refund";
export type DeliveryAnswer = "not_delivered" | "delivered" | "unsure";
export type PaymentAnswer = "received" | "not_received" | "unsure";
export type CustomerPresenceAnswer = "present" | "left" | "unsure";

export type SaleCorrectionEligibility = {
  canRequestCorrection: boolean;
  voidEligibleBySystem: boolean;
  recommendedType: SaleCorrectionType;
  title: string;
  explanation: string;
  blockers: string[];
};

const JAKARTA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function jakartaDateKey(value: Date) {
  return JAKARTA_DATE_FORMATTER.format(value);
}

export function getSaleCorrectionEligibility(input: {
  saleStatus: string;
  shiftStatus: string | null;
  completedAt: Date | null;
  hasReturnCase: boolean;
  now?: Date;
}): SaleCorrectionEligibility {
  const blockers: string[] = [];
  const now = input.now ?? new Date();

  if (input.saleStatus !== "completed") {
    blockers.push("Hanya transaksi yang sudah selesai yang dapat dikoreksi.");
  }

  if (input.hasReturnCase) {
    blockers.push("Transaksi ini sudah memiliki proses retur.");
  }

  const sameBusinessDate = Boolean(
    input.completedAt && jakartaDateKey(input.completedAt) === jakartaDateKey(now),
  );
  const shiftOpen = input.shiftStatus === "open";
  const voidEligibleBySystem =
    blockers.length === 0 && sameBusinessDate && shiftOpen;

  if (!sameBusinessDate && input.saleStatus === "completed") {
    blockers.push("Transaksi berasal dari hari operasional sebelumnya.");
  }

  if (!shiftOpen && input.saleStatus === "completed") {
    blockers.push("Shift transaksi sudah tidak terbuka.");
  }

  return {
    canRequestCorrection: input.saleStatus === "completed" && !input.hasReturnCase,
    voidEligibleBySystem,
    recommendedType: voidEligibleBySystem ? "void" : "refund",
    title: voidEligibleBySystem
      ? "Pembatalan transaksi masih tersedia"
      : "Koreksi harus diproses sebagai retur",
    explanation: voidEligibleBySystem
      ? "Jika barang belum diserahkan, sistem dapat mengajukan pembatalan transaksi. Jika barang sudah diserahkan, sistem akan mengarahkan ke retur dan pengembalian dana."
      : "Karena shift sudah ditutup, transaksi berbeda hari, atau retur sudah berjalan, koreksi tidak dapat diproses sebagai pembatalan biasa.",
    blockers,
  };
}

export function classifySaleCorrection(input: {
  eligibility: SaleCorrectionEligibility;
  deliveryAnswer: DeliveryAnswer;
}): SaleCorrectionType {
  if (
    input.eligibility.voidEligibleBySystem &&
    input.deliveryAnswer === "not_delivered"
  ) {
    return "void";
  }

  return "refund";
}

export const correctionReasonOptions = {
  void: [
    { value: "wrong_item", label: "Salah memilih barang" },
    { value: "wrong_amount", label: "Salah nominal atau diskon" },
    { value: "wrong_payment_method", label: "Salah metode pembayaran" },
    { value: "duplicate_transaction", label: "Transaksi terbuat dua kali" },
    { value: "customer_cancelled", label: "Customer membatalkan di kasir" },
    { value: "other", label: "Lainnya" },
  ],
  refund: [
    { value: "customer_changed_mind", label: "Customer berubah pikiran" },
    { value: "size_not_suitable", label: "Ukuran tidak sesuai" },
    { value: "product_issue", label: "Barang bermasalah" },
    { value: "wrong_product_delivered", label: "Produk yang diberikan tidak sesuai" },
    { value: "transaction_error", label: "Kesalahan transaksi" },
    { value: "other", label: "Lainnya" },
  ],
} as const;

export function getCorrectionReasonLabel(
  type: SaleCorrectionType,
  value: string,
) {
  return correctionReasonOptions[type].find((option) => option.value === value)
    ?.label ?? null;
}
