// Evaluate a string so Node/tsx never serializes compiler helpers into Chromium.
const RECEIPT_PRINT_READY_SCRIPT = String.raw`(async () => {
  if (!document.querySelector('[data-aj-receipt-stage="true"]')) {
    throw new Error('Halaman nota belum tersedia untuk dicetak.');
  }
  const images = Array.from(document.images);
  await Promise.all(images.map(async (image) => {
    image.loading = 'eager';
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('Foto atau QR nota belum selesai dimuat.');
    }
  }));
  await document.fonts.ready;
  if (Array.from(document.fonts).some((font) => font.status === 'error')) {
    throw new Error('Font nota gagal dimuat.');
  }
})()`;

export async function waitForReceiptPrintReady(page: {
  evaluate: (expression: string) => Promise<unknown>;
}) {
  await page.evaluate(RECEIPT_PRINT_READY_SCRIPT);
}
