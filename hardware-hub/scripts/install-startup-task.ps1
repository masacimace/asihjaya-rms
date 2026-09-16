param(
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [int]$StartupDelaySeconds = 15,
  [string]$NodeExecutable = "",
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StartScript = Join-Path $HubRoot "scripts\start-agent.ps1"
$EnvFile = Join-Path $HubRoot ".env"

if (-not (Test-Path $EnvFile)) {
  throw "File .env belum ada di $HubRoot. Jalankan ASIHJAYA Hardware Hub Setup terlebih dahulu."
}

if ($NodeExecutable) {
  $NodeExecutable = [System.IO.Path]::GetFullPath($NodeExecutable)
  if (-not (Test-Path $NodeExecutable)) {
    throw "Node.js private runtime tidak ditemukan: $NodeExecutable"
  }
} else {
  $BundledNode = Join-Path (Split-Path $HubRoot -Parent) "runtime\node.exe"
  if (Test-Path $BundledNode) {
    $NodeExecutable = $BundledNode
  } else {
    $NodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $NodeCommand) {
      throw "Node.js tidak ditemukan. Install ulang Hardware Hub atau sediakan -NodeExecutable."
    }
    $NodeExecutable = $NodeCommand.Source
  }
}

Write-Host "Checking Hardware Hub config..."
Push-Location $HubRoot
try { & $NodeExecutable scripts/check-config.js } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) {
  throw "Hardware Hub config check gagal."
}

$UserId = "$env:USERDOMAIN\$env:USERNAME"
$PowerShellExecutable = (Get-Command powershell.exe -ErrorAction Stop).Source
$ActionArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartScript`" -NodeExecutable `"$NodeExecutable`""
$Action = New-ScheduledTaskAction -Execute $PowerShellExecutable -Argument $ActionArgs
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
  -Description "Runs the Asihjaya RMS local Hardware Hub Agent silently in the dedicated outlet user context." `
  -Force | Out-Null

Write-Host "Scheduled task installed: $TaskName"
Write-Host "User context          : $UserId"
Write-Host "PowerShell executable : $PowerShellExecutable"
Write-Host "Node executable       : $NodeExecutable"
Write-Host "Start script          : $StartScript"
Write-Host "Window mode           : hidden/background"
Write-Host "Multiple instances    : IgnoreNew"
Write-Host "Restart policy        : 1 minute, up to 999 attempts"

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "Scheduled task started."
}
