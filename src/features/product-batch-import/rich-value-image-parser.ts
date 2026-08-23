import path from "node:path";

import {
  PRODUCT_BATCH_IMPORT_LIMITS,
  PRODUCT_BATCH_IMPORT_V2_SHEET_NAME,
} from "./contracts";
import {
  extractStrictZipEntry,
  inspectStrictZipArchive,
  StrictZipError,
  type StrictZipEntry,
} from "./zip-reader";

const RELATIONSHIP_TYPE_WORKSHEET_SUFFIX = "/worksheet";
const RELATIONSHIP_TYPE_METADATA_SUFFIX = "/sheetMetadata";
const RELATIONSHIP_TYPE_RICH_VALUE_SUFFIX = "/rdRichValue";
const RELATIONSHIP_TYPE_RICH_VALUE_STRUCTURE_SUFFIX = "/rdRichValueStructure";
const RELATIONSHIP_TYPE_RICH_VALUE_TYPES_SUFFIX = "/rdRichValueTypes";
const RELATIONSHIP_TYPE_RICH_VALUE_REL_SUFFIX = "/richValueRel";
const RELATIONSHIP_TYPE_IMAGE_SUFFIX = "/image";
const RICH_VALUE_METADATA_TYPE = "XLRICHVALUE";
const LOCAL_IMAGE_TYPE = "_localImage";
const LOCAL_IMAGE_IDENTIFIER_KEY = "_rvRel:LocalImageIdentifier";

export type ProductBatchRichValueImage = {
  sheetName: "PRODUCT_MASTERS" | "PHYSICAL_PRODUCTS" | "PRODUCTS";
  rowNumber: number;
  columnIndex: number;
  mediaPath: string;
};

type Relationship = {
  id: string;
  type: string;
  target: string;
  targetMode: string | null;
};

type RichValueCell = {
  sheetName: string;
  rowNumber: number;
  columnIndex: number;
  address: string;
  valueMetadataIndex: number;
};

type RichValueStructure = {
  type: string;
  keys: Array<{ name: string; valueType: string }>;
};

type ParsedRichValue = {
  structureIndex: number;
  values: string[];
};

export class ProductBatchRichValueImageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProductBatchRichValueImageError";
  }
}

function richValueError(code: string, message: string, cause?: unknown) {
  return new ProductBatchRichValueImageError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function readXmlAttribute(tag: string, attributeName: string): string | null {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*["']([^"']*)["']`, "i"),
  );
  return match?.[1] ?? null;
}

function elementBlocks(xml: string, localName: string) {
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${escaped}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${escaped}>`,
    "gi",
  );
  const result: Array<{ openTag: string; body: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    result.push({
      openTag: `<${localName}${match[1] ?? ""}>`,
      body: match[2] ?? "",
    });
  }
  return result;
}

function relationshipsById(xml: string, sourcePath: string) {
  const map = new Map<string, Relationship>();
  const tags = xml.match(/<(?:[A-Za-z_][\w.-]*:)?Relationship\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const id = readXmlAttribute(tag, "Id");
    const type = readXmlAttribute(tag, "Type");
    const target = readXmlAttribute(tag, "Target");
    if (!id || !type || !target || map.has(id)) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
        `Relationship OOXML tidak lengkap/duplicate pada ${sourcePath}.`,
      );
    }
    const targetMode = readXmlAttribute(tag, "TargetMode");
    if (targetMode?.toLocaleLowerCase("en-US") === "external") {
      throw richValueError(
        "WORKBOOK_ACTIVE_CONTENT_REJECTED",
        `External relationship tidak diizinkan: ${sourcePath} -> ${target}.`,
      );
    }
    map.set(id, { id, type, target, targetMode });
  }
  return map;
}

