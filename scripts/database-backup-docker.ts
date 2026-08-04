import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";

export type DatabaseComposeTarget = {
  composeFile: string;
  service: string;
  environmentFile?: string;
  projectName?: string;
};

export function buildComposeArgs(target: DatabaseComposeTarget): string[] {
  const args = ["compose"];
  if (target.environmentFile) args.push("--env-file", target.environmentFile);
  if (target.projectName) args.push("--project-name", target.projectName);
  args.push("-f", target.composeFile);
  return args;
}

export function containerExecArgs(
  target: DatabaseComposeTarget,
  command: readonly string[],
): string[] {
  return [...buildComposeArgs(target), "exec", "-T", target.service, ...command];
}

function sanitizeProcessOutput(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[REDACTED]@")
    .slice(-12_000);
}

export async function runDockerCapture(
  args: readonly string[],
  options: { inputFile?: string; environment?: NodeJS.ProcessEnv } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [...args], {
      cwd: process.cwd(),
      env: options.environment ?? process.env,
      stdio: [options.inputFile ? "pipe" : "ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(error);
    };

    child.stdout?.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
    child.once("error", fail);
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new Error(
          `Docker command gagal dengan exit code ${code ?? "null"}${signal ? ` (${signal})` : ""}. ${sanitizeProcessOutput(stderr || stdout)}`,
        ),
      );
    });

    if (options.inputFile) {
      if (!child.stdin) {
        fail(new Error("Docker command tidak menyediakan stdin untuk archive database."));
        return;
      }
      const input = createReadStream(options.inputFile);
      input.once("error", fail);
      input.pipe(child.stdin);
    }
  });
}

export async function runDockerBinaryToFile(
  args: readonly string[],
  outputFile: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("docker", [...args], {
      cwd: process.cwd(),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    const output = createWriteStream(outputFile, { flags: "wx", mode: 0o600 });
    let stderr = "";
    let childClosed = false;
    let outputFinished = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      output.destroy();
      reject(error);
    };
    const finish = () => {
      if (settled || !childClosed || !outputFinished) return;
      settled = true;
      if (exitCode === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Docker backup command gagal dengan exit code ${exitCode ?? "null"}${exitSignal ? ` (${exitSignal})` : ""}. ${sanitizeProcessOutput(stderr)}`,
          ),
        );
      }
    };

    const childStdout = child.stdout;
    const childStderr = child.stderr;
    if (!childStdout || !childStderr) {
      fail(new Error("Docker backup command tidak menyediakan stdout/stderr pipe."));
      return;
    }

    childStderr.on("data", (chunk) => (stderr += String(chunk)));
    child.once("error", fail);
    output.once("error", fail);
    output.once("finish", () => {
      outputFinished = true;
      finish();
    });
    child.once("close", (code, signal) => {
      childClosed = true;
      exitCode = code;
      exitSignal = signal;
      finish();
    });
    childStdout.pipe(output);
  });
}

export async function assertComposeServiceRunning(target: DatabaseComposeTarget): Promise<void> {
  const containerId = (
    await runDockerCapture([...buildComposeArgs(target), "ps", "-q", target.service])
  ).trim();
  if (!containerId) {
    throw new Error(`Service Compose ${target.service} belum berjalan.`);
  }
  const running = (
    await runDockerCapture(["inspect", "--format", "{{.State.Running}}", containerId])
  ).trim();
  if (running !== "true") {
    throw new Error(`Service Compose ${target.service} tidak dalam kondisi running.`);
  }
}

export async function runDatabaseShell(
  target: DatabaseComposeTarget,
  script: string,
  positionalArgs: readonly string[] = [],
): Promise<string> {
  return runDockerCapture(
    containerExecArgs(target, ["sh", "-eu", "-c", script, "asihjaya-db", ...positionalArgs]),
  );
}
