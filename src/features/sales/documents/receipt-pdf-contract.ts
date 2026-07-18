import type { ReceiptDocumentProfile } from "./receipt-document-profiles";

const PDF_HEADER = "%PDF-";
const MAX_RECEIPT_PAGE_COUNT = 100;
const POINT_TOLERANCE = 3;

export type ReceiptPdfContract = {
  pageCount: number;
  mediaBoxes: Array<{
    width: number;
    height: number;
  }>;
};

function parseMediaBoxes(pdfText: string) {
  const boxes: ReceiptPdfContract["mediaBoxes"] = [];
  const pattern =
    /\/MediaBox\s*\[\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\]/g;

  for (const match of pdfText.matchAll(pattern)) {
    const x1 = Number(match[1]);
    const y1 = Number(match[2]);
    const x2 = Number(match[3]);
    const y2 = Number(match[4]);
    if ([x1, y1, x2, y2].every(Number.isFinite)) {
      boxes.push({
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      });
    }
  }

  return boxes;
}

function approximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) <= POINT_TOLERANCE;
}

export function validateReceiptPdfBuffer(
  buffer: Buffer,
  profile: ReceiptDocumentProfile,
): ReceiptPdfContract {
  if (buffer.length < PDF_HEADER.length) {
    throw new Error("PDF receipt kosong atau terlalu kecil.");
  }

  const header = buffer.subarray(0, 8).toString("ascii");
  if (!header.startsWith(PDF_HEADER)) {
    throw new Error("PDF receipt tidak memiliki header %PDF yang valid.");
  }

  const pdfText = buffer.toString("latin1");
  const pageCount = (pdfText.match(/\/Type\s*\/Page\b/g) ?? []).length;
  if (pageCount < 1 || pageCount > MAX_RECEIPT_PAGE_COUNT) {
    throw new Error(
      `Jumlah halaman PDF receipt tidak valid: ${pageCount || 0}.`,
    );
  }

  const mediaBoxes = parseMediaBoxes(pdfText);
  if (mediaBoxes.length === 0) {
    throw new Error("MediaBox PDF receipt tidak ditemukan.");
  }

  const expected = profile.expectedPdfPoints;
  const mismatch = mediaBoxes.find(
    (box) =>
      !approximatelyEqual(box.width, expected.width) ||
      !approximatelyEqual(box.height, expected.height),
  );

  if (mismatch) {
    throw new Error(
      `Ukuran halaman PDF tidak sesuai ${profile.paper} ${profile.orientation}: ` +
        `${mismatch.width.toFixed(2)}x${mismatch.height.toFixed(2)} pt.`,
    );
  }

  return {
    pageCount,
    mediaBoxes,
  };
}