function relationshipByType(
  relationships: Iterable<Relationship>,
  suffix: string,
  sourcePath: string,
  required: boolean,
) {
  const matches = [...relationships].filter((relationship) =>
    relationship.type.endsWith(suffix),
  );
  if (matches.length > 1 || (required && matches.length !== 1)) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      `${sourcePath} harus mempunyai ${required ? "tepat satu" : "maksimal satu"} relationship ${suffix}.`,
    );
  }
  return matches[0] ?? null;
}

function normalizeRelationshipTarget(sourcePartPath: string, target: string) {
  if (!target || target.includes("\\") || target.includes("\0")) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      `Target relationship tidak valid pada ${sourcePartPath}.`,
    );
  }
  if (
    target.startsWith("/") ||
    /^[A-Za-z]:/.test(target) ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  ) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      `Target relationship absolute/external ditolak pada ${sourcePartPath}: ${target}.`,
    );
  }
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(sourcePartPath), target),
  );
  if (
    !resolved ||
    resolved === "." ||
    resolved === ".." ||
    resolved.startsWith("../") ||
    resolved.includes("/../")
  ) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      `Target relationship keluar dari package OOXML: ${sourcePartPath} -> ${target}.`,
    );
  }
  return resolved;
}

function relationshipPartPath(sourcePartPath: string) {
  return path.posix.join(
    path.posix.dirname(sourcePartPath),
    "_rels",
    `${path.posix.basename(sourcePartPath)}.rels`,
  );
}

type RelationshipSource = {
  relationships: Map<string, Relationship>;
  relationshipsPath: string;
  sourcePartPath: string;
};

function loadOptionalRelationshipSource(
  workbookBuffer: Buffer,
  entriesByPath: Map<string, StrictZipEntry>,
  sourcePartPath: string,
  allowedSuffixes: readonly string[],
): RelationshipSource | null {
  const relationshipsPath = relationshipPartPath(sourcePartPath);
  const entry = entriesByPath.get(relationshipsPath);
  if (!entry || entry.isDirectory) return null;
  const relationships = relationshipsById(
    extractStrictZipEntry(workbookBuffer, entry).toString("utf8"),
    relationshipsPath,
  );
  assertKnownRichDataRelationships(relationships, relationshipsPath, allowedSuffixes);
  return { relationships, relationshipsPath, sourcePartPath };
}

function resolveRelationshipPathFromSources(
  sources: readonly RelationshipSource[],
  suffix: string,
  required: boolean,
  label: string,
) {
  const resolvedPaths = new Set<string>();
  for (const source of sources) {
    const relationship = relationshipByType(
      source.relationships.values(),
      suffix,
      source.relationshipsPath,
      false,
    );
    if (!relationship) continue;
    resolvedPaths.add(
      normalizeRelationshipTarget(source.sourcePartPath, relationship.target),
    );
  }
  if (resolvedPaths.size > 1 || (required && resolvedPaths.size !== 1)) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      `${label} harus mempunyai ${required ? "tepat satu" : "maksimal satu"} target ${suffix} yang konsisten.`,
    );
  }
  return [...resolvedPaths][0] ?? null;
}

function assertRichDataPartPath(entryPath: string, label: string) {
  if (!entryPath.startsWith("xl/richData/")) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      `${label} harus berada pada xl/richData/: ${entryPath}.`,
    );
  }
}

function getEntry(
  entriesByPath: Map<string, StrictZipEntry>,
  entryPath: string,
  code: string,
  message: string,
) {
  const entry = entriesByPath.get(entryPath);
  if (!entry || entry.isDirectory) throw richValueError(code, message);
  return entry;
}

function extractText(
  workbookBuffer: Buffer,
  entriesByPath: Map<string, StrictZipEntry>,
  entryPath: string,
  code: string,
  message: string,
) {
  try {
    return extractStrictZipEntry(
      workbookBuffer,
      getEntry(entriesByPath, entryPath, code, message),
    ).toString("utf8");
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw richValueError("WORKBOOK_CONTAINER_INVALID", error.message, error);
    }
    throw error;
  }
}

