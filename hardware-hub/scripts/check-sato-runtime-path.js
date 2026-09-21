/* eslint-disable */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const hardwareHubRoot = path.resolve(__dirname, "..");
const rendererPath = path.join(__dirname, "render-sato-jewelry-label.ps1");
const adapterPath = path.join(hardwareHubRoot, "lib", "hardware-adapters.js");
const installerConfigurePath = path.join(__dirname, "installer-configure.js");
const installerPath = path.join(
  hardwareHubRoot,
  "installer",
  "AsihjayaHardwareHub.iss",
);

const renderer = fs.readFileSync(rendererPath, "utf8");
const adapter = fs.readFileSync(adapterPath, "utf8");
const installerConfigure = fs.readFileSync(installerConfigurePath, "utf8");
const installer = fs.readFileSync(installerPath, "utf8");

assert.match(
  renderer,
  /\[Environment\]::GetEnvironmentVariable\("HARDWARE_TEMP_DIR"\)/,
  "Renderer SATO wajib memakai HARDWARE_TEMP_DIR untuk default output runtime.",
);
assert.match(
  renderer,
  /\$outputDir = Split-Path -Parent \$OutputFile/,
  "Renderer SATO wajib membuat directory dari parent OutputFile aktual.",
);
assert.doesNotMatch(
  renderer,
  /\$outputDir = Join-Path \$HardwareHubRoot "data\\\\temp"\s*\r?\n\s*New-Item -ItemType Directory/,
  "Renderer SATO tidak boleh unconditional menulis app\\data\\temp di Program Files.",
);
assert.match(
  adapter,
  /const renderFile = createTempPath\(config, "sato-render", "sbpl"\)/,
  "Adapter label wajib menghasilkan render file dari config.tempDir.",
);
assert.match(
  adapter,
  /"-OutputFile",\s*renderFile/,
  "Adapter label wajib meneruskan renderFile sebagai OutputFile renderer.",
);
assert.match(
  installerConfigure,
  /HARDWARE_TEMP_DIR: path\.join\(stateDir, "temp"\)/,
  "Installer configure wajib mengarahkan HARDWARE_TEMP_DIR ke stateDir writable.",
);
assert.ok(
  installer.includes(
    'Name: "{commonappdata}\\ASIHJAYA\\Hardware Hub\\data"; Permissions: users-modify',
  ),
  "Installer wajib memberikan users-modify pada ProgramData Hardware Hub data.",
);

console.log("OK: SATO runtime path stays on writable Hardware Hub state directory.");
