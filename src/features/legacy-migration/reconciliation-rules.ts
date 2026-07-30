import type {
  LegacyPhotoMigrationMetadata,
  LegacyPhotoMigrationStatus,
} from "@/features/legacy-migration/reconciliation-contracts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getLegacyPhotoMigrationMetadata(
  attributes: Record<string, unknown> | null | undefined,
): LegacyPhotoMigrationMetadata | null {
  const value = attributes?.legacyPhotoMigration;
  if (!isRecord(value)) return null;
  if (value.status !== "copied" && value.status !== "failed") return null;
  if (
    typeof value.attemptedAt !== "string" ||
    typeof value.sourceUrl !== "string"
  ) {
    return null;
  }

  return {
    status: value.status,
    attemptedAt: value.attemptedAt,
    sourceUrl: value.sourceUrl,
    finalUrl:
      typeof value.finalUrl === "string" ? value.finalUrl : undefined,
    imageKey:
      typeof value.imageKey === "string" ? value.imageKey : undefined,
    sourceBytes:
      typeof value.sourceBytes === "number" ? value.sourceBytes : undefined,
    contentType:
      typeof value.contentType === "string" ? value.contentType : undefined,
    copiedAt:
      typeof value.copiedAt === "string" ? value.copiedAt : undefined,
    errorCode:
      typeof value.errorCode === "string" ? value.errorCode : undefined,
    errorMessage:
      typeof value.errorMessage === "string" ? value.errorMessage : undefined,
  };
}

export function getLegacyPhotoMigrationStatus(input: {
  useLegacyImage: boolean;
  itemImageKey: string | null;
  attributes: Record<string, unknown> | null | undefined;
}): LegacyPhotoMigrationStatus {
  if (!input.useLegacyImage) return "not_required";
  if (input.itemImageKey) return "copied";

  return getLegacyPhotoMigrationMetadata(input.attributes)?.status === "failed"
    ? "failed"
    : "pending";
}

export function buildLegacyPhotoMigrationMetadata(input:
  | {
      status: "copied";
      attemptedAt: Date;
      sourceUrl: string;
      finalUrl: string;
      imageKey: string;
      sourceBytes: number;
      contentType: string;
    }
  | {
      status: "failed";
      attemptedAt: Date;
      sourceUrl: string;
      errorCode: string;
      errorMessage: string;
    }): LegacyPhotoMigrationMetadata {
  if (input.status === "copied") {
    return {
      status: "copied",
      attemptedAt: input.attemptedAt.toISOString(),
      copiedAt: input.attemptedAt.toISOString(),
      sourceUrl: input.sourceUrl,
      finalUrl: input.finalUrl,
      imageKey: input.imageKey,
      sourceBytes: input.sourceBytes,
      contentType: input.contentType,
    };
  }

  return {
    status: "failed",
    attemptedAt: input.attemptedAt.toISOString(),
    sourceUrl: input.sourceUrl,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage.slice(0, 500),
  };
}