function decodeCellAddress(address: string) {
  const match = address.toUpperCase().match(/^([A-Z]{1,3})([1-9]\d*)$/);
  if (!match) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_INVALID",
      `Alamat rich-value cell tidak valid: ${address}.`,
    );
  }
  let columnIndex = 0;
  for (const character of match[1]!) {
    columnIndex = columnIndex * 26 + (character.charCodeAt(0) - 64);
  }
  return {
    columnIndex: columnIndex - 1,
    rowNumber: Number(match[2]),
  };
}

function parseWorkbookSheetRelationshipIds(workbookXml: string) {
  const result = new Map<string, string>();
  const tags = workbookXml.match(/<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = readXmlAttribute(tag, "name");
    const relationshipId = readXmlAttribute(tag, "r:id");
    if (!name || !relationshipId || result.has(name)) {
      throw richValueError(
        "WORKBOOK_OOXML_INVALID",
        "Definisi worksheet pada xl/workbook.xml tidak lengkap/duplicate.",
      );
    }
    result.set(name, relationshipId);
  }
  return result;
}

function parseRichValueCells(worksheetXml: string, sheetName: string) {
  const cells: RichValueCell[] = [];
  const tags = worksheetXml.match(/<(?:[A-Za-z_][\w.-]*:)?c\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const vmText = readXmlAttribute(tag, "vm");
    if (vmText === null) continue;
    const address = readXmlAttribute(tag, "r");
    const valueMetadataIndex = Number(vmText);
    if (!address || !Number.isSafeInteger(valueMetadataIndex) || valueMetadataIndex <= 0) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_INVALID",
        `Rich-value cell tidak valid pada worksheet ${sheetName}.`,
      );
    }
    const decoded = decodeCellAddress(address);
    cells.push({
      sheetName,
      address,
      rowNumber: decoded.rowNumber,
      columnIndex: decoded.columnIndex,
      valueMetadataIndex,
    });
  }
  return cells;
}

function parseMetadataTypeIndex(metadataXml: string) {
  const tags = metadataXml.match(/<(?:[A-Za-z_][\w.-]*:)?metadataType\b[^>]*>/gi) ?? [];
  const matching = tags
    .map((tag, index) => ({ name: readXmlAttribute(tag, "name"), index: index + 1 }))
    .filter((entry) => entry.name === RICH_VALUE_METADATA_TYPE);
  if (matching.length !== 1) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_METADATA_INVALID",
      "Metadata XLRICHVALUE tidak ditemukan atau duplicate.",
    );
  }
  return matching[0]!.index;
}

function parseFutureRichValueIndices(metadataXml: string) {
  const futureBlocks = elementBlocks(metadataXml, "futureMetadata").filter(
    (block) => readXmlAttribute(block.openTag, "name") === RICH_VALUE_METADATA_TYPE,
  );
  if (futureBlocks.length !== 1) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_METADATA_INVALID",
      "futureMetadata XLRICHVALUE tidak ditemukan atau duplicate.",
    );
  }
  const metadataBlocks = elementBlocks(futureBlocks[0]!.body, "bk");
  return metadataBlocks.map((block) => {
    const rvbTags = block.body.match(/<(?:[A-Za-z_][\w.-]*:)?rvb\b[^>]*\/?\s*>/gi) ?? [];
    if (rvbTags.length !== 1) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_METADATA_INVALID",
        "Metadata block XLRICHVALUE harus mempunyai tepat satu rvb.",
      );
    }
    const indexText = readXmlAttribute(rvbTags[0]!, "i");
    const index = Number(indexText);
    if (!Number.isSafeInteger(index) || index < 0) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_METADATA_INVALID",
        "Index rvb XLRICHVALUE tidak valid.",
      );
    }
    return index;
  });
}

