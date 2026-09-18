# ASIHJAYA Hardware Hub Windows Installer

Stage 5 packages the Hardware Hub runtime as one native Windows installer, while Stage 6 adds repair/upgrade preservation and a repeatable local physical-UAT flow:

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

Writable state that survives repair/upgrade:

```text
C:\ProgramData\ASIHJAYA\Hardware Hub\
├── data\
├── logs\
├── support-bundles\
└── uat-reports\
```

The Agent Secret is never written as plaintext configuration for a new installation. Enrollment runs in the original Windows user context and persists the credential through the DPAPI `CurrentUser` secure store.

## Fresh installation flow

1. In RMS, open **Hardware Hub** and choose **Siapkan Hardware Hub**.
2. Download **ASIHJAYA Hardware Hub Setup**.
3. Double-click Setup normally and approve UAC when Windows asks. Do **not** launch Setup using the `Run as administrator` context-menu action; enrollment and Scheduled Task creation must return to the outlet user's original Windows context.
4. Enter the temporary `AJ-...` Installation Code.
5. Setup enumerates Windows printers and preselects SATO CG408 and Epson L3250/L3251/EcoTank when available.
6. Finish the wizard. Setup writes non-secret configuration, performs secure enrollment, starts the Scheduled Task, and waits for local health readiness.
7. Use **Test Print Label** and **Test Print Nota** on the final page for physical validation.

## Repair / upgrade flow

Running a newer Setup.exe on the same Windows user automatically enters **Perbaiki / Upgrade** mode when the secure credential store already exists.

In this mode Setup:

- does not request a new Installation Code;
- stops the existing Scheduled Task before replacing application/runtime files;
- keeps `C:\ProgramData\ASIHJAYA\Hardware Hub` intact, including DPAPI credential, journal, logs, and installer instance identity;
- reuses the previously configured label/document printer when the same Windows printer names are still present;
- backs up the existing non-secret `.env` before applying installer-managed values;
- resumes the signed enrollment completion idempotently using the existing credential;
- re-registers and starts the Scheduled Task, then waits for readiness again.

If DPAPI decryption fails, run Setup from the same Windows user that performed the original enrollment. Device replacement should use the RMS **Ganti Mini PC** flow rather than bypassing the existing credential binding.

## Local physical UAT

A development laptop with the real SATO and Epson hardware is a valid first UAT environment; the outlet can be used later as a second-environment confirmation.

After Setup reports `ONLINE / READY`, open a normal PowerShell window as the same Windows user and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\ASIHJAYA\Hardware Hub\app\scripts\run-local-uat.ps1" -TestLabel -TestDocument -ExportSupportBundle
```

The command validates installed layout, private Node runtime, secure credential presence, config, Scheduled Task user context, fresh health state, exact Windows printer names, and optionally sends one physical SATO label plus one Epson document test.

It writes a secret-free report to:

```text
C:\ProgramData\ASIHJAYA\Hardware Hub\uat-reports\hardware-hub-uat-YYYYMMDD-HHMMSS.json
```

When `-ExportSupportBundle` is supplied, a sanitized diagnostic ZIP is also created under `support-bundles`. It intentionally excludes raw `.env`, credential contents, Agent Secret, lease tokens, journal content/key, and print artifacts.

For Stage 6 acceptance on the development laptop, validate this sequence:

1. Fresh install from a new Installation Code.
2. Final-page Test Print Label and Test Print Nota.
3. Run `run-local-uat.ps1 -TestLabel -TestDocument -ExportSupportBundle`.
4. Logout/login or reboot Windows and run the UAT command again without reinstalling.
5. Run the same/newer Setup.exe again and confirm it enters Repair/Upgrade without asking for another Installation Code.
6. Confirm printer choices are preserved, the agent returns `ONLINE / READY`, and both physical test prints still work.
7. Confirm RMS can submit a real label/receipt job and Hardware Hub claims/acknowledges it normally.

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
npm run check:stage6
powershell -NoProfile -ExecutionPolicy Bypass -File installer/build-installer.ps1 -ApiUrl https://ajsystem.id
```

The builder downloads pinned official runtime archives, verifies their SHA-256 values, then compiles the installer. The Setup output is intentionally not committed to Git.

## CI artifact

`.github/workflows/build-hardware-hub-installer.yml` builds Stage 5/6 installer branches on `windows-latest` and publishes a short-lived GitHub Actions artifact containing:

```text
ASIHJAYA-Hardware-Hub-Setup.exe
ASIHJAYA-Hardware-Hub-Setup.sha256.txt
```

For client distribution, publish the reviewed Setup.exe to a stable HTTPS release/object-storage URL. Configure the RMS server with:

```env
HARDWARE_HUB_INSTALLER_DOWNLOAD_URL=https://downloads.example.com/ASIHJAYA-Hardware-Hub-Setup.exe
```

`GET /api/hardware/installer/download` requires `hardware.agents.manage` and redirects to that configured HTTPS URL. This keeps the download location replaceable without exposing it as user input.

## Outlet validation after laptop UAT

CI plus laptop physical UAT can finish development without waiting for outlet access. Before client rollout, repeat a shorter second-environment validation on the target outlet Mini PC: install/repair, reboot/login Scheduled Task startup, RMS job claim/ack, SATO label print, and Epson receipt/document print.

Keep the reviewed Setup SHA-256 together with both UAT reports as release evidence.
