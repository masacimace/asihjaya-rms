import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const perAgentVariables = [
  "HARDWARE_AGENT_ORGANIZATION_SLUG",
  "HARDWARE_AGENT_OUTLET_CODE",
  "HARDWARE_AGENT_REGISTER_CODE",
  "HARDWARE_AGENT_CODE",
  "HARDWARE_AGENT_NAME",
  "HARDWARE_AGENT_SECRET",
] as const;

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath: string) {
  const file = path.join(root, relativePath);
  assert(existsSync(file), `${relativePath} tidak ditemukan.`);
  return readFileSync(file, "utf8");
}

function activeVariableNames(content: string): Set<string> {
  const names = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    names.add(line.slice(0, separator).trim());
  }

  return names;
}

function assertNoPerAgentRuntimeVariables(
  label: string,
  content: string,
) {
  const names = activeVariableNames(content);

  for (const variable of perAgentVariables) {
    assert(
      !names.has(variable),
      `${label} tidak boleh lagi mengaktifkan ${variable}; provisioning normal dilakukan dari web.`,
    );
  }
}

const envExample = read(".env.example");
const productionExample = read(".env.production.example");
const envSource = read("src/lib/env.ts");
const generator = read("scripts/generate-environment-secrets.mjs");
const cliProvisioner = read("scripts/create-hardware-agent.ts");
const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};

assertNoPerAgentRuntimeVariables(".env.example", envExample);
assertNoPerAgentRuntimeVariables(
  ".env.production.example",
  productionExample,
);

for (const variable of perAgentVariables) {
  assert(
    envExample.includes(`# ${variable}=`),
    `.env.example wajib mendokumentasikan ${variable} hanya sebagai CLI fallback comment.`,
  );
  assert(
    productionExample.includes(`# ${variable}=`),
    `.env.production.example wajib mendokumentasikan ${variable} hanya sebagai CLI fallback comment.`,
  );
}

assert(
  envExample.includes("npm run hardware:agent:create") &&
    productionExample.includes("npm run hardware:agent:create"),
  "Template environment wajib menjelaskan bahwa variable per-agent hanya untuk CLI fallback.",
);

const generatedSecretSection =
  envSource.match(
    /export const GENERATED_PRODUCTION_SECRET_NAMES = \[([\s\S]*?)\] as const;/,
  )?.[1] ?? "";

assert(
  !generatedSecretSection.includes('"HARDWARE_AGENT_SECRET"'),
  "HARDWARE_AGENT_SECRET tidak boleh lagi menjadi generated production runtime secret.",
);

const productionTemplateSection =
  envSource.match(
    /export const PRODUCTION_ENVIRONMENT_TEMPLATE_NAMES = \[([\s\S]*?)\] as const;/,
  )?.[1] ?? "";

for (const variable of perAgentVariables) {
  assert(
    !productionTemplateSection.includes(`"${variable}"`),
    `${variable} tidak boleh lagi diwajibkan oleh production environment template contract.`,
  );
}

assert(
  envSource.includes('"HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY"'),
  "HARDWARE_AGENT_CREDENTIAL_ENCRYPTION_KEY wajib tetap menjadi core server secret.",
);

assert(
  !generator.includes('["HARDWARE_AGENT_SECRET",'),
  "Environment generator tidak boleh lagi membuat plaintext per-agent HARDWARE_AGENT_SECRET.",
);

assert(
  cliProvisioner.includes('required("HARDWARE_AGENT_CODE")') &&
    cliProvisioner.includes('required("HARDWARE_AGENT_SECRET")'),
  "CLI break-glass hardware:agent:create wajib tetap mempertahankan explicit agent code + secret.",
);

for (const privateEnv of [".env", ".env.production"]) {
  const file = path.join(root, privateEnv);

  if (existsSync(file)) {
    assertNoPerAgentRuntimeVariables(
      privateEnv,
      readFileSync(file, "utf8"),
    );
  }
}

const scripts = packageJson.scripts ?? {};

for (const scriptName of [
  "check:hardware-agent-provisioning",
  "check:hardware-agent-provisioning-ui",
  "check:hardware-agent-lifecycle",
  "check:hardware-agent-environment-contract",
]) {
  assert(
    typeof scripts[scriptName] === "string" &&
      scripts[scriptName].length > 0,
    `package.json wajib menyediakan ${scriptName}.`,
  );
  assert(
    scripts["check:hardware-app"]?.includes(
      `npm run ${scriptName}`,
    ),
    `check:hardware-app wajib menyertakan ${scriptName}.`,
  );
}

console.log(
  "OK: Hardware Agent runtime env bersih; per-agent provisioning hanya web/CLI fallback, encryption key tetap server-side.",
);
