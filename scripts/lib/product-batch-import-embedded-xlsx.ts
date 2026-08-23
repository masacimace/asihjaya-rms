import path from "node:path";

import {
  extractStrictZipEntry,
  inspectStrictZipArchive,
} from "../../src/features/product-batch-import/zip-reader";
import { buildTestZip } from "./product-batch-import-test-zip";

export type EmbeddedTestImage = {
  sheetName: "PRODUCTS" | "PRODUCT_MASTERS" | "PHYSICAL_PRODUCTS";
  rowNumber: number;
  columnIndex: number;
  data: Buffer;
  extension?: ".png" | ".jpg";
};

function addDrawingTag(worksheetXml: string, relationshipId: string) {
  if (!worksheetXml.includes("</worksheet>")) {
    throw new Error("Worksheet XML fixture tidak valid.");
  }
  return worksheetXml.replace(
    "</worksheet>",
    `<drawing r:id="${relationshipId}"/></worksheet>`,
  );
}

function drawingXml(images: Array<EmbeddedTestImage & { mediaRelationshipId: string }>) {
  const anchors = images
    .map((image, index) => {
      const rowIndex = image.rowNumber - 1;
      return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${image.columnIndex}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${rowIndex}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${image.columnIndex + 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${rowIndex + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 1}" name="Picture ${index + 1}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${image.mediaRelationshipId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
}

function relationshipsXml(relationships: Array<{ id: string; type: string; target: string }>) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships
    .map(
      (relationship) =>
        `<Relationship Id="${relationship.id}" Type="${relationship.type}" Target="${relationship.target}"/>`,
    )
    .join("")}</Relationships>`;
}

function addDrawingContentTypeOverrides(contentTypesXml: string, drawingPaths: string[]) {
  if (!contentTypesXml.includes("</Types>")) {
    throw new Error("[Content_Types].xml fixture tidak valid.");
  }
  const overrides = drawingPaths
    .filter((drawingPath) => !contentTypesXml.includes(`PartName="/${drawingPath}"`))
    .map(
      (drawingPath) =>
        `<Override PartName="/${drawingPath}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    )
    .join("");
  return contentTypesXml.replace("</Types>", `${overrides}</Types>`);
}

export function buildEmbeddedImageWorkbookFixture(
  baseWorkbook: Buffer,
  images: EmbeddedTestImage[],
) {
  const inspection = inspectStrictZipArchive(baseWorkbook, {
    maxArchiveBytes: 10 * 1024 * 1024,
    maxEntries: 1_000,
    maxUncompressedBytes: 64 * 1024 * 1024,
    maxFileNameBytes: 1_024,
  });
  const sourceEntries = inspection.entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({
      path: entry.path,
      data: extractStrictZipEntry(baseWorkbook, entry),
      method: entry.compressionMethod,
    }));
  const byPath = new Map(sourceEntries.map((entry) => [entry.path, entry]));

  const sheets = [
    { sheetName: "PRODUCTS" as const, sheetPath: "xl/worksheets/sheet1.xml", drawingIndex: 3 },
    { sheetName: "PRODUCT_MASTERS" as const, sheetPath: "xl/worksheets/sheet2.xml", drawingIndex: 1 },
    { sheetName: "PHYSICAL_PRODUCTS" as const, sheetPath: "xl/worksheets/sheet3.xml", drawingIndex: 2 },
  ];
  let mediaIndex = 1;
  const drawingPaths: string[] = [];

  for (const sheet of sheets) {
    const sheetImages = images.filter((image) => image.sheetName === sheet.sheetName);
    if (!sheetImages.length) continue;
    const worksheetEntry = byPath.get(sheet.sheetPath);
    if (!worksheetEntry) throw new Error(`Fixture worksheet tidak ditemukan: ${sheet.sheetPath}`);

    worksheetEntry.data = Buffer.from(
      addDrawingTag(worksheetEntry.data.toString("utf8"), "rIdPBIDrawing"),
      "utf8",
    );
    const sheetRelationshipsPath = path.posix.join(
      path.posix.dirname(sheet.sheetPath),
      "_rels",
      `${path.posix.basename(sheet.sheetPath)}.rels`,
    );
    byPath.set(sheetRelationshipsPath, {
      path: sheetRelationshipsPath,
      data: Buffer.from(
        relationshipsXml([
          {
            id: "rIdPBIDrawing",
            type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
            target: `../drawings/drawing${sheet.drawingIndex}.xml`,
          },
        ]),
      ),
      method: 8 as const,
    });

    const drawingPath = `xl/drawings/drawing${sheet.drawingIndex}.xml`;
    drawingPaths.push(drawingPath);
    const drawingRelationshipsPath = `xl/drawings/_rels/drawing${sheet.drawingIndex}.xml.rels`;
    const fixtureImages = sheetImages.map((image, index) => ({
      ...image,
      mediaRelationshipId: `rIdImage${index + 1}`,
      mediaPath: `xl/media/image${mediaIndex++}${image.extension ?? ".png"}`,
    }));
    byPath.set(drawingPath, {
      path: drawingPath,
      data: Buffer.from(drawingXml(fixtureImages)),
      method: 8 as const,
    });
    byPath.set(drawingRelationshipsPath, {
      path: drawingRelationshipsPath,
      data: Buffer.from(
        relationshipsXml(
          fixtureImages.map((image) => ({
            id: image.mediaRelationshipId,
            type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
            target: `../media/${path.posix.basename(image.mediaPath)}`,
          })),
        ),
      ),
      method: 8 as const,
    });
    fixtureImages.forEach((image) => {
      byPath.set(image.mediaPath, {
        path: image.mediaPath,
        data: image.data,
        method: 8 as const,
      });
    });
  }

  const contentTypesEntry = byPath.get("[Content_Types].xml");
  if (!contentTypesEntry) {
    throw new Error("[Content_Types].xml fixture tidak ditemukan.");
  }
  contentTypesEntry.data = Buffer.from(
    addDrawingContentTypeOverrides(contentTypesEntry.data.toString("utf8"), drawingPaths),
    "utf8",
  );

  return buildTestZip([...byPath.values()]);
}

function columnName(columnIndex: number) {
  let value = columnIndex + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function setRichValueCell(
  worksheetXml: string,
  rowNumber: number,
  columnIndex: number,
  valueMetadataIndex: number,
) {
  const address = `${columnName(columnIndex)}${rowNumber}`;
  const richCell = `<c r="${address}" t="e" vm="${valueMetadataIndex}"><v>#VALUE!</v></c>`;
  const existingCellPattern = new RegExp(
    `<c\\b[^>]*\\br=["']${address}["'][^>]*>(?:[\\s\\S]*?)<\\/c>|<c\\b[^>]*\\br=["']${address}["'][^>]*/>`,
    "i",
  );
  if (existingCellPattern.test(worksheetXml)) {
    return worksheetXml.replace(existingCellPattern, richCell);
  }

  const rowPattern = new RegExp(
    `(<row\\b[^>]*\\br=["']${rowNumber}["'][^>]*>)([\\s\\S]*?)(<\\/row>)`,
    "i",
  );
  if (!rowPattern.test(worksheetXml)) {
    throw new Error(`Fixture row ${rowNumber} tidak ditemukan untuk ${address}.`);
  }
  return worksheetXml.replace(rowPattern, `$1$2${richCell}$3`);
}

function appendRelationship(
  relationships: string,
  relationship: { id: string; type: string; target: string },
) {
  if (!relationships.includes("</Relationships>")) {
    throw new Error("Relationship XML fixture tidak valid.");
  }
  return relationships.replace(
    "</Relationships>",
    `<Relationship Id="${relationship.id}" Type="${relationship.type}" Target="${relationship.target}"/></Relationships>`,
  );
}

function addContentTypeOverrides(
  contentTypesXml: string,
  overrides: Array<{ path: string; contentType: string }>,
) {
  if (!contentTypesXml.includes("</Types>")) {
    throw new Error("[Content_Types].xml fixture tidak valid.");
  }
  const additions = overrides
    .filter(({ path: partPath }) => !contentTypesXml.includes(`PartName="/${partPath}"`))
    .map(
      ({ path: partPath, contentType }) =>
        `<Override PartName="/${partPath}" ContentType="${contentType}"/>`,
    )
    .join("");
  return contentTypesXml.replace("</Types>", `${additions}</Types>`);
}

export function buildInCellImageWorkbookFixture(
  baseWorkbook: Buffer,
  images: EmbeddedTestImage[],
  options: { relationshipTopology?: "workbook" | "nested" } = {},
) {
  if (!images.length) return baseWorkbook;
  const inspection = inspectStrictZipArchive(baseWorkbook, {
    maxArchiveBytes: 10 * 1024 * 1024,
    maxEntries: 1_000,
    maxUncompressedBytes: 64 * 1024 * 1024,
    maxFileNameBytes: 1_024,
  });
  const sourceEntries = inspection.entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({
      path: entry.path,
      data: extractStrictZipEntry(baseWorkbook, entry),
      method: entry.compressionMethod,
    }));
  const byPath = new Map(sourceEntries.map((entry) => [entry.path, entry]));
  for (const reservedPath of [
    "xl/_rels/metadata.xml.rels",
    "xl/richData/rdrichvalue.xml",
    "xl/richData/_rels/rdrichvalue.xml.rels",
    "xl/richData/rdrichvaluestructure.xml",
    "xl/richData/_rels/rdrichvaluestructure.xml.rels",
    "xl/richData/rdRichValueTypes.xml",
    "xl/richData/richValueRel.xml",
    "xl/richData/_rels/richValueRel.xml.rels",
  ]) {
    if (byPath.has(reservedPath)) {
      throw new Error(`Fixture rich-value path sudah ada: ${reservedPath}`);
    }
  }

  const sheetPaths = {
    PRODUCTS: "xl/worksheets/sheet1.xml",
    PRODUCT_MASTERS: "xl/worksheets/sheet2.xml",
    PHYSICAL_PRODUCTS: "xl/worksheets/sheet3.xml",
  } as const;
  images.forEach((image, index) => {
    const worksheetEntry = byPath.get(sheetPaths[image.sheetName]);
    if (!worksheetEntry) {
      throw new Error(`Fixture worksheet tidak ditemukan: ${image.sheetName}`);
    }
    worksheetEntry.data = Buffer.from(
      setRichValueCell(
        worksheetEntry.data.toString("utf8"),
        image.rowNumber,
        image.columnIndex,
        index + 1,
      ),
      "utf8",
    );
  });

  const workbookRelationshipsPath = "xl/_rels/workbook.xml.rels";
  const workbookRelationshipsEntry = byPath.get(workbookRelationshipsPath);
  if (!workbookRelationshipsEntry) {
    throw new Error("Workbook relationships fixture tidak ditemukan.");
  }
  const topology = options.relationshipTopology ?? "workbook";
  const sheetMetadataRelationshipType =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata";
  let workbookRelationshipsXml = workbookRelationshipsEntry.data
    .toString("utf8")
    .replace(/<Relationship\b[^>]*\/>/gi, (relationshipTag) => {
      const typeMatch = relationshipTag.match(/\bType=(["'])(.*?)\1/i);
      return typeMatch?.[2] === sheetMetadataRelationshipType ? "" : relationshipTag;
    });
  workbookRelationshipsXml = appendRelationship(workbookRelationshipsXml, {
    id: "rIdPBIMetadata",
    type: sheetMetadataRelationshipType,
    target: "metadata.xml",
  });
  if (topology === "workbook") {
    workbookRelationshipsXml = appendRelationship(workbookRelationshipsXml, {
      id: "rIdPBIRichValueData",
      type: "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValue",
      target: "richData/rdrichvalue.xml",
    });
    workbookRelationshipsXml = appendRelationship(workbookRelationshipsXml, {
      id: "rIdPBIRichValueStructure",
      type: "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueStructure",
      target: "richData/rdrichvaluestructure.xml",
    });
    workbookRelationshipsXml = appendRelationship(workbookRelationshipsXml, {
      id: "rIdPBIRichValueRel",
      type: "http://schemas.microsoft.com/office/2022/10/relationships/richValueRel",
      target: "richData/richValueRel.xml",
    });
    workbookRelationshipsXml = appendRelationship(workbookRelationshipsXml, {
      id: "rIdPBIRichValueTypes",
      type: "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueTypes",
      target: "richData/rdRichValueTypes.xml",
    });
  }
  workbookRelationshipsEntry.data = Buffer.from(workbookRelationshipsXml, "utf8");

  const futureMetadata = images
    .map(
      (_, index) =>
        `<bk><extLst><ext uri="{3E2802C4-A4D2-4D8B-9148-E3BE6C30E623}"><xlrd:rvb i="${index}"/></ext></extLst></bk>`,
    )
    .join("");
  const valueMetadata = images
    .map((_, index) => `<bk><rc t="1" v="${index}"/></bk>`)
    .join("");
  byPath.set("xl/metadata.xml", {
    path: "xl/metadata.xml",
    data: Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xlrd="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata"><metadataTypes count="1"><metadataType name="XLRICHVALUE" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="0"/></metadataTypes><futureMetadata name="XLRICHVALUE" count="${images.length}">${futureMetadata}</futureMetadata><valueMetadata count="${images.length}">${valueMetadata}</valueMetadata></metadata>`,
    ),
    method: 8 as const,
  });
  if (topology === "nested") {
    byPath.set("xl/_rels/metadata.xml.rels", {
      path: "xl/_rels/metadata.xml.rels",
      data: Buffer.from(
        relationshipsXml([
          {
            id: "rIdRichValueData",
            type: "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValue",
            target: "richData/rdrichvalue.xml",
          },
        ]),
      ),
      method: 8 as const,
    });
  }

  const richValues = images
    .map((_, index) => `<rv s="0"><v>${index}</v><v>5</v></rv>`)
    .join("");
  byPath.set("xl/richData/rdrichvalue.xml", {
    path: "xl/richData/rdrichvalue.xml",
    data: Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><rvData xmlns="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata" count="${images.length}">${richValues}</rvData>`,
    ),
    method: 8 as const,
  });
  if (topology === "nested") {
    byPath.set("xl/richData/_rels/rdrichvalue.xml.rels", {
      path: "xl/richData/_rels/rdrichvalue.xml.rels",
      data: Buffer.from(
        relationshipsXml([
          {
            id: "rIdRichValueStructure",
            type: "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueStructure",
            target: "rdrichvaluestructure.xml",
          },
          {
            id: "rIdRichValueRel",
            type: "http://schemas.microsoft.com/office/2022/10/relationships/richValueRel",
            target: "richValueRel.xml",
          },
        ]),
      ),
      method: 8 as const,
    });
  }
  byPath.set("xl/richData/rdrichvaluestructure.xml", {
    path: "xl/richData/rdrichvaluestructure.xml",
    data: Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><rvStructures xmlns="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata" count="1"><s t="_localImage"><k n="_rvRel:LocalImageIdentifier" t="i"/><k n="CalcOrigin" t="i"/></s></rvStructures>',
    ),
    method: 8 as const,
  });
  if (topology === "nested") {
    byPath.set("xl/richData/_rels/rdrichvaluestructure.xml.rels", {
      path: "xl/richData/_rels/rdrichvaluestructure.xml.rels",
      data: Buffer.from(
        relationshipsXml([
          {
            id: "rIdRichValueTypes",
            type: "http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueTypes",
            target: "rdRichValueTypes.xml",
          },
        ]),
      ),
      method: 8 as const,
    });
  }
  byPath.set("xl/richData/rdRichValueTypes.xml", {
    path: "xl/richData/rdRichValueTypes.xml",
    data: Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><rvTypesInfo xmlns="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata2"><global><keyFlags/></global></rvTypesInfo>',
    ),
    method: 8 as const,
  });
  byPath.set("xl/richData/richValueRel.xml", {
    path: "xl/richData/richValueRel.xml",
    data: Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><richValueRels xmlns="http://schemas.microsoft.com/office/spreadsheetml/2022/richvaluerel" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${images
        .map((_, index) => `<rel r:id="rIdImage${index + 1}"/>`)
        .join("")}</richValueRels>`,
    ),
    method: 8 as const,
  });

  const mediaRelationships = images.map((image, index) => {
    const extension = image.extension ?? ".png";
    const mediaPath = `xl/media/incell-image${index + 1}${extension}`;
    byPath.set(mediaPath, {
      path: mediaPath,
      data: image.data,
      method: 8 as const,
    });
    return {
      id: `rIdImage${index + 1}`,
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
      target: `../media/${path.posix.basename(mediaPath)}`,
    };
  });
  byPath.set("xl/richData/_rels/richValueRel.xml.rels", {
    path: "xl/richData/_rels/richValueRel.xml.rels",
    data: Buffer.from(relationshipsXml(mediaRelationships)),
    method: 8 as const,
  });

  const contentTypesEntry = byPath.get("[Content_Types].xml");
  if (!contentTypesEntry) {
    throw new Error("[Content_Types].xml fixture tidak ditemukan.");
  }
  contentTypesEntry.data = Buffer.from(
    addContentTypeOverrides(contentTypesEntry.data.toString("utf8"), [
      {
        path: "xl/metadata.xml",
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml",
      },
      {
        path: "xl/richData/rdrichvalue.xml",
        contentType: "application/vnd.ms-excel.rdRichValue+xml",
      },
      {
        path: "xl/richData/rdrichvaluestructure.xml",
        contentType: "application/vnd.ms-excel.rdRichValueStructure+xml",
      },
      {
        path: "xl/richData/richValueRel.xml",
        contentType: "application/vnd.ms-excel.richvaluerel+xml",
      },
      {
        path: "xl/richData/rdRichValueTypes.xml",
        contentType: "application/vnd.ms-excel.rdRichValuetypes+xml",
      },
    ]),
    "utf8",
  );

  return buildTestZip([...byPath.values()]);
}
