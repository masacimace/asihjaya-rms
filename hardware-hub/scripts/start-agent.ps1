param(
  [string]$NodeExecutable = "node.exe"
)

$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $HubRoot

$LogDir = Join-Path $HubRoot "logs"
$DataDir = Join-Path $HubRoot "data"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

if (-not (Test-Path $NodeExecutable)) {
  $ResolvedNode = Get-Command $NodeExecutable -ErrorAction SilentlyContinue
  if (-not $ResolvedNode) {
    throw "Node.js tidak ditemukan: $NodeExecutable"
  }
  $NodeExecutable = $ResolvedNode.Source
}

Write-Host "Starting Asihjaya Hardware Hub Agent..."
Write-Host "Hub root       : $HubRoot"
Write-Host "Node executable: $NodeExecutable"
Write-Host "Structured logs: $LogDir"

& $NodeExecutable agent.js
$NodeExitCode = $LASTEXITCODE
if ($NodeExitCode -ne 0) {
  Write-Error "Hardware Hub Agent exited with code $NodeExitCode."
}
exit $NodeExitCode
