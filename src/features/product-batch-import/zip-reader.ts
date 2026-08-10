import { inflateRawSync } from "node:zlib";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const MIN_EOCD_SIZE = 22;
const MAX_ZIP_COMMENT_BYTES = 65_535;
const ZIP64_EXTRA_FIELD_ID = 0x0001;

const FLAG_ENCRYPTED = 0x0001;
const FLAG_DATA_DESCRIPTOR = 0x0008;
const FLAG_PATCHED_DATA = 0x0020;
const FLAG_STRONG_ENCRYPTION = 0x0040;
const FLAG_UTF8 = 0x0800;
const FLAG_MASKED_LOCAL_HEADER = 0x2000;

const SUPPORTED_METHODS = new Set([0, 8]);

export type StrictZipLimits = {
  maxArchiveBytes: number;
  maxEntries: number;
  maxUncompressedBytes: number;
  maxEntryUncompressedBytes?: number;
  maxFileNameBytes?: number;
};

export type StrictZipEntry = {
  path: string;
  isDirectory: boolean;
  compressionMethod: 0 | 8;
  generalPurposeFlags: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  externalAttributes: number;
  versionMadeBy: number;
};

export type StrictZipInspection = {
  entries: StrictZipEntry[];
  centralDirectoryOffset: number;
  centralDirectorySize: number;
};

export class StrictZipError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StrictZipError";
  }
}

function zipError(code: string, message: string, cause?: unknown): StrictZipError {
  return new StrictZipError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function readUInt16(buffer: Buffer, offset: number, label: string): number {
  if (offset < 0 || offset + 2 > buffer.length) {
    throw zipError("ZIP_TRUNCATED", `${label} ZIP terpotong.`);
  }
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number, label: string): number {
  if (offset < 0 || offset + 4 > buffer.length) {
    throw zipError("ZIP_TRUNCATED", `${label} ZIP terpotong.`);
  }
  return buffer.readUInt32LE(offset);
}

function assertNoZip64Extra(extra: Buffer, label: string): void {
  let cursor = 0;
  while (cursor < extra.length) {
    if (cursor + 4 > extra.length) {
      throw zipError("ZIP_EXTRA_INVALID", `${label} mempunyai extra field ZIP yang rusak.`);
    }
    const id = extra.readUInt16LE(cursor);
    const size = extra.readUInt16LE(cursor + 2);
    cursor += 4;
    if (cursor + size > extra.length) {
      throw zipError("ZIP_EXTRA_INVALID", `${label} mempunyai extra field ZIP yang rusak.`);
    }
    if (id === ZIP64_EXTRA_FIELD_ID) {
      throw zipError("ZIP64_UNSUPPORTED", "ZIP64 tidak didukung untuk Product Batch Import.");
    }
    cursor += size;
  }
}

function decodeEntryName(bytes: Buffer, flags: number): string {
  if (bytes.length === 0) {
    throw zipError("ZIP_PATH_INVALID", "Archive mempunyai entry tanpa nama.");
  }

  if ((flags & FLAG_UTF8) !== 0) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (error) {
      throw zipError("ZIP_PATH_INVALID", "Nama entry UTF-8 pada ZIP tidak valid.", error);
    }
  }

  if (bytes.some((value) => value > 0x7f)) {
    throw zipError(
      "ZIP_PATH_ENCODING_UNSUPPORTED",
      "Nama file non-ASCII harus disimpan sebagai UTF-8 oleh pembuat ZIP.",
    );
  }

  return bytes.toString("ascii");
}

function normalizeZipPath(path: string): string {
  if (!path || path.includes("\0") || path.includes("\\")) {
    throw zipError("ZIP_PATH_INVALID", `Path ZIP tidak valid: ${JSON.stringify(path)}.`);
  }

  const normalized = path.normalize("NFKC");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.includes("//")
  ) {
    throw zipError("ZIP_PATH_INVALID", `Path ZIP tidak valid: ${normalized}.`);
  }

  const isDirectory = normalized.endsWith("/");
  const segments = normalized.split("/");
  if (isDirectory) segments.pop();

  if (
    segments.length === 0 ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw zipError("ZIP_PATH_TRAVERSAL", `Path ZIP berbahaya ditolak: ${normalized}.`);
  }

  return isDirectory ? `${segments.join("/")}/` : segments.join("/");
}

