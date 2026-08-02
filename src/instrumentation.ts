export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { assertServerEnvironment } = await import("./lib/env");

  assertServerEnvironment(process.env, {
    requireCore: process.env.NODE_ENV === "production",
  });
}
