export type TelegramApiMethod = "getMe" | "sendMessage";

export type TelegramBotIdentity = {
  id: number;
  isBot: boolean;
  firstName: string;
  username: string | null;
};

export type TelegramSendMessageInput = {
  chatId: string;
  text: string;
};

export type TelegramSentMessage = {
  messageId: number;
  chatId: string;
};

export type TelegramApiEnvelope<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
};

export type TelegramClientLogEntry = {
  event: "telegram_request";
  method: TelegramApiMethod;
  outcome: "success" | "failure";
  httpStatus: number | null;
  telegramErrorCode: number | null;
  retryable: boolean;
  retryAfterSeconds: number | null;
  durationMs: number;
  errorKind: string | null;
};

export type TelegramClientLogger = (entry: TelegramClientLogEntry) => void;
