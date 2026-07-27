function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur.`);
  }

  return value;
}

function secret(name: string): string {
  const value = required(name);

  if (value.length < 32) {
    throw new Error(`${name} minimal harus terdiri dari 32 karakter.`);
  }

  return value;
}

function appUrl(name: string): string {
  const value = required(name);

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} harus berupa URL valid.`);
  }
}

function internalRenderOrigin(): string {
  const configured = process.env.INTERNAL_RENDER_ORIGIN?.trim();
  const fallbackPort = process.env.PORT?.trim() || "3000";
  const value = configured || `http://127.0.0.1:${fallbackPort}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("INTERNAL_RENDER_ORIGIN harus berupa URL valid.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "INTERNAL_RENDER_ORIGIN harus berupa origin HTTP(S) tanpa path, credential, query, atau hash.",
    );
  }

  return url.origin;
}

export const serverEnv = {
  get APP_URL() {
    return appUrl("APP_URL");
  },

  get INTERNAL_RENDER_ORIGIN() {
    return internalRenderOrigin();
  },

  get DATABASE_URL() {
    return required("DATABASE_URL");
  },

  get SESSION_SECRET() {
    return secret("SESSION_SECRET");
  },

  get RECEIPT_VERIFICATION_SECRET() {
    return secret("RECEIPT_VERIFICATION_SECRET");
  },

  get CUSTOMER_HISTORY_SESSION_SECRET() {
    return secret("CUSTOMER_HISTORY_SESSION_SECRET");
  },

  get CUSTOMER_HISTORY_PIN_PEPPER() {
    return secret("CUSTOMER_HISTORY_PIN_PEPPER");
  },

  get PDF_RENDER_TOKEN_SECRET() {
    return secret("PDF_RENDER_TOKEN_SECRET");
  },

  get DEFAULT_ORGANIZATION_SLUG() {
    return required("DEFAULT_ORGANIZATION_SLUG").toLowerCase();
  },
};