function parseValueMetadataMap(metadataXml: string, metadataTypeIndex: number) {
  const sections = elementBlocks(metadataXml, "valueMetadata");
  if (sections.length !== 1) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_METADATA_INVALID",
      "valueMetadata workbook tidak ditemukan atau duplicate.",
    );
  }
  const blocks = elementBlocks(sections[0]!.body, "bk");
  const result = new Map<number, number>();
  blocks.forEach((block, index) => {
    const recordTags = block.body.match(/<(?:[A-Za-z_][\w.-]*:)?rc\b[^>]*\/?\s*>/gi) ?? [];
    const matching = recordTags.filter(
      (tag) => Number(readXmlAttribute(tag, "t")) === metadataTypeIndex,
    );
    if (matching.length > 1) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_METADATA_INVALID",
        `valueMetadata index ${index + 1} mempunyai XLRICHVALUE duplicate.`,
      );
    }
    if (!matching.length) return;
    const futureMetadataIndex = Number(readXmlAttribute(matching[0]!, "v"));
    if (!Number.isSafeInteger(futureMetadataIndex) || futureMetadataIndex < 0) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_METADATA_INVALID",
        `valueMetadata index ${index + 1} mempunyai reference tidak valid.`,
      );
    }
    result.set(index + 1, futureMetadataIndex);
  });
  return result;
}

function parseRichValueStructures(xml: string): RichValueStructure[] {
  const sections = elementBlocks(xml, "rvStructures");
  if (sections.length !== 1) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID",
      "Rich Value Structure part tidak valid.",
    );
  }
  return elementBlocks(sections[0]!.body, "s").map((block) => {
    const type = readXmlAttribute(block.openTag, "t");
    if (!type) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID",
        "Rich Value Structure tidak mempunyai type.",
      );
    }
    const keyTags = block.body.match(/<(?:[A-Za-z_][\w.-]*:)?k\b[^>]*\/?\s*>/gi) ?? [];
    const keys = keyTags.map((tag) => {
      const name = readXmlAttribute(tag, "n");
      const valueType = readXmlAttribute(tag, "t") ?? "d";
      if (!name) {
        throw richValueError(
          "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID",
          `Rich Value Structure ${type} mempunyai key tanpa nama.`,
        );
      }
      return { name, valueType };
    });
    if (!keys.length) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID",
        `Rich Value Structure ${type} tidak mempunyai key.`,
      );
    }
    return { type, keys };
  });
}

function parseRichValueValues(xml: string) {
  const values: string[] = [];
  const pattern =
    /<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?v>|<(?:[A-Za-z_][\w.-]*:)?v\b[^>]*\/\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    values.push((match[1] ?? "").trim());
  }
  return values;
}

function parseRichValues(xml: string): ParsedRichValue[] {
  const sections = elementBlocks(xml, "rvData");
  if (sections.length !== 1) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_INVALID",
      "Rich Value Data part tidak valid.",
    );
  }
  return elementBlocks(sections[0]!.body, "rv").map((block) => {
    const structureIndex = Number(readXmlAttribute(block.openTag, "s"));
    if (!Number.isSafeInteger(structureIndex) || structureIndex < 0) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_INVALID",
        "Rich Value mempunyai structure index tidak valid.",
      );
    }
    const values = parseRichValueValues(block.body);
    if (!values.length) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_INVALID",
        "Rich Value tidak mempunyai value.",
      );
    }
    return { structureIndex, values };
  });
}

function parseRichValueRelationshipIds(xml: string) {
  const sections = elementBlocks(xml, "richValueRels");
  if (sections.length !== 1) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      "Rich Value Rels part tidak valid.",
    );
  }
  const tags = sections[0]!.body.match(/<(?:[A-Za-z_][\w.-]*:)?rel\b[^>]*\/?\s*>/gi) ?? [];
  return tags.map((tag) => {
    const relationshipId = readXmlAttribute(tag, "r:id");
    if (!relationshipId) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
        "Rich Value relationship tidak mempunyai r:id.",
      );
    }
    return relationshipId;
  });
}

