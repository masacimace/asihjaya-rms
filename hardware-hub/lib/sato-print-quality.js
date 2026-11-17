const DEFAULT_SATO_PRINT_DARKNESS = 4;
const DEFAULT_SATO_PRINT_SPEED_IPS = 2;

function resolveSatoPrintQuality({ darkness, speedIps } = {}) {
  const level = darkness === undefined || darkness === "" ? DEFAULT_SATO_PRINT_DARKNESS : Number(darkness);
  const speed = speedIps === undefined || speedIps === "" ? DEFAULT_SATO_PRINT_SPEED_IPS : Number(speedIps);
  if (!Number.isSafeInteger(level) || level < 0 || level > 5 || ![0, 2, 3, 4].includes(speed)) {
    const error = new Error("SATO_PRINT_DARKNESS harus 0–5 dan SATO_PRINT_SPEED_IPS harus 0, 2, 3 atau 4. Nilai 0 mempertahankan pengaturan printer.");
    error.code = "SATO_PRINT_QUALITY_INVALID";
    error.category = "configuration";
    error.retrySafe = false;
    throw error;
  }
  return { darkness: level, speedIps: speed, physicalValidation: "pending_outlet_test" };
}

function buildSatoPrintQualityCommands(quality) {
  const { darkness, speedIps } = resolveSatoPrintQuality(quality);
  // These are printer configuration commands, each in its own A...Z frame.
  // Neither frame contains Q, feeds media or changes label geometry.
  return Buffer.from([
    speedIps ? `\x1bA\x1bCS${speedIps}\x1bZ` : "",
    darkness ? `\x1bA\x1b#E${darkness}\x1bZ` : "",
  ].join(""), "ascii");
}

module.exports = { DEFAULT_SATO_PRINT_DARKNESS, DEFAULT_SATO_PRINT_SPEED_IPS, resolveSatoPrintQuality, buildSatoPrintQualityCommands };
