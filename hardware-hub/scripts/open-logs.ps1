$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $HubRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Latest = Get-ChildItem $LogDir -File -Filter "agent-*.jsonl" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($Latest) { Write-Host "Latest structured log: $($Latest.FullName)" }
Invoke-Item $LogDir
