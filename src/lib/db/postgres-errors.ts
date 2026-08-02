export function isPostgresUniqueViolation(
  error: unknown,
  constraintName: string,
) {
  if (!(error instanceof Error)) {
    return false;
  }

  const maybeDbError = error as Error & {
    code?: string;
    constraint?: string;
    cause?: unknown;
  };

  if (
    maybeDbError.code === "23505" &&
    maybeDbError.constraint === constraintName
  ) {
    return true;
  }

  const cause = maybeDbError.cause as
    | {
        code?: string;
        constraint?: string;
      }
    | undefined;

  return cause?.code === "23505" && cause.constraint === constraintName;
}
