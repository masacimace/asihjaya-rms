/* eslint-disable */
const fs = require("fs");
const os = require("os");
const path = require("path");

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function readLock(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; }
}

function acquireProcessLock({ filePath, metadata = {} }) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = fs.openSync(resolved, "wx");
      const value = {
        pid: process.pid,
        hostname: os.hostname(),
        startedAt: new Date().toISOString(),
        ...metadata,
      };
      fs.writeFileSync(handle, JSON.stringify(value, null, 2), "utf8");
      fs.closeSync(handle);
      let released = false;
      return {
        filePath: resolved,
        value,
        release() {
          if (released) return;
          released = true;
          const current = readLock(resolved);
          if (!current || current.pid === process.pid) {
            try { fs.unlinkSync(resolved); } catch {}
          }
        },
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const current = readLock(resolved);
      const sameHost = !current?.hostname || current.hostname === os.hostname();
      if (sameHost && isProcessAlive(Number(current?.pid))) {
        const lockError = new Error(
          `Hardware Hub Agent sudah berjalan (PID ${current.pid}, startedAt ${current.startedAt || "unknown"}).`,
        );
        lockError.code = "AGENT_ALREADY_RUNNING";
        lockError.exitCode = 73;
        throw lockError;
      }
      try { fs.unlinkSync(resolved); } catch {}
    }
  }
  throw new Error("Gagal memperoleh process lock Hardware Hub.");
}

module.exports = { acquireProcessLock, isProcessAlive, readLock };
