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

export const serverEnv = {
  get APP_URL() {
    return appUrl("APP_URL");
  },

  get DATABASE_URL() {
    return required("DATABASE_URL");
  },

  get SESSION_SECRET() {
    return secret("SESSION_SECRET");
  },

  get DEFAULT_ORGANIZATION_SLUG() {
    return required("DEFAULT_ORGANIZATION_SLUG").toLowerCase();
  },
};
