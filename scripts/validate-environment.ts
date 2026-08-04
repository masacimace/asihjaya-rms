import { config } from "dotenv";

import {
  assertServerEnvironment,
  type EnvironmentMode,
} from "../src/lib/env";

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} membutuhkan value.`);
  }
  return value;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function parseMode(rawValue: string | undefined): EnvironmentMode | undefined {
  if (!rawValue) return undefined;
  if (
    rawValue === "development" ||
    rawValue === "test" ||
    rawValue === "production"
  ) {
    return rawValue;
  }
  throw new Error("--mode harus development, test, atau production.");
}

const args = process.argv.slice(2);
const environmentFile = optionValue(args, "--env-file");
const mode = parseMode(optionValue(args, "--mode"));
const requireDeployment = hasFlag(args, "--deployment");

if (requireDeployment && mode !== "production") {
  throw new Error("--deployment wajib digunakan bersama --mode production.");
}

const dotenvResult = config(
  environmentFile
    ? {
        path: environmentFile,
        override: true,
        quiet: true,
      }
    : { quiet: true },
);

if (environmentFile && dotenvResult.error) {
  throw new Error(`Gagal membaca environment file ${environmentFile}.`);
}

assertServerEnvironment(process.env, {
  mode,
  requireCore: mode === "production" || process.env.NODE_ENV === "production",
  requireDeployment,
});

console.log(
  `Environment valid untuk mode ${mode ?? process.env.NODE_ENV ?? "development"}${
    requireDeployment ? " dengan deployment profile" : ""
  }${environmentFile ? ` dari ${environmentFile}` : ""}.`,
);
