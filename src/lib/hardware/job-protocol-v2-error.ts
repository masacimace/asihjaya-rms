export class HardwareJobProtocolV2Error extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor({
    code,
    message,
    status,
    retryable = false,
  }: {
    code: string;
    message: string;
    status: number;
    retryable?: boolean;
  }) {
    super(message);
    this.name = "HardwareJobProtocolV2Error";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function isHardwareJobProtocolV2Error(
  value: unknown,
): value is HardwareJobProtocolV2Error {
  return value instanceof HardwareJobProtocolV2Error;
}
