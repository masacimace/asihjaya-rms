param(
  [string]$TaskName = "Asihjaya Hardware Hub Agent"
)

$ErrorActionPreference = "Stop"

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $Task) {
  Write-Host "Scheduled task tidak ditemukan: $TaskName"
  exit 0
}

try {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
} catch {}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Scheduled task removed: $TaskName"