function findEocdOffset(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - MIN_EOCD_SIZE - MAX_ZIP_COMMENT_BYTES);
  for (let offset = buffer.length - MIN_EOCD_SIZE; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = readUInt16(buffer, offset + 20, "EOCD");
    if (offset + MIN_EOCD_SIZE + commentLength === buffer.length) return offset;
  }
  throw zipError("ZIP_EOCD_MISSING", "End of central directory ZIP tidak ditemukan.");
}

function assertSupportedFlags(flags: number): void {
  const unsupported =
    flags &
    (FLAG_ENCRYPTED | FLAG_PATCHED_DATA | FLAG_STRONG_ENCRYPTION | FLAG_MASKED_LOCAL_HEADER);
  if (unsupported !== 0) {
    throw zipError("ZIP_FEATURE_UNSUPPORTED", "ZIP terenkripsi/fitur ZIP lanjutan tidak didukung.");
  }
}

function isUnixSymlink(versionMadeBy: number, externalAttributes: number): boolean {
  const hostSystem = (versionMadeBy >>> 8) & 0xff;
  if (hostSystem !== 3) return false;
  const unixMode = (externalAttributes >>> 16) & 0xffff;
  return (unixMode & 0o170000) === 0o120000;
}

function isDirectoryEntry(path: string, versionMadeBy: number, externalAttributes: number): boolean {
  if (path.endsWith("/")) return true;
  const hostSystem = (versionMadeBy >>> 8) & 0xff;
  if (hostSystem === 3) {
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    if ((unixMode & 0o170000) === 0o040000) return true;
  }
  return (externalAttributes & 0x10) !== 0;
}

