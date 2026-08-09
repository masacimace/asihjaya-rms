import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  EnvironmentValidationError,
  assertServerEnvironment,
  collectServerEnvironmentIssues,
  getBootstrapEnvironment,
  type EnvironmentSource,
} from "../src/lib/env";

const environmentExample = readFileSync(".env.example", "utf8");
for (const name of [
  "SESSION_SECRET",
  "RECEIPT_VERIFICATION_SECRET",
  "CUSTOMER_HISTORY_SESSION_SECRET",
  "CUSTOMER_HISTORY_PIN_PEPPER",
  "SECURITY_RATE_LIMIT_SECRET",
  "PDF_RENDER_TOKEN_SECRET",
  "HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY",
  "BOOTSTRAP_ADMIN_PASSWORD",
]) {
  assert.match(
    environmentExample,
    new RegExp(`^${name}=CHANGE_ME$`, "m"),
    `.env.example harus memakai placeholder aman untuk ${name}.`,
  );
}

function makeSecret(label: string): string {
  return `${label}-${"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"}`;
}

function makeProductionEnvironment(): Record<string, string> {
  const releaseId = "20260809T010203Z-0123456789ab";
  const environment = {
    NODE_ENV: "production",
    ASIHJAYA_ENV_FILE: ".env.production",
    ASIHJAYA_BIND_ADDRESS: "127.0.0.1",
    ASIHJAYA_APP_PORT: "3000",
    APP_RELEASE_ID: releaseId,
    APP_REVISION: "0123456789abcdef0123456789abcdef01234567",
    APP_BUILD_DATE: "2026-08-09T01:02:03.000Z",
    ASIHJAYA_IMAGE: `asihjaya-rms:${releaseId}`,
    ASIHJAYA_MIGRATOR_IMAGE: `asihjaya-rms-migrator:${releaseId}`,
    ASIHJAYA_OPERATIONS_IMAGE: `asihjaya-rms-operations:${releaseId}`,
    APP_URL: "https://ajsystem.id",
    NEXT_PUBLIC_APP_URL: "https://ajsystem.id",
    INTERNAL_RENDER_ORIGIN: "http://127.0.0.1:3000",
    POSTGRES_DB: "asihjaya_rms",
    POSTGRES_USER: "app",
    POSTGRES_PASSWORD: makeSecret("postgres-password"),
    DEFAULT_ORGANIZATION_SLUG: "asihjaya",
    SESSION_SECRET: makeSecret("session"),
    RECEIPT_VERIFICATION_SECRET: makeSecret("receipt"),
    CUSTOMER_HISTORY_SESSION_SECRET: makeSecret("history-session"),
    CUSTOMER_HISTORY_PIN_PEPPER: makeSecret("history-pin"),
    SECURITY_RATE_LIMIT_SECRET: makeSecret("rate-limit"),
    PDF_RENDER_TOKEN_SECRET: makeSecret("pdf-render"),
    HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY: makeSecret("agent-encryption"),
    TRUST_PROXY: "true",
    TRUST_PROXY_HOPS: "2",
    IMAGE_STORAGE_DRIVER: "local",
    HARDWARE_AGENT_AUTH_MODE: "signed-only",
  };

  return {
    ...environment,
    DATABASE_URL: `postgresql://${environment.POSTGRES_USER}:${environment.POSTGRES_PASSWORD}@db:5432/${environment.POSTGRES_DB}`,
  };
}

function issueNames(
  source: EnvironmentSource,
  requireDeployment = false,
): string[] {
  return collectServerEnvironmentIssues(source, {
    mode: "production",
    requireCore: true,
    requireDeployment,
  }).map((issue) => issue.name);
}

const validProduction = makeProductionEnvironment();
assert.doesNotThrow(() => {
  assertServerEnvironment(validProduction, {
    mode: "production",
    requireCore: true,
  });
});
assert.doesNotThrow(() => {
  assertServerEnvironment(validProduction, {
    mode: "production",
    requireCore: true,
    requireDeployment: true,
  });
});

const mismatchedDatabaseCredential = {
  ...validProduction,
  POSTGRES_PASSWORD: makeSecret("different-postgres-password"),
};
assert(
  issueNames(mismatchedDatabaseCredential, true).includes("DATABASE_URL"),
  "DATABASE_URL harus konsisten dengan POSTGRES_PASSWORD deployment.",
);

const publicBindAddress = {
  ...validProduction,
  ASIHJAYA_BIND_ADDRESS: "0.0.0.0",
};
assert(
  issueNames(publicBindAddress, true).includes("ASIHJAYA_BIND_ADDRESS"),
  "Production app tidak boleh bind langsung ke interface publik.",
);

