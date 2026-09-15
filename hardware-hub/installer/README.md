# ASIHJAYA Hardware Hub Windows Installer

Stage 5 packages the existing Hardware Hub runtime as one native Windows installer:

```text
ASIHJAYA-Hardware-Hub-Setup.exe
```

## Installed layout

Read-only application payload:

```text
C:\Program Files\ASIHJAYA\Hardware Hub\
├── app\
├── runtime\node.exe
├── tools\SumatraPDF.exe
└── THIRD_PARTY_NOTICES.txt
```

Writable state:

```text
C:\ProgramData\ASIHJAYA\Hardware Hub\
├── data\
├── logs\
└── support-bundles\
```

The Agent Secret is never written as plaintext configuration for a new installation. Enrollment runs in the original Windows user context and persists the credential through the Stage 4 DPAPI `CurrentUser` secure store.

## Staff installation flow

1. In RMS, open **Hardware Hub** and choose **Siapkan Hardware Hub**.
2. Download **ASIHJAYA Hardware Hub Setup**.
3. Double-click Setup normally and approve UAC when Windows asks. Do **not** launch Setup using the `Run as administrator` context-menu action; enrollment and Scheduled Task creation must return to the outlet user's original Windows context.
4. Enter the temporary `AJ-...` Installation Code.
5. Setup enumerates Windows printers and preselects SATO CG408 and Epson L3250/L3251/EcoTank when available.
6. Finish the wizard. Setup writes non-secret configuration, performs secure enrollment, starts the Scheduled Task, and waits for local health readiness.
7. Use **Test Print Label** and **Test Print Nota** on the final page for physical validation.

## Build locally

Requirements:

- Windows x64
- PowerShell
- Inno Setup 7 with `ISCC.exe`
- npm for preparing the production `node_modules` payload

Build for the production RMS URL:

```powershell
cd hardware-hub
npm ci --omit=dev
npm run check:installer
powershell -NoProfile -ExecutionPolicy Bypass -File installer/build-installer.ps1 -ApiUrl https://ajsystem.id
```

The builder downloads pinned official runtime archives, verifies their SHA-256 values, then compiles the installer. The Setup output is intentionally not committed to Git.

## CI artifact

`.github/workflows/build-hardware-hub-installer.yml` builds the installer on `windows-latest` and publishes a short-lived GitHub Actions artifact containing:

```text
ASIHJAYA-Hardware-Hub-Setup.exe
ASIHJAYA-Hardware-Hub-Setup.sha256.txt
```

For client distribution, publish the reviewed Setup.exe to a stable HTTPS release/object-storage URL. Configure the RMS server with:

```env
HARDWARE_HUB_INSTALLER_DOWNLOAD_URL=https://downloads.example.com/ASIHJAYA-Hardware-Hub-Setup.exe
```

`GET /api/hardware/installer/download` requires `hardware.agents.manage` and redirects to that configured HTTPS URL. This keeps the download location replaceable without exposing it as user input.

## Physical UAT still required

CI proves that the native installer compiles, the runtime payload is complete, and the packaging contracts pass. It cannot prove Windows driver or physical-device behavior. Before client rollout, perform one physical install on the target Mini PC with:

- SATO CG408 label printer
- Epson EcoTank L3251 receipt/document printer
- real RMS/VPS connectivity
- logout/login or reboot to verify Scheduled Task startup
- label and receipt test prints

Keep the resulting Setup SHA-256 with the UAT evidence.
