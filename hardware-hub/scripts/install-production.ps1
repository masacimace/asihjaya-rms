param(
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [switch]$RunNow,
  [switch]$SkipNpmInstall
)
$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $HubRoot

if (-not (Test-Path (Join-Path $HubRoot ".env"))) {
  throw "File .env belum tersedia. Copy .env.example menjadi .env dan isi credential agent terlebih dahulu."
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
npm run check

$Arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $PSScriptRoot "install-startup-task.ps1"), "-TaskName", $TaskName)
if ($RunNow) { $Arguments += "-RunNow" }
& powershell.exe @Arguments

Write-Host "Production setup complete."
Write-Host "Status : npm run status"
Write-Host "Health : npm run health"
Write-Host "Bundle : npm run support:bundle"