const weakProductionSecret = {
  ...validProduction,
  SESSION_SECRET: "a".repeat(64),
};
assert(
  issueNames(weakProductionSecret).includes("SESSION_SECRET"),
  "Secret production dengan diversity rendah harus ditolak.",
);

const missingCore = { NODE_ENV: "production" };
const missingNames = issueNames(missingCore);
for (const name of [
  "APP_URL",
  "DATABASE_URL",
  "SESSION_SECRET",
  "HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY",
]) {
  assert(
    missingNames.includes(name),
    `${name} wajib terdeteksi ketika tidak diatur.`,
  );
}

const insecurePublicUrl = {
  ...validProduction,
  APP_URL: "http://ajsystem.id",
};
assert(
  issueNames(insecurePublicUrl).includes("APP_URL"),
  "APP_URL public production tanpa HTTPS harus ditolak.",
);

const loopbackProduction = {
  ...validProduction,
  APP_URL: "http://127.0.0.1:3000",
  TRUST_PROXY: "false",
};
assert.doesNotThrow(() => {
  assertServerEnvironment(loopbackProduction, {
    mode: "production",
    requireCore: true,
  });
});

const reusedSecret = {
  ...validProduction,
  PDF_RENDER_TOKEN_SECRET: validProduction.SESSION_SECRET,
};
assert(
  issueNames(reusedSecret).includes("PDF_RENDER_TOKEN_SECRET"),
  "Secret yang dipakai ulang harus ditolak.",
);

const placeholderSecret = {
  ...validProduction,
  SESSION_SECRET: "CHANGE_ME_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS",
};
assert(
  issueNames(placeholderSecret).includes("SESSION_SECRET"),
  "Placeholder secret harus ditolak.",
);

const incompleteS3 = {
  ...validProduction,
  IMAGE_STORAGE_DRIVER: "s3",
  IMAGE_STORAGE_REGION: "auto",
};
const incompleteS3Issues = issueNames(incompleteS3);
for (const name of [
  "IMAGE_STORAGE_BUCKET",
  "IMAGE_STORAGE_ACCESS_KEY_ID",
  "IMAGE_STORAGE_SECRET_ACCESS_KEY",
  "IMAGE_STORAGE_ENDPOINT",
]) {
  assert(
    incompleteS3Issues.includes(name),
    `${name} wajib untuk storage S3 terkait.`,
  );
}

const legacyOnly = {
  ...validProduction,
  HARDWARE_AGENT_AUTH_MODE: "legacy-only",
};
assert(
  issueNames(legacyOnly).includes("HARDWARE_AGENT_AUTH_MODE"),
  "Mode hardware legacy-only harus ditolak untuk production normal.",
);

const invalidNumeric = {
  ...validProduction,
  PDF_RENDER_MAX_CONCURRENCY: "1000",
};
assert(
  issueNames(invalidNumeric).includes("PDF_RENDER_MAX_CONCURRENCY"),
  "Nilai numerik di luar batas harus ditolak.",
);

const bootstrapEnvironment = {
  BOOTSTRAP_ORGANIZATION_NAME: "Asihjaya",
  BOOTSTRAP_ORGANIZATION_SLUG: "asihjaya",
  BOOTSTRAP_OUTLET_CODE: "TOKO-BG",
  BOOTSTRAP_OUTLET_NAME: "Bantar Gebang",
  BOOTSTRAP_REGISTER_CODE: "POS-BG1",
  BOOTSTRAP_REGISTER_NAME: "Kasir Bantar Gebang 1",
  BOOTSTRAP_ADMIN_NAME: "System Administrator",
  BOOTSTRAP_ADMIN_USERNAME: "admin",
  BOOTSTRAP_ADMIN_EMAIL: "admin@asihjaya.local",
  BOOTSTRAP_ADMIN_PASSWORD: "a-strong-bootstrap-password",
};
assert.equal(
  getBootstrapEnvironment(bootstrapEnvironment).outletCode,
  "TOKO-BG",
);

assert.throws(
  () =>
    getBootstrapEnvironment({
      ...bootstrapEnvironment,
      BOOTSTRAP_ADMIN_PASSWORD: "CHANGE_ME_BEFORE_SEEDING",
    }),
  EnvironmentValidationError,
);

console.log(
  "Environment validation checks passed: production core/deployment, secret entropy, database consistency, proxy, storage, runtime bounds, dan bootstrap seed.",
);
