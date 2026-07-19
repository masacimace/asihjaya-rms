/* eslint-disable */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  resolveSatoProfileConfiguration,
  SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1,
} = require("../lib/sato-label-profiles");

try {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
} catch {}

const ESC = "\x1B";

function timestamp(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function pdfEscape(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createSimplePdf({ pages, width = 841.89, height = 595.28 }) {
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageRecords = [];
  for (const page of pages) {
    const stream = page.join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject("");
    pageRecords.push({ pageId, contentId });
  }
  const pagesId = addObject("");
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  for (const record of pageRecords) {
    objects[record.pageId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${record.contentId} 0 R >>`;
  }
  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageRecords.length} /Kids [${pageRecords.map((record) => `${record.pageId} 0 R`).join(" ")}] >>`;

  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "latin1");
}

function text(x, y, size, value, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`;
}

function line(x1, y1, x2, y2, width = 0.5) {
  return `${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function createEpsonFixturePdf() {
  const width = 841.89;
  const height = 595.28;
  const marginPoints = [0, 14.17, 28.35, 42.52, 56.69];
  const page1 = [
    "0 G 0 g",
    line(1, 1, width - 1, 1, 1),
    line(width - 1, 1, width - 1, height - 1, 1),
    line(width - 1, height - 1, 1, height - 1, 1),
    line(1, height - 1, 1, 1, 1),
    text(40, height - 45, 18, "ASIHJAYA EPSON A4 LANDSCAPE VALIDATION", true),
    text(40, height - 70, 10, "Expected: A4 landscape, fit, no clipping, straight borders."),
  ];
  for (const margin of marginPoints) {
    page1.push(line(margin + 1, margin + 1, width - margin - 1, margin + 1));
    page1.push(line(width - margin - 1, margin + 1, width - margin - 1, height - margin - 1));
    page1.push(line(width - margin - 1, height - margin - 1, margin + 1, height - margin - 1));
    page1.push(line(margin + 1, height - margin - 1, margin + 1, margin + 1));
    page1.push(text(margin + 5, margin + 7, 7, `${Math.round(margin / 2.835)} mm`));
  }
  for (let x = 80; x < width - 40; x += 40) page1.push(line(x, 80, x, height - 100, 0.2));
  for (let y = 80; y < height - 80; y += 40) page1.push(line(60, y, width - 60, y, 0.2));
  page1.push(text(60, 50, 9, "Record physical printable margin and driver scaling in acceptance-report.md."));

  const page2 = [
    text(40, height - 45, 18, "TYPOGRAPHY, COLOR, AND LONG RECEIPT FIXTURE", true),
    text(40, height - 80, 8, "8pt: Cincin Emas 75% - Berat 2.350g - Rp3.500.000"),
    text(40, height - 105, 10, "10pt: Gelang Emas Kuning dengan nama produk panjang"),
    text(40, height - 135, 12, "12pt: ASIHJAYA JEWELRY RECEIPT"),
    "0.9 0 0 rg 40 360 160 50 re f",
    "0 0.7 0 rg 220 360 160 50 re f",
    "0 0.2 0.9 rg 400 360 160 50 re f",
    "0.2 0.2 0.2 rg 580 360 160 50 re f",
    "0 g",
  ];
  let y = 330;
  for (let index = 1; index <= 18; index += 1) {
    page2.push(text(45, y, 8, `${String(index).padStart(2, "0")}. ITEM-${String(index).padStart(3, "0")}  Berat ${(1 + index / 10).toFixed(3)}g  Rp${(250000 * index).toLocaleString("id-ID")}`));
    y -= 14;
  }
  page2.push(text(40, 45, 9, "PASS when all rows, footer, color blocks, and page orientation are visible."));
  return createSimplePdf({ pages: [page1, page2], width, height });
}

function createSatoAlignmentFixture(configuration) {
  const width = configuration.mediaWidthDots;
  const height = configuration.mediaHeightDots;
  const h = (value) => String(Math.max(0, Math.min(width, value))).padStart(4, "0");
  const v = (value) => String(Math.max(0, Math.min(height, value))).padStart(4, "0");
  const commands = [`${ESC}A`];
  commands.push(`${ESC}H${h(10)}${ESC}V${v(20)}${ESC}L0101${ESC}XSASIHJAYA SATO ALIGNMENT`);
  commands.push(`${ESC}H${h(10)}${ESC}V${v(45)}${ESC}L0101${ESC}XSPROFILE ${configuration.profile.id}`);
  commands.push(`${ESC}H${h(10)}${ESC}V${v(70)}${ESC}L0101${ESC}XSMEDIA ${width}x${height} DOTS`);
  for (let x = 10; x < width - 10; x += 50) {
    commands.push(`${ESC}H${h(x)}${ESC}V${v(95)}${ESC}L0101${ESC}XS|${x}`);
  }
  for (let y = 120; y < height - 20; y += 40) {
    commands.push(`${ESC}H${h(10)}${ESC}V${v(y)}${ESC}L0101${ESC}XSY${y} +----------------------+`);
  }
  commands.push(`${ESC}Q1`, `${ESC}Z`);
  return Buffer.from(commands.join(""), "latin1");
}

function createSatoBarcodeFixture(configuration) {
  const commands = [
    `${ESC}A`,
    `${ESC}H0010${ESC}V0020${ESC}L0101${ESC}XSCODE39 SCAN TEST`,
    `${ESC}H0030${ESC}V0080${ESC}${configuration.profile.barcode.command}*AJRMS-PR10-001*`,
    `${ESC}H0060${ESC}V0200${ESC}L0101${ESC}XSAJRMS-PR10-001`,
    `${ESC}Q1`,
    `${ESC}Z`,
  ];
  return Buffer.from(commands.join(""), "latin1");
}

function generateFixtures({ outputRoot, now = new Date() } = {}) {
  const rootDir = path.resolve(__dirname, "..");
  const destination = path.resolve(outputRoot || path.join(rootDir, "outlet-fixtures", `fixture-${timestamp(now)}`));
  fs.mkdirSync(destination, { recursive: true });
  const configuration = resolveSatoProfileConfiguration({
    printerProfileId: process.env.SATO_PRINTER_PROFILE || SATO_PRINTER_PROFILE_CG408TT_JEWELRY_V1,
    horizontalOffsetDots: process.env.SATO_HORIZONTAL_OFFSET_DOTS,
    verticalOffsetDots: process.env.SATO_VERTICAL_OFFSET_DOTS,
    mediaWidthDots: process.env.SATO_MEDIA_WIDTH_DOTS,
    mediaHeightDots: process.env.SATO_MEDIA_HEIGHT_DOTS,
    copies: 1,
  });
  const files = {
    alignment: path.join(destination, "sato-alignment.sbpl"),
    barcode: path.join(destination, "sato-barcode-code39.sbpl"),
    epson: path.join(destination, "epson-a4-landscape-validation.pdf"),
  };
  const buffers = {
    alignment: createSatoAlignmentFixture(configuration),
    barcode: createSatoBarcodeFixture(configuration),
    epson: createEpsonFixturePdf(),
  };
  for (const key of Object.keys(files)) fs.writeFileSync(files[key], buffers[key]);
  const manifest = {
    generatedAt: now.toISOString(),
    purpose: "Outlet physical hardware acceptance fixtures. No business/customer data.",
    sato: {
      profileId: configuration.profile.id,
      dpi: configuration.profile.dpi,
      mediaWidthDots: configuration.mediaWidthDots,
      mediaHeightDots: configuration.mediaHeightDots,
      physicalValidation: configuration.profile.tuning.physicalValidation,
    },
    epson: {
      printProfileId: "epson_l3251_a4_v1",
      documentProfileId: "receipt_a4_landscape_v1",
      paper: "A4",
      orientation: "landscape",
      pages: 2,
    },
    files: Object.fromEntries(
      Object.entries(files).map(([key, filePath]) => [key, { name: path.basename(filePath), sha256: sha256(buffers[key]), bytes: buffers[key].length }]),
    ),
  };
  fs.writeFileSync(path.join(destination, "fixture-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(destination, "README.txt"),
    [
      "ASIHJAYA Outlet Hardware Acceptance Fixtures",
      "",
      "1. Inspect files in fake mode first.",
      "2. Do not print transaction/customer data for calibration.",
      "3. Activate one real adapter at a time.",
      "4. Record measured margins, offsets, barcode scan, speed, darkness, and driver versions in outlet report.",
      "",
    ].join("\r\n"),
    "utf8",
  );
  return { destination, manifest };
}

if (require.main === module) {
  const outputIndex = process.argv.indexOf("--output");
  const outputRoot = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
  const result = generateFixtures({ outputRoot });
  console.log(`[PASS] Outlet fixtures dibuat: ${result.destination}`);
  console.log(`[INFO] SATO ${result.manifest.sato.mediaWidthDots}x${result.manifest.sato.mediaHeightDots} dots; Epson A4 landscape 2 pages.`);
}

module.exports = {
  createEpsonFixturePdf,
  createSatoAlignmentFixture,
  createSatoBarcodeFixture,
  createSimplePdf,
  generateFixtures,
};
