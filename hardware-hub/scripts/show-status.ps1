param([string]$TaskName = "Asihjaya Hardware Hub Agent")
$ErrorActionPreference = "Continue"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "=== Scheduled Task ==="
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task) {
  $Info = Get-ScheduledTaskInfo -TaskName $TaskName
  Write-Host "State            : $($Task.State)"
  Write-Host "Last run         : $($Info.LastRunTime)"
  Write-Host "Last result      : $($Info.LastTaskResult)"
  Write-Host "Next run         : $($Info.NextRunTime)"
  Write-Host "User             : $($Task.Principal.UserId)"
} else { Write-Warning "Scheduled task tidak ditemukan." }

Write-Host "`n=== Agent Health ==="
Push-Location $HubRoot
try { & node scripts/check-health.js } finally { Pop-Location }

Write-Host "`n=== Latest Structured Log ==="
$Latest = Get-ChildItem (Join-Path $HubRoot "logs") -File -Filter "agent-*.jsonl" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($Latest) {
  Write-Host $Latest.FullName
  Get-Content $Latest.FullName -Tail 5
} else { Write-Warning "Belum ada structured log." }
