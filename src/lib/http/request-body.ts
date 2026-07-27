export class RequestBodyTooLargeError extends Error {
  constructor(message = "Request body terlalu besar.") {
    super(message);
    this.name = "RequestBodyTooLargeError";
  }
}

export class InvalidJsonBodyError extends Error {
  constructor(message = "Request body JSON tidak valid.") {
    super(message);
    this.name = "InvalidJsonBodyError";
  }
}

function assertMaxBytes(maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("maxBytes harus berupa bilangan bulat positif.");
  }
}

export async function readJsonBodyLimited<T = unknown>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  assertMaxBytes(maxBytes);

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    throw new InvalidJsonBodyError();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("request body too large").catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));

  try {
    return JSON.parse(body.toString("utf8")) as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}
