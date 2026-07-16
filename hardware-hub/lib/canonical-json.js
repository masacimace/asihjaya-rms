/* eslint-disable */
const { createHash } = require("crypto");

function canonicalizeJsonValue(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON tidak menerima NaN atau Infinity.");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJsonValue(entry));
  }

  if (value && typeof value === "object") {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      const entry = value[key];
      if (entry === undefined || typeof entry === "function" || typeof entry === "symbol") {
        continue;
      }
      normalized[key] = canonicalizeJsonValue(entry);
    }
    return normalized;
  }

  throw new TypeError(`Canonical JSON tidak mendukung value bertipe ${typeof value}.`);
}

function stringifyCanonicalJson(value) {
  return JSON.stringify(canonicalizeJsonValue(value));
}

function hashCanonicalJson(value) {
  return createHash("sha256").update(stringifyCanonicalJson(value), "utf8").digest("hex");
}

module.exports = {
  canonicalizeJsonValue,
  stringifyCanonicalJson,
  hashCanonicalJson,
};
