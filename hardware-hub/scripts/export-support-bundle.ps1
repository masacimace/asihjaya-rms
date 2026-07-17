param(
  [string]$OutputDirectory,
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [int]$RecentLogFiles = 10
)

$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $HubRoot "support-bundles" }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "asihjaya-hardware-support-$Stamp-$PID"
$BundleRoot = Join-Path $TempRoot "asihjaya-hardware-hub-support-$Stamp"
$LogTarget = Join-Path $BundleRoot "logs"
New-Item -ItemType Directory -Force -Path $LogTarget | Out-Null

try {
  Push-Location $HubRoot
  try {
    & node scripts/collect-diagnostics.js --output-dir $BundleRoot | Out-Null
  } finally { Pop-Location }

  $LogDir = Join-Path $HubRoot "logs"
  if (Test-Path $LogDir) {
    Get-ChildItem $LogDir -File -Filter "agent-*.jsonl" |
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

  @"
This support bundle intentionally excludes:
- raw .env file
- agent secret and lease tokens
- SQLite execution journal content
- journal encryption key
- label/PDF/drawer artifacts
"@ | Set-Content (Join-Path $BundleRoot "SECURITY-NOTICE.txt") -Encoding UTF8

  $ZipPath = Join-Path (Resolve-Path $OutputDirectory) "asihjaya-hardware-hub-support-$Stamp.zip"
  Compress-Archive -Path $BundleRoot -DestinationPath $ZipPath -CompressionLevel Optimal -Force
  Write-Host "Support bundle created: $ZipPath"
} finally {
  Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
