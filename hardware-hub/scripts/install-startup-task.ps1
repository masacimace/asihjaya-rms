param(
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [int]$StartupDelaySeconds = 15,
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
  throw "Node.js tidak ditemukan di PATH. Install Node.js yang didukung lalu buka terminal baru."
}
$NodeExecutable = $NodeCommand.Source

Write-Host "Checking Hardware Hub config..."
Push-Location $HubRoot
try { & $NodeExecutable scripts/check-config.js } finally { Pop-Location }

$UserId = "$env:USERDOMAIN\$env:USERNAME"
$ActionArgs = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$StartScript`" -NodeExecutable `"$NodeExecutable`""
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $ActionArgs
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
try { $Trigger.Delay = "PT$([Math]::Max(0, $StartupDelaySeconds))S" } catch {}
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
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
  -Description "Runs the Asihjaya RMS local Hardware Hub Agent in the dedicated outlet user context." `
  -Force | Out-Null

Write-Host "Scheduled task installed: $TaskName"
Write-Host "User context          : $UserId"
Write-Host "Node executable       : $NodeExecutable"
Write-Host "Start script          : $StartScript"
Write-Host "Multiple instances    : IgnoreNew"
Write-Host "Restart policy        : 1 minute, up to 999 attempts"

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Scheduled task started."
}
