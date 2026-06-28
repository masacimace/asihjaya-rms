$ErrorActionPreference = "Stop"

$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $HubRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Invoke-Item $LogDir
