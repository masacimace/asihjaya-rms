import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";

export type TelegramMockScenario =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "invalid_chat"
  | "rate_limited"
  | "server_error"
  | "malformed"
  | "timeout";

type StartTelegramMockServerOptions = {
  port?: number;
  host?: string;
  scenario?: TelegramMockScenario;
  silent?: boolean;
};

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(
  request: import("node:http").IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
    string,
    unknown
  >;
}

function numericChatId(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : -1001234567890;
}

export async function startTelegramMockServer(
  options: StartTelegramMockServerOptions = {},
): Promise<{ server: Server; origin: string }> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const scenario = options.scenario ?? "success";

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${host}`);
    const methodMatch = url.pathname.match(
      /^\/bot[^/]+\/(getMe|getUpdates|sendMessage)$/,
    );

    if (!methodMatch) {
      sendJson(response, 404, {
        ok: false,
        error_code: 404,
        description: "Not Found",
      });
      return;
    }

    const telegramMethod = methodMatch[1];

    if (scenario === "timeout") {
      return;
    }
    if (scenario === "malformed") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{not-json");
      return;
    }
    if (scenario === "unauthorized") {
      sendJson(response, 401, {
        ok: false,
        error_code: 401,
        description: "Unauthorized",
      });
      return;
    }
    if (scenario === "server_error") {
      sendJson(response, 500, {
        ok: false,
        error_code: 500,
        description: "Internal Server Error",
      });
      return;
    }

    if (telegramMethod === "getMe") {
      sendJson(response, 200, {
        ok: true,
        result: {
          id: 999000111,
          is_bot: true,
          first_name: "ASIHJAYA Development Mock",
          username: "asihjaya_dev_mock_bot",
        },
      });
      return;
    }

    if (telegramMethod === "getUpdates") {
      sendJson(response, 200, {
        ok: true,
        result: [
          {
            update_id: 2001,
            message: {
              message_id: 1,
              date: 1_786_080_000,
              chat: {
                id: -1001234567890,
                type: "supergroup",
                title: "ASIHJAYA Development Mock",
              },
              text: "development chat discovery",
            },
          },
        ],
      });
      return;
    }

    if (scenario === "forbidden") {
      sendJson(response, 403, {
        ok: false,
        error_code: 403,
        description: "Forbidden: bot was removed from the group chat",
      });
      return;
    }
    if (scenario === "invalid_chat") {
      sendJson(response, 400, {
        ok: false,
        error_code: 400,
        description: "Bad Request: chat not found",
      });
      return;
    }
    if (scenario === "rate_limited") {
      sendJson(response, 429, {
        ok: false,
        error_code: 429,
        description: "Too Many Requests: retry later",
        parameters: { retry_after: 2 },
      });
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(request);
    } catch {
      sendJson(response, 400, {
        ok: false,
        error_code: 400,
        description: "Bad Request: malformed JSON",
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      result: {
        message_id: 1001,
        date: 1_786_080_000,
        chat: {
          id: numericChatId(body.chat_id),
          type: "supergroup",
          title: "ASIHJAYA Development Mock",
        },
        text: typeof body.text === "string" ? body.text : "",
      },
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Telegram mock server gagal mendapatkan listen address.");
  }

  const origin = `http://${host}:${address.port}`;
  if (!options.silent) {
    console.log(`Telegram mock API listening at ${origin} (scenario=${scenario}).`);
  }

  return { server, origin };
}

async function runCli() {
  const scenario = (process.env.TELEGRAM_MOCK_SCENARIO?.trim() ||
    "success") as TelegramMockScenario;
  const port = Number(process.env.TELEGRAM_MOCK_PORT ?? 8787);

  if (!Number.isSafeInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("TELEGRAM_MOCK_PORT harus berada antara 1 dan 65535.");
  }

  await startTelegramMockServer({ port, scenario });
}

const entryPoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;
if (entryPoint === import.meta.url) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
