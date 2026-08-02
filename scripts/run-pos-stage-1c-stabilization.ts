import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const argumentsSet = new Set(process.argv.slice(2));
const supportedArguments = new Set(["--list", "--with-financial"]);

for (const argument of argumentsSet) {
  if (!supportedArguments.has(argument)) {
    throw new Error(
      `Argument ${argument} tidak didukung. Gunakan --list atau --with-financial.`,
    );
  }
}

const withFinancial = argumentsSet.has("--with-financial");
const listOnly = argumentsSet.has("--list");

const steps = [
  {
    label: "Quality, static, security, dan business contracts",
    script: "check:stabilization",
  },
  ...(withFinancial
    ? [
        {
          label: "Financial dan concurrency integration suite disposable",
          script: "test:financial:local",
        },
      ]
    : []),
  {
    label: "Application-side Hardware Hub contracts",
    script: "check:hardware-app",
  },
  {
    label: "Clean production build",
    script: "build:clean",
  },
] as const;

function resolveNpmCommand(args: string[]) {
  const npmExecPath = process.env.npm_execpath?.trim();

  if (npmExecPath) {
    return {
      executable: process.execPath,
      args: [npmExecPath, ...args],
    };
  }

  return {
    executable: process.platform === "win32" ? "npm.cmd" : "npm",
    args,
  };
}

function runNpmScript(script: string) {
  const command = resolveNpmCommand(["run", script]);
  const result = spawnSync(command.executable, command.args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    throw new Error(
      `npm run ${script} gagal dengan exit code ${result.status ?? "unknown"}.`,
    );
  }
}

console.log("POS Stage 1C stabilization plan:");
for (const [index, step] of steps.entries()) {
  console.log(`${index + 1}. ${step.label} (npm run ${step.script})`);
}

if (listOnly) {
  console.log("Mode --list: tidak ada command yang dijalankan.");
  process.exit(0);
}

for (const [index, step] of steps.entries()) {
  console.log(`\n[${index + 1}/${steps.length}] ${step.label}...`);
  runNpmScript(step.script);
}

console.log("\nOK: seluruh POS Stage 1C stabilization gate berhasil.");
