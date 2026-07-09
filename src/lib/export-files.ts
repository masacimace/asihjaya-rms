import * as XLSX from "xlsx";

export type ExportCell = string | number | boolean | Date | null | undefined;

export type ExportSheet = {
  name: string;
  columns: string[];
  rows: ExportCell[][];
  widths?: Array<{ wch: number }>;
};

function sanitizeText(value: ExportCell) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalizedValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();

  if (/^[=+\-@]/.test(normalizedValue)) {
    return `'${normalizedValue}`;
  }

  return normalizedValue;
}

function escapeCsvCell(value: ExportCell) {
  const stringValue = sanitizeText(value);

  if (
    stringValue.includes('"') ||
    stringValue.includes(",") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

export function buildCsvFromRows(rows: ExportCell[][]) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export function buildCsvFromSheets(sheets: ExportSheet[]) {
  const rows: ExportCell[][] = [];

  sheets.forEach((sheet, index) => {
    if (index > 0) {
      rows.push([]);
    }

    rows.push([sheet.name]);
    rows.push(sheet.columns);
    rows.push(...sheet.rows);
  });

  return `\ufeff${buildCsvFromRows(rows)}`;
}

function sanitizeSheetName(name: string) {
  return name.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
}

export function buildXlsxBuffer(sheets: ExportSheet[]) {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.columns, ...sheet.rows]);
    const lastColumn = XLSX.utils.encode_col(
      Math.max((sheet.columns.length || 1) - 1, 0),
    );
    const lastRow = Math.max(sheet.rows.length + 1, 1);

    worksheet["!cols"] = sheet.widths;
    worksheet["!autofilter"] = {
      ref: `A1:${lastColumn}${lastRow}`,
    };

    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheet.name));
  }

  return XLSX.write(workbook, {
    bookType: "xlsx",
    compression: true,
    type: "buffer",
  }) as Buffer;
}

export function createCsvResponse({
  filename,
  sheets,
}: {
  filename: string;
  sheets: ExportSheet[];
}) {
  return new Response(buildCsvFromSheets(sheets), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function createXlsxResponse({
  filename,
  sheets,
}: {
  filename: string;
  sheets: ExportSheet[];
}) {
  const workbookBuffer = buildXlsxBuffer(sheets);
  const responseBody = new Uint8Array(workbookBuffer.length);
  responseBody.set(workbookBuffer);

  return new Response(responseBody.buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function buildExportTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  })
    .format(date)
    .replace(/[-: ]/g, "")
    .slice(0, 12);
}
