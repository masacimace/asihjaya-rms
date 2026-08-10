import { deflateRawSync } from "node:zlib";

import {
  calculateZipCrc32,
  extractStrictZipEntry,
  inspectStrictZipArchive,
} from "../../src/features/product-batch-import/zip-reader";

export type TestZipEntry = {
  path: string;
  data?: Buffer;
  method?: 0 | 8;
  flags?: number;
  versionMadeBy?: number;
  externalAttributes?: number;
  declaredUncompressedSize?: number;
  declaredCompressedSize?: number;
  declaredCrc32?: number;
};

function uint16(value: number) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function uint32(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

export function buildTestZip(entries: TestZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const spec of entries) {
    const data = spec.data ?? Buffer.alloc(0);
    const method = spec.method ?? 8;
    const flags = spec.flags ?? 0x0800;
    const fileName = Buffer.from(spec.path, "utf8");
    const compressed = method === 0 ? data : deflateRawSync(data);
    const crc32 = spec.declaredCrc32 ?? calculateZipCrc32(data);
    const compressedSize = spec.declaredCompressedSize ?? compressed.length;
    const uncompressedSize = spec.declaredUncompressedSize ?? data.length;
    const versionMadeBy = spec.versionMadeBy ?? 0x0314;
    const externalAttributes = spec.externalAttributes ?? (spec.path.endsWith("/") ? 0x10 : 0);

    const localHeader = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(flags),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(crc32),
      uint32(compressedSize),
      uint32(uncompressedSize),
      uint16(fileName.length),
      uint16(0),
      fileName,
    ]);
    localParts.push(localHeader, compressed);

    const centralHeader = Buffer.concat([
      uint32(0x02014b50),
      uint16(versionMadeBy),
      uint16(20),
      uint16(flags),
      uint16(method),
      uint16(0),
      uint16(0),
      uint32(crc32),
      uint32(compressedSize),
      uint32(uncompressedSize),
      uint16(fileName.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(externalAttributes),
      uint32(localOffset),
      fileName,
    ]);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const eocd = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.length),
    uint32(localData.length),
    uint16(0),
  ]);
  return Buffer.concat([localData, centralDirectory, eocd]);
}

export function repackZipWithExtraEntries(buffer: Buffer, extras: TestZipEntry[]): Buffer {
  const inspection = inspectStrictZipArchive(buffer, {
    maxArchiveBytes: 10 * 1024 * 1024,
    maxEntries: 1_000,
    maxUncompressedBytes: 64 * 1024 * 1024,
    maxFileNameBytes: 1_024,
  });
  const existing: TestZipEntry[] = inspection.entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({
      path: entry.path,
      data: extractStrictZipEntry(buffer, entry),
      method: entry.compressionMethod,
    }));
  return buildTestZip([...existing, ...extras]);
}
