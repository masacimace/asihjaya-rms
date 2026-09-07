import { deflateRawSync, inflateRawSync } from "node:zlib";

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_FILE_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

const STYLE = {
  general: 0,
  money: 1,
  title: 2,
  subtitle: 3,
  metadataLabel: 4,
  metadataValue: 5,
  sectionHeader: 6,
  metricLabel: 7,
  metricValue: 8,
  moneyLabel: 9,
  moneyValue: 10,
  grandLabel: 11,
  grandMoney: 12,
  tableHeader: 13,
  tableText: 14,
  tableCenter: 15,
  tableNumber: 16,
  tableMoney: 17,
  tableTextAlt: 18,
  tableCenterAlt: 19,
  tableNumberAlt: 20,
  tableMoneyAlt: 21,
  noteTitle: 22,
  noteText: 23,
  summaryLabel: 24,
  summaryMoney: 25,
  detailTitle: 26,
  transactionGrandLabel: 27,
  transactionGrandMoney: 28,
} as const;

type ZipEntry = {
  name: string;
  versionMadeBy: number;
  versionNeeded: number;
  flags: number;
  compressionMethod: number;
  modifiedTime: number;
  modifiedDate: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  diskNumberStart: number;
  internalAttributes: number;
  externalAttributes: number;
  localExtra: Buffer;
  centralExtra: Buffer;
  comment: Buffer;
  compressedData: Buffer;
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function calculateCrc32(value: Buffer) {
  let crc = 0xffffffff;
  for (const byte of value) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  throw new Error("XLSX ZIP tidak memiliki End of Central Directory yang valid.");
}

function readZipEntries(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const commentLength = buffer.readUInt16LE(eocdOffset + 20);
  const archiveComment = Buffer.from(
    buffer.subarray(eocdOffset + 22, eocdOffset + 22 + commentLength),
  );
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_FILE_HEADER) {
      throw new Error("Central directory XLSX rusak atau tidak didukung.");
    }

    const versionMadeBy = buffer.readUInt16LE(offset + 4);
    const versionNeeded = buffer.readUInt16LE(offset + 6);
    const flags = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const modifiedTime = buffer.readUInt16LE(offset + 12);
    const modifiedDate = buffer.readUInt16LE(offset + 14);
    const crc32 = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const entryCommentLength = buffer.readUInt16LE(offset + 32);
    const diskNumberStart = buffer.readUInt16LE(offset + 34);
    const internalAttributes = buffer.readUInt16LE(offset + 36);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const centralExtraEnd = nameEnd + extraLength;
    const commentEnd = centralExtraEnd + entryCommentLength;
    const nameBuffer = buffer.subarray(nameStart, nameEnd);
    const name = nameBuffer.toString("utf8");

    if (buffer.readUInt32LE(localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER) {
      throw new Error(`Local header XLSX tidak valid untuk ${name}.`);
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const localNameStart = localHeaderOffset + 30;
    const localExtraStart = localNameStart + localNameLength;
    const dataStart = localExtraStart + localExtraLength;

    entries.push({
      name,
      versionMadeBy,
      versionNeeded,
      flags,
      compressionMethod,
      modifiedTime,
      modifiedDate,
      crc32,
      compressedSize,
      uncompressedSize,
      diskNumberStart,
      internalAttributes,
      externalAttributes,
      localExtra: Buffer.from(
        buffer.subarray(localExtraStart, localExtraStart + localExtraLength),
      ),
      centralExtra: Buffer.from(buffer.subarray(nameEnd, centralExtraEnd)),
      comment: Buffer.from(buffer.subarray(centralExtraEnd, commentEnd)),
      compressedData: Buffer.from(
        buffer.subarray(dataStart, dataStart + compressedSize),
      ),
    });

    offset = commentEnd;
  }

  return { entries, archiveComment };
}

function inflateEntry(entry: ZipEntry) {
  if (entry.compressionMethod === 0) return Buffer.from(entry.compressedData);
  if (entry.compressionMethod === 8) return inflateRawSync(entry.compressedData);
  throw new Error(
    `Metode kompresi XLSX ${entry.compressionMethod} belum didukung untuk ${entry.name}.`,
  );
}

function createLocalHeader(entry: ZipEntry, compressedSize: number, uncompressedSize: number, crc32: number) {
  const name = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(30);
  const flags = entry.flags & ~0x0008;

  header.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0);
  header.writeUInt16LE(entry.versionNeeded, 4);
  header.writeUInt16LE(flags, 6);
  header.writeUInt16LE(entry.compressionMethod, 8);
  header.writeUInt16LE(entry.modifiedTime, 10);
  header.writeUInt16LE(entry.modifiedDate, 12);
  header.writeUInt32LE(crc32, 14);
  header.writeUInt32LE(compressedSize, 18);
  header.writeUInt32LE(uncompressedSize, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(entry.localExtra.length, 28);

  return Buffer.concat([header, name, entry.localExtra]);
}

function createCentralHeader(
  entry: ZipEntry,
  compressedSize: number,
  uncompressedSize: number,
  crc32: number,
  localHeaderOffset: number,
) {
  const name = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(46);
  const flags = entry.flags & ~0x0008;

  header.writeUInt32LE(ZIP_CENTRAL_FILE_HEADER, 0);
  header.writeUInt16LE(entry.versionMadeBy, 4);
  header.writeUInt16LE(entry.versionNeeded, 6);
  header.writeUInt16LE(flags, 8);
  header.writeUInt16LE(entry.compressionMethod, 10);
  header.writeUInt16LE(entry.modifiedTime, 12);
  header.writeUInt16LE(entry.modifiedDate, 14);
  header.writeUInt32LE(crc32, 16);
  header.writeUInt32LE(compressedSize, 20);
  header.writeUInt32LE(uncompressedSize, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(entry.centralExtra.length, 30);
  header.writeUInt16LE(entry.comment.length, 32);
  header.writeUInt16LE(entry.diskNumberStart, 34);
  header.writeUInt16LE(entry.internalAttributes, 36);
  header.writeUInt32LE(entry.externalAttributes, 38);
  header.writeUInt32LE(localHeaderOffset, 42);

  return Buffer.concat([header, name, entry.centralExtra, entry.comment]);
}

function rebuildZip(
  entries: ZipEntry[],
  archiveComment: Buffer,
  transforms: ReadonlyMap<string, (source: string) => string>,
) {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const transform = transforms.get(entry.name);
    const originalData = transform ? inflateEntry(entry) : null;
    const data = transform
      ? Buffer.from(transform(originalData!.toString("utf8")), "utf8")
      : null;
    const compressedData = data
      ? entry.compressionMethod === 0
        ? data
        : deflateRawSync(data, { level: 6 })
      : entry.compressedData;
    const uncompressedSize = data?.length ?? entry.uncompressedSize;
    const crc32 = data ? calculateCrc32(data) : entry.crc32;
    const localHeader = createLocalHeader(
      entry,
      compressedData.length,
      uncompressedSize,
      crc32,
    );

    localChunks.push(localHeader, compressedData);
    centralChunks.push(
      createCentralHeader(
        entry,
        compressedData.length,
        uncompressedSize,
        crc32,
        localOffset,
      ),
    );
    localOffset += localHeader.length + compressedData.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(archiveComment.length, 20);

  return Buffer.concat([...localChunks, centralDirectory, eocd, archiveComment]);
}

function replaceXmlSection(source: string, tag: string, replacement: string) {
  const pattern = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`);
  if (!pattern.test(source)) {
    throw new Error(`Bagian ${tag} tidak ditemukan pada styles.xml.`);
  }
  return source.replace(pattern, replacement);
}

function buildStyledStylesXml(source: string) {
  let styled = source;

  styled = replaceXmlSection(
    styled,
    "fonts",
    '<fonts count="6">' +
      '<font><sz val="10"/><color rgb="FF1F2937"/><name val="Arial"/><family val="2"/></font>' +
      '<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>' +
      '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>' +
      '<font><b/><sz val="10"/><color rgb="FF1F2937"/><name val="Arial"/><family val="2"/></font>' +
      '<font><i/><sz val="9"/><color rgb="FF667085"/><name val="Arial"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>' +
      '</fonts>',
  );

  styled = replaceXmlSection(
    styled,
    "fills",
    '<fills count="9">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF24483F"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF4F0"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF4E6CA"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF5F6F7"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF7E6"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF404040"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>',
  );

  styled = replaceXmlSection(
    styled,
    "borders",
    '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border>' +
      '<left style="thin"><color rgb="FFD9DEE3"/></left>' +
      '<right style="thin"><color rgb="FFD9DEE3"/></right>' +
      '<top style="thin"><color rgb="FFD9DEE3"/></top>' +
      '<bottom style="thin"><color rgb="FFD9DEE3"/></bottom>' +
      '<diagonal/>' +
      '</border>' +
      '</borders>',
  );

  const xf = ({
    numFmtId = 0,
    fontId = 0,
    fillId = 0,
    borderId = 0,
    horizontal,
    wrapText = false,
  }: {
    numFmtId?: number;
    fontId?: number;
    fillId?: number;
    borderId?: number;
    horizontal?: "left" | "center" | "right";
    wrapText?: boolean;
  }) => {
    const attributes = [
      `numFmtId="${numFmtId}"`,
      `fontId="${fontId}"`,
      `fillId="${fillId}"`,
      `borderId="${borderId}"`,
      'xfId="0"',
      'applyNumberFormat="1"',
      'applyFont="1"',
      'applyFill="1"',
      'applyBorder="1"',
    ];
    if (horizontal || wrapText) attributes.push('applyAlignment="1"');
    if (!horizontal && !wrapText) return `<xf ${attributes.join(" ")}/>`;
    const alignment = [
      horizontal ? `horizontal="${horizontal}"` : "",
      'vertical="center"',
      wrapText ? 'wrapText="1"' : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<xf ${attributes.join(" ")}><alignment ${alignment}/></xf>`;
  };

  const cellXfs = [
    xf({}),
    xf({ numFmtId: 60 }),
    xf({ fontId: 1, fillId: 7, horizontal: "left" }),
    xf({ fontId: 3, horizontal: "left" }),
    xf({ fontId: 3, fillId: 5, borderId: 1, horizontal: "left" }),
    xf({ fillId: 0, borderId: 1, horizontal: "left", wrapText: true }),
    xf({ fontId: 3, fillId: 4, borderId: 1, horizontal: "left" }),
    xf({ fillId: 3, borderId: 1, horizontal: "left" }),
    xf({ fontId: 3, fillId: 3, borderId: 1, horizontal: "right" }),
    xf({ fillId: 3, borderId: 1, horizontal: "left" }),
    xf({ numFmtId: 60, fontId: 3, fillId: 3, borderId: 1, horizontal: "right" }),
    xf({ fontId: 2, fillId: 8, borderId: 1, horizontal: "left" }),
    xf({ numFmtId: 60, fontId: 2, fillId: 8, borderId: 1, horizontal: "right" }),
    xf({ fontId: 2, fillId: 2, borderId: 1, horizontal: "center", wrapText: true }),
    xf({ borderId: 1, horizontal: "left", wrapText: true }),
    xf({ borderId: 1, horizontal: "center", wrapText: true }),
    xf({ borderId: 1, horizontal: "right" }),
    xf({ numFmtId: 60, borderId: 1, horizontal: "right" }),
    xf({ fillId: 5, borderId: 1, horizontal: "left", wrapText: true }),
    xf({ fillId: 5, borderId: 1, horizontal: "center", wrapText: true }),
    xf({ fillId: 5, borderId: 1, horizontal: "right" }),
    xf({ numFmtId: 60, fillId: 5, borderId: 1, horizontal: "right" }),
    xf({ fontId: 3, fillId: 4, borderId: 1, horizontal: "left" }),
    xf({ fontId: 4, fillId: 6, borderId: 1, horizontal: "left", wrapText: true }),
    xf({ fontId: 3, fillId: 4, borderId: 1, horizontal: "left", wrapText: true }),
    xf({ numFmtId: 60, fontId: 3, fillId: 4, borderId: 1, horizontal: "right" }),
    xf({ fontId: 5, fillId: 2, horizontal: "left" }),
    xf({ fontId: 2, fillId: 2, borderId: 1, horizontal: "center" }),
    xf({ numFmtId: 60, fontId: 5, fillId: 2, borderId: 1, horizontal: "center" }),
  ];

  styled = replaceXmlSection(
    styled,
    "cellXfs",
    `<cellXfs count="${cellXfs.length}">${cellXfs.join("")}</cellXfs>`,
  );

  return styled;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setCellStyle(source: string, ref: string, styleIndex: number) {
  const pattern = new RegExp(`<c\\b([^>]*\\br="${escapeRegExp(ref)}"[^>]*)>`);
  return source.replace(pattern, (_match, attributes: string) => {
    const cleaned = attributes.replace(/\s+s="\d+"/g, "");
    return `<c${cleaned} s="${styleIndex}">`;
  });
}

function encodeColumn(columnIndex: number) {
  let value = columnIndex + 1;
  let output = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function styleCells(
  source: string,
  rowStart: number,
  rowEnd: number,
  columnIndexes: number[],
  styleIndex: number,
) {
  let styled = source;
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (const columnIndex of columnIndexes) {
      styled = setCellStyle(styled, `${encodeColumn(columnIndex)}${row}`, styleIndex);
    }
  }
  return styled;
}

function setRowHeight(source: string, row: number, height: number) {
  const pattern = new RegExp(`<row\\b([^>]*\\br="${row}"[^>]*)>`);
  return source.replace(pattern, (_match, attributes: string) => {
    const cleaned = attributes
      .replace(/\s+ht="[^"]*"/g, "")
      .replace(/\s+customHeight="[^"]*"/g, "");
    return `<row${cleaned} ht="${height}" customHeight="1">`;
  });
}

function getLastWorksheetRow(source: string) {
  let lastRow = 1;
  for (const match of source.matchAll(/<row\b[^>]*\br="(\d+)"/g)) {
    lastRow = Math.max(lastRow, Number(match[1]));
  }
  return lastRow;
}


function replaceSheetView(source: string, freezeRows = 0) {
  const pane =
    freezeRows > 0
      ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/>`
      : "";
  const sheetViews = `<sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews>`;
  return source.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, sheetViews);
}

function styleSummaryWorksheet(source: string) {
  let styled = replaceSheetView(source);
  const paymentSectionRow = 28;
  const paymentHeaderRow = 29;
  const paymentDataStartRow = 30;
  const paymentDataEndRow = getLastWorksheetRow(styled);

  styled = styleCells(styled, 1, 1, [0, 1], STYLE.title);
  styled = styleCells(styled, 2, 8, [0], STYLE.metadataLabel);
  styled = styleCells(styled, 2, 8, [1], STYLE.metadataValue);

  for (const row of [10, 21]) {
    styled = styleCells(styled, row, row, [0, 1], STYLE.sectionHeader);
  }
  styled = styleCells(styled, paymentSectionRow, paymentSectionRow, [0, 1, 2, 3], STYLE.sectionHeader);

  styled = styleCells(styled, 11, 19, [0], STYLE.metricLabel);
  styled = styleCells(styled, 11, 19, [1], STYLE.metricValue);
  styled = styleCells(styled, 22, 25, [0], STYLE.moneyLabel);
  styled = styleCells(styled, 22, 25, [1], STYLE.moneyValue);
  styled = setCellStyle(styled, "A26", STYLE.grandLabel);
  styled = setCellStyle(styled, "B26", STYLE.grandMoney);

  styled = styleCells(styled, paymentHeaderRow, paymentHeaderRow, [0, 1, 2, 3], STYLE.tableHeader);
  for (let row = paymentDataStartRow; row <= paymentDataEndRow; row += 1) {
    const alternate = (row - paymentDataStartRow) % 2 === 1;
    styled = setCellStyle(styled, `A${row}`, alternate ? STYLE.tableTextAlt : STYLE.tableText);
    styled = styleCells(
      styled,
      row,
      row,
      [1, 2, 3],
      alternate ? STYLE.tableMoneyAlt : STYLE.tableMoney,
    );
  }

  styled = setRowHeight(styled, 1, 30);
  for (let row = 2; row <= 8; row += 1) styled = setRowHeight(styled, row, 20);
  styled = setRowHeight(styled, 9, 8);
  for (const row of [10, 21, paymentSectionRow]) styled = setRowHeight(styled, row, 23);
  for (let row = 11; row <= 19; row += 1) styled = setRowHeight(styled, row, 20);
  styled = setRowHeight(styled, 20, 8);
  for (let row = 22; row <= 26; row += 1) styled = setRowHeight(styled, row, 20);
  styled = setRowHeight(styled, 27, 8);
  styled = setRowHeight(styled, paymentHeaderRow, 26);
  for (let row = paymentDataStartRow; row <= paymentDataEndRow; row += 1) {
    styled = setRowHeight(styled, row, 22);
  }

  return styled;
}

function styleTransactionWorksheet(source: string) {
  let styled = replaceSheetView(source, 6);
  const lastRow = getLastWorksheetRow(styled);

  styled = styleCells(
    styled,
    1,
    1,
    Array.from({ length: 23 }, (_, index) => index),
    STYLE.detailTitle,
  );
  styled = setCellStyle(styled, "A2", STYLE.summaryLabel);
  styled = setCellStyle(styled, "B2", STYLE.summaryMoney);
  styled = setCellStyle(styled, "A3", STYLE.summaryLabel);
  styled = setCellStyle(styled, "B3", STYLE.summaryMoney);
  styled = setCellStyle(styled, "A4", STYLE.transactionGrandLabel);
  styled = setCellStyle(styled, "B4", STYLE.transactionGrandMoney);

  styled = styleCells(
    styled,
    6,
    6,
    Array.from({ length: 23 }, (_, index) => index),
    STYLE.tableHeader,
  );

  for (let row = 7; row <= lastRow; row += 1) {
    const alternate = (row - 7) % 2 === 1;
    const textStyle = alternate ? STYLE.tableTextAlt : STYLE.tableText;
    const centerStyle = alternate ? STYLE.tableCenterAlt : STYLE.tableCenter;
    const numberStyle = alternate ? STYLE.tableNumberAlt : STYLE.tableNumber;
    const moneyStyle = alternate ? STYLE.tableMoneyAlt : STYLE.tableMoney;

    styled = styleCells(styled, row, row, [0, 1, 2, 3, 4, 5, 6, 7], textStyle);
    styled = styleCells(styled, row, row, [8], numberStyle);
    styled = styleCells(styled, row, row, [9, 10, 11], centerStyle);
    styled = styleCells(
      styled,
      row,
      row,
      Array.from({ length: 11 }, (_, index) => index + 12),
      moneyStyle,
    );
  }

  styled = setRowHeight(styled, 1, 30);
  styled = setRowHeight(styled, 2, 22);
  styled = setRowHeight(styled, 3, 22);
  styled = setRowHeight(styled, 4, 24);
  styled = setRowHeight(styled, 5, 8);
  styled = setRowHeight(styled, 6, 34);
  for (let row = 7; row <= lastRow; row += 1) styled = setRowHeight(styled, row, 24);

  return styled;
}

function styleItemWorksheet(source: string) {
  let styled = replaceSheetView(source, 1);
  const lastRow = getLastWorksheetRow(styled);

  styled = styleCells(styled, 1, 1, Array.from({ length: 15 }, (_, index) => index), STYLE.tableHeader);

  for (let row = 2; row <= lastRow; row += 1) {
    const alternate = (row - 2) % 2 === 1;
    const textStyle = alternate ? STYLE.tableTextAlt : STYLE.tableText;
    const centerStyle = alternate ? STYLE.tableCenterAlt : STYLE.tableCenter;
    const numberStyle = alternate ? STYLE.tableNumberAlt : STYLE.tableNumber;
    const moneyStyle = alternate ? STYLE.tableMoneyAlt : STYLE.tableMoney;

    styled = styleCells(styled, row, row, [0, 1, 4, 5, 7, 8, 9, 10], textStyle);
    styled = styleCells(styled, row, row, [2, 3], centerStyle);
    styled = styleCells(styled, row, row, [6], numberStyle);
    styled = styleCells(styled, row, row, [11, 12, 13, 14], moneyStyle);
  }

  styled = setRowHeight(styled, 1, 34);
  for (let row = 2; row <= lastRow; row += 1) styled = setRowHeight(styled, row, 24);

  return styled;
}

export function styleAdminSalesWorkbookBuffer(buffer: Buffer) {
  const { entries, archiveComment } = readZipEntries(buffer);
  const transforms = new Map<string, (source: string) => string>([
    ["xl/styles.xml", buildStyledStylesXml],
    ["xl/worksheets/sheet1.xml", styleSummaryWorksheet],
    ["xl/worksheets/sheet2.xml", styleTransactionWorksheet],
    ["xl/worksheets/sheet3.xml", styleItemWorksheet],
  ]);

  return rebuildZip(entries, archiveComment, transforms);
}
