param(
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [string]$InstallationCode = "",
  [string]$ApiUrl = "",
  [string]$InstallerVersion = "stage4-production-setup",
  [switch]$RunNow,
  [switch]$SkipNpmInstall
)
$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $HubRoot

if (-not (Test-Path (Join-Path $HubRoot ".env"))) {
  throw "File .env non-secret belum tersedia. Copy .env.example menjadi .env lalu isi konfigurasi API/printer; Agent Secret tidak perlu diisi."
}
if (-not $SkipNpmInstall) { npm install --omit=dev }

$VersionText = node -p "process.versions.node"
$Parts = $VersionText.Split('.') | ForEach-Object { [int]$_ }
if ($Parts[0] -lt 22 -or ($Parts[0] -eq 22 -and $Parts[1] -lt 5) -or $Parts[0] -ge 25) {
  throw "Node.js $VersionText tidak didukung. Gunakan Node.js >=22.5 dan <25."
}

New-Item -ItemType Directory -Force -Path (Join-Path $HubRoot "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $HubRoot "logs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $HubRoot "support-bundles") | Out-Null

npm run check:dpapi

$CredentialPath = Join-Path $HubRoot "data\agent-credential.json"
if ($InstallationCode) {
  $EnrollArgs = @(
    "scripts/enroll-installer.js",
    "--installation-code", $InstallationCode,
    "--installer-version", $InstallerVersion
  )
  if ($ApiUrl) {
    $EnrollArgs += @("--api-url", $ApiUrl)
  }

  Write-Host "Claiming Installation Code and storing Hardware Hub credential securely..."
  & node @EnrollArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Hardware Hub secure enrollment gagal dengan exit code $LASTEXITCODE."
  }
}
elseif (-not (Test-Path $CredentialPath)) {
  $LegacyEnv = Get-Content (Join-Path $HubRoot ".env") -Raw
  $HasLegacyAgentId = $LegacyEnv -match '(?m)^HARDWARE_AGENT_ID=\S+'
  $HasLegacySecret = $LegacyEnv -match '(?m)^HARDWARE_AGENT_SECRET=.{32,}$'
  if (-not ($HasLegacyAgentId -and $HasLegacySecret)) {
    throw "Secure credential belum tersedia. Jalankan setup dengan -InstallationCode dari RMS."
  }
  Write-Warning "Menggunakan legacy plaintext agent credential dari .env. Migrasikan lewat Installation Code saat maintenance berikutnya."
}

npm run check

$Arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "install-startup-task.ps1"), "-TaskName", $TaskName)
if ($RunNow) { $Arguments += "-RunNow" }
& powershell.exe @Arguments

Write-Host "Production setup complete."
Write-Host "Credential : DPAPI secure store (preferred) / legacy env fallback"
Write-Host "Status     : npm run status"
Write-Host "Health     : npm run health"
Write-Host "Bundle     : npm run support:bundle"
