import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const DEFAULT_PORT = 3000;
const BIND_HOST = "0.0.0.0";
const VIRTUAL_INTERFACE_PATTERN =
  /(docker|wsl|vethernet|hyper-v|virtualbox|vmware|tailscale|zerotier|loopback)/i;

function isIpv4(detail) {
  return detail.family === "IPv4" || detail.family === 4;
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function interfacePriority(name) {
  const normalized = name.toLowerCase();

  if (VIRTUAL_INTERFACE_PATTERN.test(normalized)) return 100;
  if (/(wi-fi|wifi|wlan|wireless)/i.test(normalized)) return 0;
  if (/(ethernet|lan)/i.test(normalized)) return 10;
  return 20;
}

function getLanCandidates() {
  return Object.entries(networkInterfaces())
    .flatMap(([name, details]) =>
      (details ?? [])
        .filter(
          (detail) =>
            isIpv4(detail) && !detail.internal && isPrivateIpv4(detail.address),
        )
        .map((detail) => ({
          name,
          address: detail.address,
          priority: interfacePriority(name),
        })),
    )
    .sort(
      (left, right) =>
        left.priority - right.priority || left.name.localeCompare(right.name),
    );
}

function readOption(args, name) {
  const index = args.indexOf(name);

  if (index === -1) return undefined;

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} membutuhkan nilai.`);
  }

  return value;
}

function parsePort(value) {
  const port = Number(value ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Port tidak valid: ${value}`);
  }

  return port;
}

function selectLanHost(args) {
  const candidates = getLanCandidates();
  const requestedHost =
    readOption(args, "--host") ?? process.env.ASIHJAYA_LAN_TRAINING_HOST?.trim();

  if (requestedHost) {
    if (!isPrivateIpv4(requestedHost)) {
      throw new Error(
        `Host LAN harus berupa IPv4 private (10.x, 172.16-31.x, atau 192.168.x): ${requestedHost}`,
      );
    }

    const matched = candidates.find(
      (candidate) => candidate.address === requestedHost,
    );

    if (!matched) {
      throw new Error(
        `IP ${requestedHost} tidak ditemukan pada network interface aktif komputer ini. Jalankan ipconfig lalu pilih IPv4 Wi-Fi/Ethernet yang benar.`,
      );
    }

    return { selected: matched, candidates };
  }

  const selected = candidates.find((candidate) => candidate.priority < 100);

  if (!selected) {
    throw new Error(
      "Tidak menemukan IPv4 LAN private yang aktif. Pastikan komputer terhubung ke Wi-Fi/Ethernet, lalu coba lagi dengan --host <IP_LAN>.",
    );
  }

  return { selected, candidates };
}

function printHeader({ host, port, interfaceName, candidates, checkOnly }) {
  const trainingOrigin = `http://${host}:${port}`;

  console.log("");
  console.log("ASIHJAYA RMS - LAN Training Mode");
  console.log("================================");
  console.log(`Interface : ${interfaceName}`);
  console.log(`LAN IP    : ${host}`);
  console.log(`Port      : ${port}`);
  console.log(`Training  : ${trainingOrigin}`);
  console.log(`Host PC   : ${trainingOrigin}`);
  console.log("");
  console.log("Runtime override (hanya untuk proses ini):");
  console.log(`  APP_URL=${trainingOrigin}`);
  console.log(`  NEXT_PUBLIC_APP_URL=${trainingOrigin}`);
  console.log(`  INTERNAL_RENDER_ORIGIN=http://127.0.0.1:${port}`);
  console.log("");

  if (candidates.length > 1) {
    console.log("IPv4 LAN terdeteksi:");
    for (const candidate of candidates) {
      console.log(
        `  ${candidate.address === host ? "*" : "-"} ${candidate.address} (${candidate.name})`,
      );
    }
    console.log("");
    console.log(
      "Jika IP otomatis salah, gunakan: npm run dev:lan -- --host <IP_LAN>",
    );
    console.log("");
  }

  if (process.platform === "win32") {
    console.log(
      "Windows: jika muncul dialog Firewall, izinkan Node.js pada Private networks.",
    );
    console.log("");
  }

  console.log(
    "Device staff harus berada di Wi-Fi/LAN yang sama. Stop server dengan Ctrl+C setelah training.",
  );
  console.log(
    "Catatan: camera scanner browser pada device LAN dapat membutuhkan HTTPS karena aturan secure context browser.",
  );

  if (checkOnly) {
    console.log("");
    console.log("CHECK PASS - server tidak dijalankan (--check)." );
  }

  console.log("");
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const port = parsePort(
    readOption(args, "--port") ?? process.env.ASIHJAYA_LAN_TRAINING_PORT,
  );
  const { selected, candidates } = selectLanHost(args);
  const trainingOrigin = `http://${selected.address}:${port}`;

  printHeader({
    host: selected.address,
    port,
    interfaceName: selected.name,
    candidates,
    checkOnly,
  });

  if (checkOnly) return;

  const nextBin = path.join(
    process.cwd(),
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );

  if (!existsSync(nextBin)) {
    throw new Error(
      "Next.js binary tidak ditemukan. Jalankan npm install terlebih dahulu.",
    );
  }

  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", BIND_HOST, "--port", String(port)],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        ASIHJAYA_LAN_TRAINING_HOST: selected.address,
        ASIHJAYA_LAN_TRAINING_PORT: String(port),
        APP_URL: trainingOrigin,
        NEXT_PUBLIC_APP_URL: trainingOrigin,
        INTERNAL_RENDER_ORIGIN: `http://127.0.0.1:${port}`,
        HOSTNAME: BIND_HOST,
        PORT: String(port),
      },
    },
  );

  child.on("error", (error) => {
    console.error(`Gagal menjalankan Next.js dev server: ${error.message}`);
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exitCode = code ?? 0;
  });
}

try {
  main();
} catch (error) {
  console.error("");
  console.error(
    error instanceof Error ? `LAN Training Mode gagal: ${error.message}` : error,
  );
  console.error("");
  process.exitCode = 1;
}