export function inspectStrictZipArchive(
  buffer: Buffer,
  limits: StrictZipLimits,
): StrictZipInspection {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw zipError("ZIP_SIGNATURE_INVALID", "Signature ZIP tidak valid.");
  }
  if (buffer.length > limits.maxArchiveBytes) {
    throw zipError("ZIP_TOO_LARGE", "Ukuran archive melebihi batas yang diizinkan.");
  }

  const eocdOffset = findEocdOffset(buffer);
  const diskNumber = readUInt16(buffer, eocdOffset + 4, "EOCD");
  const centralDirectoryDisk = readUInt16(buffer, eocdOffset + 6, "EOCD");
  const entriesOnDisk = readUInt16(buffer, eocdOffset + 8, "EOCD");
  const totalEntries = readUInt16(buffer, eocdOffset + 10, "EOCD");
  const centralDirectorySize = readUInt32(buffer, eocdOffset + 12, "EOCD");
  const centralDirectoryOffset = readUInt32(buffer, eocdOffset + 16, "EOCD");

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw zipError("ZIP_MULTIDISK_UNSUPPORTED", "ZIP multi-disk tidak didukung.");
  }
  if (
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw zipError("ZIP64_UNSUPPORTED", "ZIP64 tidak didukung untuk Product Batch Import.");
  }
  if (totalEntries === 0) {
    throw zipError("ZIP_EMPTY", "ZIP tidak boleh kosong.");
  }
  if (totalEntries > limits.maxEntries) {
    throw zipError("ZIP_TOO_MANY_ENTRIES", `ZIP melebihi batas ${limits.maxEntries} entries.`);
  }
  if (centralDirectoryOffset + centralDirectorySize !== eocdOffset) {
    throw zipError("ZIP_CENTRAL_DIRECTORY_INVALID", "Central directory ZIP tidak konsisten.");
  }
  if (centralDirectoryOffset < 0 || centralDirectoryOffset >= buffer.length) {
    throw zipError("ZIP_CENTRAL_DIRECTORY_INVALID", "Offset central directory ZIP tidak valid.");
  }

  const entries: StrictZipEntry[] = [];
  const normalizedPaths = new Set<string>();
  let totalUncompressed = 0;
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (readUInt32(buffer, cursor, "Central directory") !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw zipError("ZIP_CENTRAL_DIRECTORY_INVALID", "Header central directory ZIP tidak valid.");
    }

    const versionMadeBy = readUInt16(buffer, cursor + 4, "Central directory");
    const flags = readUInt16(buffer, cursor + 8, "Central directory");
    const method = readUInt16(buffer, cursor + 10, "Central directory");
    const crc32 = readUInt32(buffer, cursor + 16, "Central directory");
    const compressedSize = readUInt32(buffer, cursor + 20, "Central directory");
    const uncompressedSize = readUInt32(buffer, cursor + 24, "Central directory");
    const fileNameLength = readUInt16(buffer, cursor + 28, "Central directory");
    const extraLength = readUInt16(buffer, cursor + 30, "Central directory");
    const commentLength = readUInt16(buffer, cursor + 32, "Central directory");
    const diskStart = readUInt16(buffer, cursor + 34, "Central directory");
    const externalAttributes = readUInt32(buffer, cursor + 38, "Central directory");
    const localHeaderOffset = readUInt32(buffer, cursor + 42, "Central directory");

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      diskStart === 0xffff
    ) {
      throw zipError("ZIP64_UNSUPPORTED", "ZIP64 tidak didukung untuk Product Batch Import.");
    }
    if (diskStart !== 0) {
      throw zipError("ZIP_MULTIDISK_UNSUPPORTED", "ZIP multi-disk tidak didukung.");
    }
    assertSupportedFlags(flags);
    if (!SUPPORTED_METHODS.has(method)) {
      throw zipError("ZIP_COMPRESSION_UNSUPPORTED", `Compression method ZIP ${method} tidak didukung.`);
    }
    if (fileNameLength > (limits.maxFileNameBytes ?? 512)) {
      throw zipError("ZIP_PATH_TOO_LONG", "Nama entry ZIP terlalu panjang.");
    }

    const variableStart = cursor + 46;
    const variableEnd = variableStart + fileNameLength + extraLength + commentLength;
    if (variableEnd > centralDirectoryOffset + centralDirectorySize) {
      throw zipError("ZIP_CENTRAL_DIRECTORY_INVALID", "Entry central directory ZIP terpotong.");
    }

    const nameBytes = buffer.subarray(variableStart, variableStart + fileNameLength);
    const extra = buffer.subarray(
      variableStart + fileNameLength,
      variableStart + fileNameLength + extraLength,
    );
    assertNoZip64Extra(extra, "Central directory");
    const path = normalizeZipPath(decodeEntryName(nameBytes, flags));
    const duplicateKey = path.normalize("NFKC");
    if (normalizedPaths.has(duplicateKey)) {
      throw zipError("ZIP_DUPLICATE_ENTRY", `Duplicate archive entry ditolak: ${path}.`);
    }
    normalizedPaths.add(duplicateKey);

    if (isUnixSymlink(versionMadeBy, externalAttributes)) {
      throw zipError("ZIP_SYMLINK_UNSUPPORTED", `Symlink ZIP ditolak: ${path}.`);
    }

    const isDirectory = isDirectoryEntry(path, versionMadeBy, externalAttributes);
    if (isDirectory && (compressedSize !== 0 || uncompressedSize !== 0)) {
      throw zipError("ZIP_DIRECTORY_INVALID", `Directory ZIP harus kosong: ${path}.`);
    }
    if (limits.maxEntryUncompressedBytes !== undefined && uncompressedSize > limits.maxEntryUncompressedBytes) {
      throw zipError("ZIP_ENTRY_TOO_LARGE", `Entry ZIP terlalu besar: ${path}.`);
    }

    totalUncompressed += uncompressedSize;
    if (!Number.isSafeInteger(totalUncompressed) || totalUncompressed > limits.maxUncompressedBytes) {
      throw zipError("ZIP_BOMB_LIMIT", "Total ukuran uncompressed ZIP melebihi batas keamanan.");
    }

    entries.push({
      path,
      isDirectory,
      compressionMethod: method as 0 | 8,
      generalPurposeFlags: flags,
      crc32,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      externalAttributes,
      versionMadeBy,
    });
    cursor = variableEnd;
  }

  if (cursor !== centralDirectoryOffset + centralDirectorySize) {
    throw zipError("ZIP_CENTRAL_DIRECTORY_INVALID", "Ukuran central directory ZIP tidak konsisten.");
  }

  const ranges = entries
    .map((entry) => {
      const offset = entry.localHeaderOffset;
      if (readUInt32(buffer, offset, "Local header") !== LOCAL_FILE_HEADER_SIGNATURE) {
        throw zipError("ZIP_LOCAL_HEADER_INVALID", `Local header ZIP tidak valid: ${entry.path}.`);
      }
      const localFlags = readUInt16(buffer, offset + 6, "Local header");
      const localMethod = readUInt16(buffer, offset + 8, "Local header");
      const localCrc = readUInt32(buffer, offset + 14, "Local header");
      const localCompressedSize = readUInt32(buffer, offset + 18, "Local header");
      const localUncompressedSize = readUInt32(buffer, offset + 22, "Local header");
      const localNameLength = readUInt16(buffer, offset + 26, "Local header");
      const localExtraLength = readUInt16(buffer, offset + 28, "Local header");
      const nameStart = offset + 30;
      const extraStart = nameStart + localNameLength;
      const dataStart = extraStart + localExtraLength;
      const dataEnd = dataStart + entry.compressedSize;

      if (dataEnd > centralDirectoryOffset || dataStart < 0) {
        throw zipError("ZIP_LOCAL_HEADER_INVALID", `Data entry ZIP keluar batas: ${entry.path}.`);
      }
      const localName = normalizeZipPath(
        decodeEntryName(buffer.subarray(nameStart, extraStart), localFlags),
      );
      if (localName !== entry.path || localMethod !== entry.compressionMethod || localFlags !== entry.generalPurposeFlags) {
        throw zipError("ZIP_LOCAL_HEADER_MISMATCH", `Local header tidak cocok dengan central directory: ${entry.path}.`);
      }
      assertNoZip64Extra(buffer.subarray(extraStart, dataStart), "Local header");
      if ((localFlags & FLAG_DATA_DESCRIPTOR) === 0) {
        if (
          localCrc !== entry.crc32 ||
          localCompressedSize !== entry.compressedSize ||
          localUncompressedSize !== entry.uncompressedSize
        ) {
          throw zipError("ZIP_LOCAL_HEADER_MISMATCH", `Ukuran/CRC local header tidak cocok: ${entry.path}.`);
        }
      }

      return { start: offset, end: dataEnd, entry };
    })
    .sort((left, right) => left.start - right.start);

  for (let index = 1; index < ranges.length; index += 1) {
    if ((ranges[index - 1]?.end ?? 0) > (ranges[index]?.start ?? 0)) {
      throw zipError("ZIP_ENTRY_OVERLAP", "Data entry ZIP saling overlap.");
    }
  }

  return { entries, centralDirectoryOffset, centralDirectorySize };
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

export function calculateZipCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function extractStrictZipEntry(buffer: Buffer, entry: StrictZipEntry): Buffer {
  if (entry.isDirectory) return Buffer.alloc(0);

  const offset = entry.localHeaderOffset;
  const nameLength = readUInt16(buffer, offset + 26, "Local header");
  const extraLength = readUInt16(buffer, offset + 28, "Local header");
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressed = buffer.subarray(dataStart, dataEnd);

  let output: Buffer;
  try {
    output =
      entry.compressionMethod === 0
        ? Buffer.from(compressed)
        : inflateRawSync(compressed, {
            maxOutputLength: Math.max(entry.uncompressedSize, 1),
          });
  } catch (error) {
    throw zipError("ZIP_DECOMPRESSION_FAILED", `Entry ZIP gagal didekompresi: ${entry.path}.`, error);
  }

  if (output.length !== entry.uncompressedSize) {
    throw zipError("ZIP_SIZE_MISMATCH", `Ukuran hasil extraction tidak cocok: ${entry.path}.`);
  }
  if (calculateZipCrc32(output) !== entry.crc32) {
    throw zipError("ZIP_CRC_MISMATCH", `CRC entry ZIP tidak cocok: ${entry.path}.`);
  }
  return output;
}
