param(
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StartScript = Join-Path $HubRoot "scripts\start-agent.ps1"
$EnvFile = Join-Path $HubRoot ".env"

if (-not (Test-Path $EnvFile)) {
  throw "File .env belum ada di $HubRoot. Copy .env.example menjadi .env lalu isi konfigurasi agent."
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCommand) {
  throw "Node.js tidak ditemukan di PATH. Install Node.js LTS dulu, lalu buka terminal baru."
}

Write-Host "Checking Hardware Hub config..."
Push-Location $HubRoot
try {
  node scripts/check-config.js
} finally {
  Pop-Location
}

$UserId = "$env:USERDOMAIN\$env:USERNAME"
$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 30) `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1)
$Principal = New-ScheduledTaskPrincipal `
  -UserId $UserId `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Principal $Principal `
  -Description "Runs the Asihjaya RMS local Hardware Hub Agent at Windows logon." `
  -Force | Out-Null

Write-Host "Scheduled task installed: $TaskName"
Write-Host "User context          : $UserId"
Write-Host "Start script          : $StartScript"

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Scheduled task started."
}
