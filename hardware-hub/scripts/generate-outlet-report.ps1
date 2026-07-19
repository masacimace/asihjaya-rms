param(
  [string]$OutletCode = "OUTLET",
  [string]$Operator = $env:USERNAME
)

$ErrorActionPreference = "Continue"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$SafeOutlet = ($OutletCode -replace '[^A-Za-z0-9_-]', '_')
$ReportRoot = Join-Path $HubRoot "outlet-reports\$SafeOutlet-$Stamp"
New-Item -ItemType Directory -Force -Path $ReportRoot | Out-Null

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "outlet-preflight.ps1") -OutputDirectory $ReportRoot
$PreflightExit = $LASTEXITCODE

try {
  Push-Location $HubRoot
  & node scripts/collect-diagnostics.js --output-dir (Join-Path $ReportRoot "diagnostics") | Out-Null
  & node scripts/generate-outlet-fixtures.js --output (Join-Path $ReportRoot "calibration-fixtures") | Out-Null
} finally { Pop-Location }

try {
  $BundleDir = Join-Path $ReportRoot "support-bundle"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "export-support-bundle.ps1") -OutputDirectory $BundleDir
} catch {
  "Support bundle failed: $($_.Exception.Message)" | Set-Content (Join-Path $ReportRoot "support-bundle-error.txt") -Encoding UTF8
}

$Acceptance = @"
# ASIHJAYA Hardware Hub Outlet Acceptance Report

- Outlet: $OutletCode
- Operator: $Operator
- Generated: $((Get-Date).ToUniversalTime().ToString("o"))
- Mini PC: $env:COMPUTERNAME
- Windows user: $env:USERDOMAIN\$env:USERNAME
- Preflight exit code: $PreflightExit

## SATO CG408TT

- [ ] Driver and exact printer name recorded
- [ ] Media width/height measured
- [ ] Gap sensor calibrated
- [ ] Horizontal/vertical offset recorded
- [ ] Darkness/speed recorded
- [ ] 1 label passed
- [ ] 10 labels passed
- [ ] 100 labels passed
- [ ] Barcode scanned by every Android POS type
- [ ] Offline/USB/media/ribbon failure tested
- [ ] Internet interruption after dispatch did not duplicate print

Notes:

## Epson L3251 A4

- [ ] Driver and exact printer name recorded
- [ ] SumatraPDF version/path recorded
- [ ] A4 landscape orientation passed
- [ ] Printable margins recorded
- [ ] Color and text sharpness passed
- [ ] Long/multi-page receipt passed
- [ ] Offline/paper/USB-Wi-Fi/spooler failure tested
- [ ] Internet interruption after submission did not duplicate print

Notes:

## Windows Operations

- [ ] Scheduled Task uses the dedicated Windows user
- [ ] Agent returns online after Windows restart
- [ ] Local health and support bundle passed
- [ ] Unknown-outcome operator workflow tested
- [ ] Cash drawer remains fake until separately approved

## Evidence

Add photos/scans manually to this folder. Do not include customer secrets, agent secret, or raw `.env`.
"@
$Acceptance | Set-Content (Join-Path $ReportRoot "acceptance-report.md") -Encoding UTF8

[PSCustomObject]@{
  outlet = $OutletCode
  operator = $Operator
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  computerName = $env:COMPUTERNAME
  windowsUser = "$env:USERDOMAIN\$env:USERNAME"
  preflightExitCode = $PreflightExit
  status = if ($PreflightExit -eq 0) { "ready_for_physical_acceptance" } else { "blocked_or_warning_review_required" }
} | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $ReportRoot "acceptance-report.json") -Encoding UTF8

Write-Host "Outlet report created: $ReportRoot"
if ($PreflightExit -eq 2) { exit 2 }
exit 0
