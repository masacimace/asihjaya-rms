param(
  [string]$NodeExecutable = "node.exe"
)

$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $HubRoot

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

& $NodeExecutable scripts/start-agent-secure.js
$NodeExitCode = $LASTEXITCODE
if ($NodeExitCode -ne 0) {
  Write-Error "Hardware Hub Agent exited with code $NodeExitCode."
}
exit $NodeExitCode
