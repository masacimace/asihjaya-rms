param(
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [string]$StateDirectory = "",
  [int]$TimeoutSeconds = 110,
  [int]$PollSeconds = 2
)

$ErrorActionPreference = "Stop"

if (-not $StateDirectory) {
  $StateDirectory = Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\data"
}
$StateDirectory = [System.IO.Path]::GetFullPath($StateDirectory)
$HealthPath = Join-Path $StateDirectory "health-state.json"

function Get-HealthSnapshot {
  if (-not (Test-Path $HealthPath)) { return $null }
  try {
    $Health = Get-Content -LiteralPath $HealthPath -Raw | ConvertFrom-Json
    $UpdatedAt = [DateTimeOffset]::Parse([string]$Health.updatedAt)
    $AgeSeconds = ([DateTimeOffset]::UtcNow - $UpdatedAt.ToUniversalTime()).TotalSeconds
    $PidValue = [int]$Health.process.pid
    if ($PidValue -le 0) { return $null }
    return [PSCustomObject]@{
      pid = $PidValue
      status = [string]$Health.status
      ready = ($Health.ready -eq $true)
      ageSeconds = [Math]::Round($AgeSeconds, 1)
      updatedAt = $UpdatedAt
    }
  } catch {
    return $null
  }
}

function Wait-ForHealthyAgent([int]$DifferentFromPid, [int]$WaitSeconds) {
  $Deadline = [DateTimeOffset]::UtcNow.AddSeconds($WaitSeconds)
  do {
    $Snapshot = Get-HealthSnapshot
    if ($null -ne $Snapshot -and
        $Snapshot.pid -ne $DifferentFromPid -and
        $Snapshot.ready -and
        $Snapshot.status -eq "healthy" -and
        $Snapshot.ageSeconds -le 30 -and
        (Get-Process -Id $Snapshot.pid -ErrorAction SilentlyContinue)) {
      return $Snapshot
    }
    Start-Sleep -Seconds ([Math]::Max(1, $PollSeconds))
  } while ([DateTimeOffset]::UtcNow -lt $Deadline)
  return $null
}

Write-Host "ASIHJAYA Hardware Hub restart/recovery test"
Write-Host "=========================================="
Write-Host "Task        : $TaskName"
Write-Host "State       : $StateDirectory"
Write-Host "Timeout     : $TimeoutSeconds seconds"
Write-Host ""

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$Action = @($Task.Actions)[0]
if ($null -eq $Action) {
  throw "Scheduled Task tidak memiliki action."
}
if ([string]$Action.Arguments -notmatch '(?i)-WindowStyle\s+Hidden') {
  throw "Scheduled Task belum memakai hidden background runner. Jalankan installer/repair terbaru terlebih dahulu."
}
if ([int]$Task.Settings.RestartCount -lt 1) {
  throw "Scheduled Task tidak memiliki restart policy."
}
if ($null -eq $Task.Settings.RestartInterval) {
  throw "Scheduled Task tidak memiliki restart interval."
}

Write-Host "[PASS] Hidden runner   : $($Action.Execute) $($Action.Arguments)"
Write-Host "[PASS] Restart policy : count=$($Task.Settings.RestartCount); interval=$($Task.Settings.RestartInterval)"

$Before = Wait-ForHealthyAgent -DifferentFromPid 0 -WaitSeconds 30
if ($null -eq $Before) {
  Write-Host "Agent belum healthy; meminta Scheduled Task start..."
  Start-ScheduledTask -TaskName $TaskName
  $Before = Wait-ForHealthyAgent -DifferentFromPid 0 -WaitSeconds 30
}
if ($null -eq $Before) {
  throw "Agent tidak mencapai status healthy sebelum recovery test."
}

$OldPid = $Before.pid
Write-Host "[PASS] Agent before    : pid=$OldPid; ageSeconds=$($Before.ageSeconds)"
Write-Host ""
Write-Host "Simulating agent crash by terminating PID $OldPid..."
Stop-Process -Id $OldPid -Force -ErrorAction Stop

$Recovered = Wait-ForHealthyAgent -DifferentFromPid $OldPid -WaitSeconds $TimeoutSeconds
if ($null -eq $Recovered) {
  $TaskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
  $TaskState = (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue).State
  throw "Agent tidak recovery dalam $TimeoutSeconds detik. taskState=$TaskState; lastTaskResult=$($TaskInfo.LastTaskResult)"
}

Write-Host "[PASS] Agent recovered : oldPid=$OldPid; newPid=$($Recovered.pid); ageSeconds=$($Recovered.ageSeconds)"
Write-Host "PASS: Hardware Hub hidden background runner + automatic restart/recovery bekerja."
exit 0
