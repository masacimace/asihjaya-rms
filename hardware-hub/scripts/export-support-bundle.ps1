param(
  [string]$AppRoot = "",
  [string]$StateDirectory = "",
  [string]$LogDirectory = "",
  [string]$OutputDirectory = "",
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [int]$RecentLogFiles = 10
)

$ErrorActionPreference = "Stop"

if (-not $AppRoot) {
  $InstalledRoot = Join-Path $env:ProgramFiles "ASIHJAYA\Hardware Hub\app"
  if (Test-Path $InstalledRoot) {
    $AppRoot = $InstalledRoot
  } else {
    $AppRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  }
}
$AppRoot = [System.IO.Path]::GetFullPath($AppRoot)
$EnvPath = Join-Path $AppRoot ".env"
$InstallRoot = Split-Path $AppRoot -Parent
$BundledNode = Join-Path $InstallRoot "runtime\node.exe"

function Get-EnvValue([string]$Key) {
  if (-not (Test-Path $EnvPath)) { return "" }
  $Prefix = "$Key="
  foreach ($Line in Get-Content -LiteralPath $EnvPath) {
    if ($Line.StartsWith($Prefix, [System.StringComparison]::Ordinal)) {
      return $Line.Substring($Prefix.Length).Trim()
    }
  }
  return ""
}

if (-not $StateDirectory) {
  $ConfiguredState = Get-EnvValue "HARDWARE_INSTALLER_STATE_DIR"
  if ($ConfiguredState) {
    $StateDirectory = $ConfiguredState
  } elseif (Test-Path (Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\data")) {
    $StateDirectory = Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\data"
  } else {
    $StateDirectory = Join-Path $AppRoot "data"
  }
}

if (-not $LogDirectory) {
  $ConfiguredLogs = Get-EnvValue "HARDWARE_LOG_DIR"
  if ($ConfiguredLogs) {
    $LogDirectory = $ConfiguredLogs
  } elseif (Test-Path (Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\logs")) {
    $LogDirectory = Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\logs"
  } else {
    $LogDirectory = Join-Path $AppRoot "logs"
  }
}

if (-not $OutputDirectory) {
  if (Test-Path (Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub")) {
    $OutputDirectory = Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\support-bundles"
  } else {
    $OutputDirectory = Join-Path $AppRoot "support-bundles"
  }
}

$StateDirectory = [System.IO.Path]::GetFullPath($StateDirectory)
$LogDirectory = [System.IO.Path]::GetFullPath($LogDirectory)
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

if (Test-Path $BundledNode) {
  $NodeExecutable = $BundledNode
} else {
  $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $NodeCommand) {
    throw "Node.js tidak ditemukan. Install ulang Hardware Hub atau jalankan dari development environment yang memiliki Node.js."
  }
  $NodeExecutable = $NodeCommand.Source
}

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "asihjaya-hardware-support-$Stamp-$PID"
$BundleRoot = Join-Path $TempRoot "asihjaya-hardware-hub-support-$Stamp"
$LogTarget = Join-Path $BundleRoot "logs"
New-Item -ItemType Directory -Force -Path $LogTarget | Out-Null

try {
  Push-Location $AppRoot
  try {
    & $NodeExecutable scripts/collect-diagnostics.js --output-dir $BundleRoot | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "collect-diagnostics.js gagal dengan exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  if (Test-Path $LogDirectory) {
    Get-ChildItem $LogDirectory -File -Filter "agent-*.jsonl" |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First ([Math]::Max(1, $RecentLogFiles)) |
      Copy-Item -Destination $LogTarget
  }

  try {
    $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    $TaskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    [PSCustomObject]@{
      TaskName = $Task.TaskName
      State = $Task.State.ToString()
      LastRunTime = $TaskInfo.LastRunTime
      LastTaskResult = $TaskInfo.LastTaskResult
      NextRunTime = $TaskInfo.NextRunTime
      NumberOfMissedRuns = $TaskInfo.NumberOfMissedRuns
      PrincipalUserId = $Task.Principal.UserId
      LogonType = $Task.Principal.LogonType.ToString()
      Action = $Task.Actions | ForEach-Object { "$($_.Execute) $($_.Arguments)" }
    } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $BundleRoot "scheduled-task.json") -Encoding UTF8
  } catch {
    "Scheduled task unavailable: $($_.Exception.Message)" | Set-Content (Join-Path $BundleRoot "scheduled-task.txt") -Encoding UTF8
  }

  try {
    Get-Printer | Select-Object Name, DriverName, PortName, Shared, ShareName, PrinterStatus |
      ConvertTo-Json -Depth 4 | Set-Content (Join-Path $BundleRoot "printers.json") -Encoding UTF8
  } catch {
    "Printer inventory unavailable: $($_.Exception.Message)" | Set-Content (Join-Path $BundleRoot "printers.txt") -Encoding UTF8
  }

  try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check-windows-dpapi.ps1") *>&1 |
      Out-String | Set-Content (Join-Path $BundleRoot "dpapi-diagnostic.txt") -Encoding UTF8
  } catch {
    "DPAPI diagnostic failed: $($_.Exception.Message)" | Set-Content (Join-Path $BundleRoot "dpapi-diagnostic.txt") -Encoding UTF8
  }

  $UatDirectory = Join-Path (Split-Path $StateDirectory -Parent) "uat-reports"
  if (Test-Path $UatDirectory) {
    $LatestUat = Get-ChildItem $UatDirectory -File -Filter "hardware-hub-uat-*.json" |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($LatestUat) {
      Copy-Item $LatestUat.FullName (Join-Path $BundleRoot "latest-uat-report.json") -Force
    }
  }

  [PSCustomObject]@{
    AppRoot = $AppRoot
    StateDirectory = $StateDirectory
    LogDirectory = $LogDirectory
    NodeExecutable = $NodeExecutable
    OutputDirectory = $OutputDirectory
  } | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $BundleRoot "installed-layout.json") -Encoding UTF8

  @"
This support bundle intentionally excludes:
- raw .env file
- secure credential file content
- agent secret and lease tokens
- SQLite execution journal content
- journal encryption key
- label/PDF/drawer artifacts
"@ | Set-Content (Join-Path $BundleRoot "SECURITY-NOTICE.txt") -Encoding UTF8

  $ZipPath = Join-Path $OutputDirectory "asihjaya-hardware-hub-support-$Stamp.zip"
  Compress-Archive -Path $BundleRoot -DestinationPath $ZipPath -CompressionLevel Optimal -Force
  Write-Host "Support bundle created: $ZipPath"
} finally {
  Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
