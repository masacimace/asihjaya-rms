param(
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [int]$StartupDelaySeconds = 15,
  [string]$NodeExecutable = "",
  [string]$StateDirectory = "",
  [switch]$RunNow,
  [switch]$ApplyStaged
)

$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StartScript = Join-Path $HubRoot "scripts\start-agent.ps1"
$EnvFile = Join-Path $HubRoot ".env"

if (-not (Test-Path $EnvFile)) {
  throw "File .env belum ada di $HubRoot. Jalankan ASIHJAYA Hardware Hub Setup terlebih dahulu."
}

function ConvertFrom-DotEnvValue([string]$Value) {
  $Text = [string]$Value
  $Text = $Text.Trim()
  if ($Text.Length -ge 2 -and $Text[0] -eq '"' -and $Text[$Text.Length - 1] -eq '"') {
    $Text = $Text.Substring(1, $Text.Length - 2)
    $Text = $Text.Replace('\"', '"')
    $Text = $Text.Replace('\\', '\')
  } elseif ($Text.Length -ge 2 -and $Text[0] -eq "'" -and $Text[$Text.Length - 1] -eq "'") {
    $Text = $Text.Substring(1, $Text.Length - 2)
  }
  return $Text
}

function Get-EnvValue([string]$Key) {
  $Prefix = "$Key="
  foreach ($Line in Get-Content -LiteralPath $EnvFile) {
    if ($Line.StartsWith($Prefix, [System.StringComparison]::Ordinal)) {
      return ConvertFrom-DotEnvValue $Line.Substring($Prefix.Length)
    }
  }
  return ""
}

if (-not $StateDirectory) {
  $StateDirectory = Get-EnvValue "HARDWARE_INSTALLER_STATE_DIR"
}
if (-not $StateDirectory) {
  $StateDirectory = Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\data"
}
$StateDirectory = ConvertFrom-DotEnvValue $StateDirectory
$StateDirectory = [System.IO.Path]::GetFullPath($StateDirectory)
New-Item -ItemType Directory -Force -Path $StateDirectory | Out-Null

$LogDirectory = Get-EnvValue "HARDWARE_LOG_DIR"
if (-not $LogDirectory) {
  $LogDirectory = Join-Path (Split-Path $StateDirectory -Parent) "logs"
}
$LogDirectory = ConvertFrom-DotEnvValue $LogDirectory
$LogDirectory = [System.IO.Path]::GetFullPath($LogDirectory)
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

$RequestPath = Join-Path $StateDirectory "startup-task-request.json"
$TaskLogPath = Join-Path $LogDirectory "startup-task-install.log"

function Write-TaskLog([string]$Level, [string]$Message) {
  try {
    $Stamp = [DateTimeOffset]::UtcNow.ToString("o")
    Add-Content -LiteralPath $TaskLogPath -Value "$Stamp [$Level] $Message" -Encoding UTF8
  } catch {}
}

function Test-IsAdministrator {
  $Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $Principal = [System.Security.Principal.WindowsPrincipal]::new($Identity)
  return $Principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Resolve-Sid([string]$UserId) {
  if ($UserId -match '^S-\d-') {
    return [System.Security.Principal.SecurityIdentifier]::new($UserId).Value
  }
  $Account = [System.Security.Principal.NTAccount]::new($UserId)
  return $Account.Translate([System.Security.Principal.SecurityIdentifier]).Value
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

if ($ApplyStaged) {
  try {
    if (-not (Test-IsAdministrator)) {
      throw "Penerapan Scheduled Task membutuhkan elevated installer context."
    }
    if (-not (Test-Path $RequestPath)) {
      throw "Request Scheduled Task tidak ditemukan: $RequestPath"
    }

    $Request = Get-Content -LiteralPath $RequestPath -Raw | ConvertFrom-Json
    if ([int]$Request.schemaVersion -ne 1) {
      throw "Schema request Scheduled Task tidak didukung."
    }
    if ([string]::IsNullOrWhiteSpace([string]$Request.targetUserId)) {
      throw "Target user Scheduled Task kosong."
    }
    if ([string]::IsNullOrWhiteSpace([string]$Request.targetUserSid)) {
      throw "Target SID Scheduled Task kosong."
    }
    if (-not [string]::Equals([string]$Request.taskName, $TaskName, [System.StringComparison]::Ordinal)) {
      throw "Task name pada request tidak cocok."
    }

    $CreatedAt = [DateTimeOffset]::Parse([string]$Request.createdAt)
    if (([DateTimeOffset]::UtcNow - $CreatedAt.ToUniversalTime()).TotalMinutes -gt 30) {
      throw "Request Scheduled Task sudah kedaluwarsa. Jalankan Setup kembali."
    }

    $ResolvedTargetSid = Resolve-Sid ([string]$Request.targetUserId)
    if (-not [string]::Equals($ResolvedTargetSid, [string]$Request.targetUserSid, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Target user dan SID pada request Scheduled Task tidak cocok."
    }

    $RequestAcl = Get-Acl -LiteralPath $RequestPath
    $OwnerSid = Resolve-Sid ([string]$RequestAcl.Owner)
    if (-not [string]::Equals($OwnerSid, [string]$Request.targetUserSid, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Owner request Scheduled Task tidak cocok dengan user Windows outlet."
    }

    $TargetUserId = [string]$Request.targetUserId
    $StartupDelaySeconds = [Math]::Min(300, [Math]::Max(0, [int]$Request.startupDelaySeconds))
    $ShouldRunNow = [bool]$Request.runNow -or [bool]$RunNow
    $PowerShellExecutable = (Get-Command powershell.exe -ErrorAction Stop).Source
    $ActionArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartScript`" -NodeExecutable `"$NodeExecutable`""
    $Action = New-ScheduledTaskAction -Execute $PowerShellExecutable -Argument $ActionArgs
    $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $TargetUserId
    try { $Trigger.Delay = "PT$StartupDelaySeconds`S" } catch {}
    $Settings = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries `
      -DontStopIfGoingOnBatteries `
      -StartWhenAvailable `
      -MultipleInstances IgnoreNew `
      -ExecutionTimeLimit ([TimeSpan]::Zero) `
      -RestartCount 999 `
      -RestartInterval (New-TimeSpan -Minutes 1)
    $Principal = New-ScheduledTaskPrincipal `
      -UserId $TargetUserId `
      -LogonType Interactive `
      -RunLevel Limited

    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($ExistingTask) {
      Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 1
    }

    Register-ScheduledTask `
      -TaskName $TaskName `
      -Action $Action `
      -Trigger $Trigger `
      -Settings $Settings `
      -Principal $Principal `
      -Description "Runs the Asihjaya RMS local Hardware Hub Agent silently in the dedicated outlet user context." `
      -Force | Out-Null

    if ($ShouldRunNow) {
      Start-ScheduledTask -TaskName $TaskName
    }

    Remove-Item -LiteralPath $RequestPath -Force -ErrorAction SilentlyContinue
    Write-TaskLog "INFO" "Scheduled Task applied successfully for $TargetUserId; hidden=true; restart=1m/999."

    Write-Host "Scheduled task installed: $TaskName"
    Write-Host "User context          : $TargetUserId"
    Write-Host "PowerShell executable : $PowerShellExecutable"
    Write-Host "Node executable       : $NodeExecutable"
    Write-Host "Start script          : $StartScript"
    Write-Host "Window mode           : hidden/background"
    Write-Host "Multiple instances    : IgnoreNew"
    Write-Host "Restart policy        : 1 minute, up to 999 attempts"
    if ($ShouldRunNow) {
      Write-Host "Scheduled task started."
    }
    exit 0
  } catch {
    Write-TaskLog "ERROR" $_.Exception.Message
    Write-Error $_.Exception.Message
    exit 1
  }
}

Write-Host "Checking Hardware Hub config..."
Push-Location $HubRoot
try { & $NodeExecutable scripts/check-config.js } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) {
  throw "Hardware Hub config check gagal."
}

try {
  $Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $TargetUserId = $Identity.Name
  $TargetUserSid = $Identity.User.Value
  if ([string]::IsNullOrWhiteSpace($TargetUserId) -or [string]::IsNullOrWhiteSpace($TargetUserSid)) {
    throw "Identity user Windows outlet tidak dapat ditentukan."
  }

  $Request = [ordered]@{
    schemaVersion = 1
    createdAt = [DateTimeOffset]::UtcNow.ToString("o")
    taskName = $TaskName
    targetUserId = $TargetUserId
    targetUserSid = $TargetUserSid
    startupDelaySeconds = [Math]::Min(300, [Math]::Max(0, $StartupDelaySeconds))
    runNow = [bool]$RunNow
  }

  $TempPath = "$RequestPath.$PID.tmp"
  $Request | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $TempPath -Encoding UTF8

  $Acl = New-Object System.Security.AccessControl.FileSecurity
  $Acl.SetAccessRuleProtection($true, $false)
  $Acl.SetOwner($Identity.User)
  $Allow = [System.Security.AccessControl.AccessControlType]::Allow
  $FullControl = [System.Security.AccessControl.FileSystemRights]::FullControl
  $Acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($Identity.User, $FullControl, $Allow))
  $AdministratorsSid = [System.Security.Principal.SecurityIdentifier]::new(
    [System.Security.Principal.WellKnownSidType]::BuiltinAdministratorsSid,
    $null
  )
  $SystemSid = [System.Security.Principal.SecurityIdentifier]::new(
    [System.Security.Principal.WellKnownSidType]::LocalSystemSid,
    $null
  )
  $Acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($AdministratorsSid, $FullControl, $Allow))
  $Acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($SystemSid, $FullControl, $Allow))
  Set-Acl -LiteralPath $TempPath -AclObject $Acl

  Move-Item -LiteralPath $TempPath -Destination $RequestPath -Force
  Write-TaskLog "INFO" "Scheduled Task request staged for $TargetUserId; elevated apply pending."

  Write-Host "Scheduled task request staged: $RequestPath"
  Write-Host "Target user                  : $TargetUserId"
  Write-Host "Registration                 : pending elevated installer apply"
  Write-Host "Window mode                  : hidden/background"
  Write-Host "Restart policy               : 1 minute, up to 999 attempts"
  exit 0
} catch {
  Write-TaskLog "ERROR" "Failed to stage Scheduled Task request: $($_.Exception.Message)"
  throw
}