function assertKnownRichDataRelationships(
  relationships: Map<string, Relationship>,
  sourcePath: string,
  allowedSuffixes: readonly string[],
) {
  for (const relationship of relationships.values()) {
    if (!allowedSuffixes.some((suffix) => relationship.type.endsWith(suffix))) {
      throw richValueError(
        "WORKBOOK_ACTIVE_CONTENT_REJECTED",
        `Rich-data relationship tidak didukung: ${sourcePath} -> ${relationship.type}.`,
      );
    }
  }
}

export function resolveProductBatchRichValueImages(
  workbookBuffer: Buffer,
): ProductBatchRichValueImage[] {
  let inspection;
  try {
    inspection = inspectStrictZipArchive(workbookBuffer, {
      maxArchiveBytes: PRODUCT_BATCH_IMPORT_LIMITS.xlsxUploadBytes,
      maxEntries: PRODUCT_BATCH_IMPORT_LIMITS.embeddedWorkbookArchiveEntries,
      maxUncompressedBytes: PRODUCT_BATCH_IMPORT_LIMITS.embeddedWorkbookUncompressedBytes,
      maxFileNameBytes: PRODUCT_BATCH_IMPORT_LIMITS.archiveEntryNameBytes,
    });
  } catch (error) {
    if (error instanceof StrictZipError) {
      throw richValueError("WORKBOOK_CONTAINER_INVALID", error.message, error);
    }
    throw error;
  }

  const entriesByPath = new Map(inspection.entries.map((entry) => [entry.path, entry]));
  const workbookXml = extractText(
    workbookBuffer,
    entriesByPath,
    "xl/workbook.xml",
    "WORKBOOK_OOXML_INVALID",
    "xl/workbook.xml tidak ditemukan.",
  );
  const workbookRelationshipsPath = "xl/_rels/workbook.xml.rels";
  const workbookRelationships = relationshipsById(
    extractText(
      workbookBuffer,
      entriesByPath,
      workbookRelationshipsPath,
      "WORKBOOK_OOXML_INVALID",
      "Relationship workbook tidak ditemukan.",
    ),
    workbookRelationshipsPath,
  );
  const sheetIds = parseWorkbookSheetRelationshipIds(workbookXml);
  const richValueCells: RichValueCell[] = [];

  for (const [sheetName, relationshipId] of sheetIds) {
    const relationship = workbookRelationships.get(relationshipId);
    if (!relationship || !relationship.type.endsWith(RELATIONSHIP_TYPE_WORKSHEET_SUFFIX)) {
      throw richValueError(
        "WORKBOOK_OOXML_INVALID",
        `Relationship worksheet ${sheetName} tidak valid.`,
      );
    }
    const worksheetPath = normalizeRelationshipTarget(
      "xl/workbook.xml",
      relationship.target,
    );
    const worksheetXml = extractText(
      workbookBuffer,
      entriesByPath,
      worksheetPath,
      "WORKBOOK_OOXML_INVALID",
      `Worksheet ${sheetName} tidak ditemukan.`,
    );
    richValueCells.push(...parseRichValueCells(worksheetXml, sheetName));
  }

  const richDataEntries = inspection.entries.filter(
    (entry) => !entry.isDirectory && entry.path.startsWith("xl/richData/"),
  );
  if (!richValueCells.length) {
    if (richDataEntries.length) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_UNREFERENCED",
        "Workbook mempunyai rich-data content tanpa Picture in Cell yang dapat dipetakan.",
      );
    }
    return [];
  }

  for (const cell of richValueCells) {
    const validTarget =
      (cell.sheetName === "PRODUCT_MASTERS" && cell.rowNumber > 1 && cell.columnIndex === 7) ||
      (cell.sheetName === "PHYSICAL_PRODUCTS" && cell.rowNumber > 1 && cell.columnIndex === 16) ||
      (cell.sheetName === PRODUCT_BATCH_IMPORT_V2_SHEET_NAME &&
        cell.rowNumber > 1 &&
        cell.columnIndex === 10);
    if (!validTarget) {
      throw richValueError(
        "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID",
        `Picture in Cell hanya boleh berada pada kolom foto yang didukung template, bukan ${cell.sheetName}!${cell.address}.`,
      );
    }
  }

  const metadataRelationship = relationshipByType(
    workbookRelationships.values(),
    RELATIONSHIP_TYPE_METADATA_SUFFIX,
    workbookRelationshipsPath,
    true,
  );
  const metadataPath = normalizeRelationshipTarget(
    "xl/workbook.xml",
    metadataRelationship!.target,
  );
  const metadataXml = extractText(
    workbookBuffer,
    entriesByPath,
    metadataPath,
    "WORKBOOK_RICH_VALUE_METADATA_INVALID",
    "Metadata workbook untuk Picture in Cell tidak ditemukan.",
  );
  const metadataTypeIndex = parseMetadataTypeIndex(metadataXml);
  const futureRichValueIndices = parseFutureRichValueIndices(metadataXml);
  const valueMetadataMap = parseValueMetadataMap(metadataXml, metadataTypeIndex);

  const workbookRelationshipSource: RelationshipSource = {
    relationships: workbookRelationships,
    relationshipsPath: workbookRelationshipsPath,
    sourcePartPath: "xl/workbook.xml",
  };
  const metadataRelationshipSource = loadOptionalRelationshipSource(
    workbookBuffer,
    entriesByPath,
    metadataPath,
    [RELATIONSHIP_TYPE_RICH_VALUE_SUFFIX],
  );
  const richValuePath = resolveRelationshipPathFromSources(
    [
      workbookRelationshipSource,
      ...(metadataRelationshipSource ? [metadataRelationshipSource] : []),
    ],
    RELATIONSHIP_TYPE_RICH_VALUE_SUFFIX,
    true,
    "Rich Value Data",
  )!;
  assertRichDataPartPath(richValuePath, "Rich Value Data");
  const richValueXml = extractText(
    workbookBuffer,
    entriesByPath,
    richValuePath,
    "WORKBOOK_RICH_VALUE_INVALID",
    "Rich Value Data part tidak ditemukan.",
  );
  const richValues = parseRichValues(richValueXml);

  const richValueRelationshipSource = loadOptionalRelationshipSource(
    workbookBuffer,
    entriesByPath,
    richValuePath,
    [
      RELATIONSHIP_TYPE_RICH_VALUE_STRUCTURE_SUFFIX,
      RELATIONSHIP_TYPE_RICH_VALUE_REL_SUFFIX,
      RELATIONSHIP_TYPE_RICH_VALUE_TYPES_SUFFIX,
    ],
  );
  const richValueTopologySources = [
    workbookRelationshipSource,
    ...(richValueRelationshipSource ? [richValueRelationshipSource] : []),
  ];
  const structurePath = resolveRelationshipPathFromSources(
    richValueTopologySources,
    RELATIONSHIP_TYPE_RICH_VALUE_STRUCTURE_SUFFIX,
    true,
    "Rich Value Structure",
  )!;
  assertRichDataPartPath(structurePath, "Rich Value Structure");
  const richValueRelsPath = resolveRelationshipPathFromSources(
    richValueTopologySources,
    RELATIONSHIP_TYPE_RICH_VALUE_REL_SUFFIX,
    true,
    "Rich Value Rels",
  )!;
  assertRichDataPartPath(richValueRelsPath, "Rich Value Rels");

  const structures = parseRichValueStructures(
    extractText(
      workbookBuffer,
      entriesByPath,
      structurePath,
      "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID",
      "Rich Value Structure part tidak ditemukan.",
    ),
  );

  const structureRelationshipSource = loadOptionalRelationshipSource(
    workbookBuffer,
    entriesByPath,
    structurePath,
    [RELATIONSHIP_TYPE_RICH_VALUE_TYPES_SUFFIX],
  );

  const richValueRelationshipIds = parseRichValueRelationshipIds(
    extractText(
      workbookBuffer,
      entriesByPath,
      richValueRelsPath,
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      "Rich Value Rels part tidak ditemukan.",
    ),
  );
  const richValueRelsRelationshipsPath = relationshipPartPath(richValueRelsPath);
  const richValueRelsRelationships = relationshipsById(
    extractText(
      workbookBuffer,
      entriesByPath,
      richValueRelsRelationshipsPath,
      "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
      "Relationship media Picture in Cell tidak ditemukan.",
    ),
    richValueRelsRelationshipsPath,
  );
  assertKnownRichDataRelationships(
    richValueRelsRelationships,
    richValueRelsRelationshipsPath,
    [RELATIONSHIP_TYPE_IMAGE_SUFFIX],
  );

  const usedRichValueIndices = new Set<number>();
  const usedRelationshipIndices = new Set<number>();
  const result: ProductBatchRichValueImage[] = [];

  for (const cell of richValueCells) {
    const futureMetadataIndex = valueMetadataMap.get(cell.valueMetadataIndex);
    if (futureMetadataIndex === undefined) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_METADATA_INVALID",
        `Picture in Cell ${cell.sheetName}!${cell.address} tidak mempunyai XLRICHVALUE metadata.`,
      );
    }
    const richValueIndex = futureRichValueIndices[futureMetadataIndex];
    if (richValueIndex === undefined || !Number.isSafeInteger(richValueIndex)) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_METADATA_INVALID",
        `Picture in Cell ${cell.sheetName}!${cell.address} menunjuk rich value yang tidak valid.`,
      );
    }
    if (usedRichValueIndices.has(richValueIndex)) {
      throw richValueError(
        "WORKBOOK_EMBEDDED_IMAGE_REUSED",
        `Satu Picture in Cell rich value tidak boleh dipakai oleh lebih dari satu cell: ${cell.sheetName}!${cell.address}.`,
      );
    }
    usedRichValueIndices.add(richValueIndex);

    const richValue = richValues[richValueIndex];
    if (!richValue) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_INVALID",
        `Rich value index ${richValueIndex} tidak ditemukan.`,
      );
    }
    const structure = structures[richValue.structureIndex];
    if (!structure || structure.type !== LOCAL_IMAGE_TYPE) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_IMAGE_UNSUPPORTED",
        `Hanya local Picture in Cell yang didukung; ${cell.sheetName}!${cell.address} bukan _localImage.`,
      );
    }
    if (richValue.values.length !== structure.keys.length) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_INVALID",
        `Jumlah value dan key _localImage tidak cocok pada ${cell.sheetName}!${cell.address}.`,
      );
    }
    const identifierKeyIndex = structure.keys.findIndex(
      (key) => key.name.toLocaleLowerCase("en-US") === LOCAL_IMAGE_IDENTIFIER_KEY.toLocaleLowerCase("en-US"),
    );
    if (
      identifierKeyIndex < 0 ||
      structure.keys[identifierKeyIndex]?.valueType !== "i"
    ) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID",
        "_localImage tidak mempunyai _rvRel:LocalImageIdentifier integer yang valid.",
      );
    }
    const relationshipIndex = Number(richValue.values[identifierKeyIndex]);
    if (
      !Number.isSafeInteger(relationshipIndex) ||
      relationshipIndex < 0 ||
      relationshipIndex >= richValueRelationshipIds.length
    ) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
        `Local image relationship index tidak valid pada ${cell.sheetName}!${cell.address}.`,
      );
    }
    if (usedRelationshipIndices.has(relationshipIndex)) {
      throw richValueError(
        "WORKBOOK_EMBEDDED_IMAGE_REUSED",
        `Satu Picture in Cell relationship tidak boleh dipakai ulang: index ${relationshipIndex}.`,
      );
    }
    usedRelationshipIndices.add(relationshipIndex);

    const relationshipId = richValueRelationshipIds[relationshipIndex]!;
    const imageRelationship = richValueRelsRelationships.get(relationshipId);
    if (!imageRelationship || !imageRelationship.type.endsWith(RELATIONSHIP_TYPE_IMAGE_SUFFIX)) {
      throw richValueError(
        "WORKBOOK_RICH_VALUE_RELATIONSHIP_INVALID",
        `Relationship ${relationshipId} bukan local embedded image.`,
      );
    }
    const mediaPath = normalizeRelationshipTarget(
      richValueRelsPath,
      imageRelationship.target,
    );
    if (!mediaPath.startsWith("xl/media/")) {
      throw richValueError(
        "WORKBOOK_EMBEDDED_IMAGE_LOCATION_INVALID",
        `Local Picture in Cell media harus berada pada xl/media/: ${mediaPath}.`,
      );
    }
    result.push({
      sheetName: cell.sheetName as
        | "PRODUCT_MASTERS"
        | "PHYSICAL_PRODUCTS"
        | "PRODUCTS",
      rowNumber: cell.rowNumber,
      columnIndex: cell.columnIndex,
      mediaPath,
    });
  }

  if (usedRichValueIndices.size !== richValues.length) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_UNREFERENCED",
      "Workbook mempunyai rich value yang tidak dipetakan ke image cell template.",
    );
  }
  if (usedRelationshipIndices.size !== richValueRelationshipIds.length) {
    throw richValueError(
      "WORKBOOK_RICH_VALUE_UNREFERENCED",
      "Workbook mempunyai local image relationship yang tidak dipetakan ke image cell template.",
    );
  }

  const richValueTypesPath = resolveRelationshipPathFromSources(
    [
      workbookRelationshipSource,
      ...(richValueRelationshipSource ? [richValueRelationshipSource] : []),
      ...(structureRelationshipSource ? [structureRelationshipSource] : []),
    ],
    RELATIONSHIP_TYPE_RICH_VALUE_TYPES_SUFFIX,
    false,
    "Rich Value Types",
  );
  if (richValueTypesPath) {
    assertRichDataPartPath(richValueTypesPath, "Rich Value Types");
    getEntry(
      entriesByPath,
      richValueTypesPath,
      "WORKBOOK_RICH_VALUE_STRUCTURE_INVALID",
      "Rich Value Types part tidak ditemukan.",
    );
    loadOptionalRelationshipSource(
      workbookBuffer,
      entriesByPath,
      richValueTypesPath,
      [],
    );
  }

  const allowedRichDataPaths = new Set([
    richValuePath,
    structurePath,
    richValueRelsPath,
    richValueRelsRelationshipsPath,
  ]);
  if (richValueRelationshipSource?.relationshipsPath.startsWith("xl/richData/")) {
    allowedRichDataPaths.add(richValueRelationshipSource.relationshipsPath);
  }
  if (structureRelationshipSource?.relationshipsPath.startsWith("xl/richData/")) {
    allowedRichDataPaths.add(structureRelationshipSource.relationshipsPath);
  }
  if (richValueTypesPath) {
    allowedRichDataPaths.add(richValueTypesPath);
    const typesRelationshipsPath = relationshipPartPath(richValueTypesPath);
    if (entriesByPath.has(typesRelationshipsPath)) {
      allowedRichDataPaths.add(typesRelationshipsPath);
    }
  }

  const unexpectedRichData = richDataEntries
    .map((entry) => entry.path)
    .filter((entryPath) => !allowedRichDataPaths.has(entryPath));
  if (unexpectedRichData.length) {
    throw richValueError(
      "WORKBOOK_ACTIVE_CONTENT_REJECTED",
      `Workbook mempunyai rich-data part yang tidak didukung: ${unexpectedRichData.slice(0, 5).join(", ")}.`,
    );
  }

  return result;
}
