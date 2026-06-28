import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 3;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error("Kata sandi minimal harus terdiri dari 8 karakter.");
  }

  if (password.length > 1024) {
    throw new Error("Kata sandi terlalu panjang.");
  }

  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt);

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  try {
    const [algorithm, encodedN, encodedR, encodedP, encodedSalt, encodedKey] =
      encodedHash.split("$");

    if (
      algorithm !== "scrypt" ||
      !encodedN ||
      !encodedR ||
      !encodedP ||
      !encodedSalt ||
      !encodedKey
    ) {
      return false;
    }

    const n = Number(encodedN);
    const r = Number(encodedR);
    const p = Number(encodedP);

    /*
     * Untuk saat ini hanya menerima konfigurasi yang
     * dibuat oleh aplikasi kita sendiri.
     */
    if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) {
      return false;
    }

    const salt = Buffer.from(encodedSalt, "base64url");

    const storedKey = Buffer.from(encodedKey, "base64url");

    const derivedKey = await deriveKey(password, salt);

    if (storedKey.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}
