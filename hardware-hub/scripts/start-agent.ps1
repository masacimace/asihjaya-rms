$ErrorActionPreference = "Stop"

$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $HubRoot

$LogDir = Join-Path $HubRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "agent-$Stamp.log"

Write-Host "Starting Asihjaya Hardware Hub Agent..."
Write-Host "Hub root : $HubRoot"
Write-Host "Log file : $LogFile"

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCommand) {
  throw "Node.js tidak ditemukan di PATH. Install Node.js LTS dulu, lalu buka terminal baru."
}

& node agent.js 2>&1 | Tee-Object -FilePath $LogFile -Append
$NodeExitCode = $LASTEXITCODE

if ($NodeExitCode -ne 0) {
  Write-Error "Hardware Hub Agent exited with code $NodeExitCode."
}

exit $NodeExitCode
