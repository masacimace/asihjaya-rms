import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type JournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

export type MigrationDescriptor = {
  index: number;
  tag: string;
  createdAt: string;
  hash: string;
  sql: string;
  filePath: string;
};

export type AppliedMigration = {
  id: number;
  hash: string;
  createdAt: string;
};

export type MigrationHistoryAnalysis = {
  appliedCount: number;
  pending: MigrationDescriptor[];
};

export type DestructiveMigrationFinding = {
  migrationTag: string;
  operation: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
}

const destructivePatterns: Array<{ operation: string; pattern: RegExp }> = [
  { operation: "DROP SCHEMA", pattern: /\bDROP\s+SCHEMA\b/i },
  { operation: "DROP TABLE", pattern: /\bDROP\s+TABLE\b/i },
  { operation: "DROP COLUMN", pattern: /\bDROP\s+COLUMN\b/i },
  { operation: "DROP TYPE", pattern: /\bDROP\s+TYPE\b/i },
  { operation: "TRUNCATE", pattern: /\bTRUNCATE(?:\s+TABLE)?\b/i },
  { operation: "DELETE FROM", pattern: /\bDELETE\s+FROM\b/i },
  {
    operation: "ALTER COLUMN TYPE",
    pattern: /\bALTER\s+TABLE\b[\s\S]*?\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i,
  },
  {
    operation: "DROP CONSTRAINT",
    pattern: /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+CONSTRAINT\b/i,
  },
];

export function loadMigrationPlan(migrationsDirectory: string): MigrationDescriptor[] {
  const absoluteDirectory = path.resolve(migrationsDirectory);
  const journalPath = path.join(absoluteDirectory, "meta", "_journal.json");
  assert(existsSync(journalPath), `Migration journal tidak ditemukan: ${journalPath}.`);

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    version: string;
    dialect: string;
    entries: JournalEntry[];
  };

  assert(journal.version === "7", "Versi migration journal harus 7.");
  assert(journal.dialect === "postgresql", "Migration journal harus memakai PostgreSQL.");

  return journal.entries.map((entry, index) => {
    assert(entry.idx === index, `Migration idx ${entry.idx} tidak berurutan pada posisi ${index}.`);
    assert(Number.isSafeInteger(entry.when) && entry.when > 0, `Timestamp migration ${entry.tag} tidak valid.`);
    const filePath = path.join(absoluteDirectory, `${entry.tag}.sql`);
    assert(existsSync(filePath), `Migration SQL tidak ditemukan: ${filePath}.`);
    const sql = readFileSync(filePath, "utf8");
    assert(sql.trim().length > 0, `Migration SQL kosong: ${filePath}.`);

    return {
      index,
      tag: entry.tag,
      createdAt: String(entry.when),
      hash: sha256(sql),
      sql,
      filePath,
    };
  });
}

export function analyzeMigrationHistory(
  localMigrations: readonly MigrationDescriptor[],
  appliedMigrations: readonly AppliedMigration[],
): MigrationHistoryAnalysis {
  if (appliedMigrations.length > localMigrations.length) {
    throw new Error(
      `Database memiliki ${appliedMigrations.length} migration, tetapi release hanya membawa ${localMigrations.length}. Release lama tidak boleh dijalankan terhadap schema yang lebih baru.`,
    );
  }

  for (const [index, applied] of appliedMigrations.entries()) {
    const local = localMigrations[index];
    assert(local, `Migration lokal pada posisi ${index} tidak tersedia.`);

    if (applied.createdAt !== local.createdAt) {
      throw new Error(
        `Riwayat migration database berbeda pada posisi ${index}: timestamp database ${applied.createdAt}, release ${local.createdAt}.`,
      );
    }
    if (applied.hash !== local.hash) {
      throw new Error(
        `Riwayat migration database berbeda pada ${local.tag}: hash SQL tidak cocok. Migration yang sudah diterapkan tidak boleh diedit.`,
      );
    }
  }

  return {
    appliedCount: appliedMigrations.length,
    pending: localMigrations.slice(appliedMigrations.length),
  };
}

export function findDestructiveMigrationFindings(
  migrations: readonly MigrationDescriptor[],
): DestructiveMigrationFinding[] {
  const findings: DestructiveMigrationFinding[] = [];

  for (const migration of migrations) {
    const normalizedSql = stripSqlComments(migration.sql);
    for (const rule of destructivePatterns) {
      if (rule.pattern.test(normalizedSql)) {
        findings.push({ migrationTag: migration.tag, operation: rule.operation });
      }
    }
  }

  return findings;
}

export function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  maximum: number,
): number {
  if (!value?.trim()) return fallback;
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${name} harus berupa bilangan bulat positif.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`${name} harus berada pada rentang 1 sampai ${maximum}.`);
  }
  return parsed;
}

export function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (!value?.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new Error("Nilai boolean migration harus true atau false.");
}
