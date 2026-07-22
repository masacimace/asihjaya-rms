param(
  [string]$OutputDirectory,
  [switch]$StrictReal
)

$ErrorActionPreference = "Stop"
$HubRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$EnvPath = Join-Path $HubRoot ".env"
$Results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param([string]$Name, [ValidateSet("PASS","WARNING","BLOCKED")][string]$Status, [string]$Detail)
  $Results.Add([PSCustomObject]@{ name = $Name; status = $Status; detail = $Detail })
}

function Read-EnvFile {
  param([string]$Path)
  $Map = @{}
  if (-not (Test-Path $Path)) { return $Map }
  foreach ($Line in Get-Content $Path) {
    $Trimmed = $Line.Trim()
    if (-not $Trimmed -or $Trimmed.StartsWith("#")) { continue }
    if ($Trimmed -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $Value = $Matches[2].Trim()
      if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
        $Value = $Value.Substring(1, $Value.Length - 2)
      }
      $Map[$Matches[1]] = $Value
    }
  }
  return $Map
}

function Get-EnvValue {
  param([hashtable]$Map, [string]$Name, [string]$Fallback = "")
  if ($Map.ContainsKey($Name) -and $Map[$Name]) { return [string]$Map[$Name] }
  return $Fallback
}

$Env = Read-EnvFile $EnvPath
if (Test-Path $EnvPath) { Add-Result "Environment file" "PASS" $EnvPath }
else { Add-Result "Environment file" "BLOCKED" "Copy .env.outlet.example menjadi .env lalu isi Agent ID/Secret." }

try {
  $NodeVersionText = (& node -v).Trim()
  $Version = [Version]($NodeVersionText.TrimStart('v'))
  if ($Version.Major -gt 22 -or ($Version.Major -eq 22 -and $Version.Minor -ge 5)) {
    if ($Version.Major -lt 25) { Add-Result "Node.js" "PASS" $NodeVersionText }
    else { Add-Result "Node.js" "BLOCKED" "$NodeVersionText tidak didukung; gunakan Node 22/24." }
  } else { Add-Result "Node.js" "BLOCKED" "$NodeVersionText terlalu lama; minimal 22.5." }
} catch { Add-Result "Node.js" "BLOCKED" $_.Exception.Message }

try {
  $Ps = $PSVersionTable.PSVersion.ToString()
  Add-Result "PowerShell" "PASS" "$Ps ($($PSVersionTable.PSEdition))"
} catch { Add-Result "PowerShell" "BLOCKED" $_.Exception.Message }

try {
  Push-Location $HubRoot
  $DpapiOutput = (& node scripts/check-dpapi-hotfix.js 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -eq 0) { Add-Result "Windows DPAPI" "PASS" ($DpapiOutput -split "`r?`n" | Select-Object -Last 1) }
  else { Add-Result "Windows DPAPI" "BLOCKED" $DpapiOutput }
} catch { Add-Result "Windows DPAPI" "BLOCKED" $_.Exception.Message }
finally { Pop-Location }

try {
  Push-Location $HubRoot
  $PreviousErrorActionPreference = $ErrorActionPreference
  try {
    # Windows PowerShell 5.1 dapat memperlakukan stderr native command sebagai
    # ErrorRecord ketika ErrorActionPreference=Stop. check-config memakai
    # console.warn (stderr) untuk warning non-fatal, jadi capture dengan Continue
    # dan tentukan status hanya dari native exit code.
    $ErrorActionPreference = "Continue"
    $ConfigOutput = (& node scripts/check-config.js 2>&1 | Out-String).Trim()
    $ConfigExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }

  if ($ConfigExitCode -eq 0) {
    $ConfigLastLine = (
      $ConfigOutput -split "`r?`n" |
        Where-Object { $_.Trim() } |
        Select-Object -Last 1
    )
    Add-Result "Agent configuration" "PASS" $ConfigLastLine
  } else {
    Add-Result "Agent configuration" "BLOCKED" $ConfigOutput
  }
} catch { Add-Result "Agent configuration" "BLOCKED" $_.Exception.Message }
finally { Pop-Location }

$ApiUrl = Get-EnvValue $Env "ASIHJAYA_API_URL"
if ($ApiUrl) {
  try {
    $HealthUrl = "$($ApiUrl.TrimEnd('/'))/api/health"
    $Response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 10
    if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 300) { Add-Result "RMS connectivity" "PASS" $HealthUrl }
    else { Add-Result "RMS connectivity" "WARNING" "$HealthUrl returned $($Response.StatusCode)." }
  } catch {
    $Status = if ($StrictReal) { "BLOCKED" } else { "WARNING" }
    Add-Result "RMS connectivity" $Status $_.Exception.Message
  }
} else { Add-Result "RMS connectivity" "BLOCKED" "ASIHJAYA_API_URL belum diisi." }

try {
  # Ambil huruf drive secara langsung. TrimEnd(':','\\') gagal pada
  # Windows PowerShell 5.1 karena "\\" dikonversi sebagai string dua karakter,
  # sedangkan overload .NET mengharapkan System.Char.
  $DriveRoot = [System.IO.Path]::GetPathRoot($HubRoot.Path)
  $DriveName = $DriveRoot.Substring(0, 1)
  $Drive = Get-PSDrive -Name $DriveName
  $FreeGb = [Math]::Round($Drive.Free / 1GB, 2)
  if ($FreeGb -ge 10) { Add-Result "Disk space" "PASS" "$FreeGb GB free" }
  elseif ($FreeGb -ge 3) { Add-Result "Disk space" "WARNING" "$FreeGb GB free; disarankan minimal 10 GB." }
  else { Add-Result "Disk space" "BLOCKED" "$FreeGb GB free." }
} catch { Add-Result "Disk space" "WARNING" $_.Exception.Message }

$LabelMode = (Get-EnvValue $Env "LABEL_PRINTER_ADAPTER" (Get-EnvValue $Env "HARDWARE_ADAPTER_MODE" "fake")).ToLower()
$DocumentMode = (Get-EnvValue $Env "DOCUMENT_PRINTER_ADAPTER" (Get-EnvValue $Env "HARDWARE_ADAPTER_MODE" "fake")).ToLower()
$DrawerMode = (Get-EnvValue $Env "CASH_DRAWER_ADAPTER" (Get-EnvValue $Env "HARDWARE_ADAPTER_MODE" "fake")).ToLower()

try {
  $Printers = @(Get-Printer -ErrorAction Stop)
  foreach ($Pair in @(
    @{ Device = "SATO label printer"; Mode = $LabelMode; Name = (Get-EnvValue $Env "LABEL_PRINTER_NAME") },
    @{ Device = "Epson document printer"; Mode = $DocumentMode; Name = (Get-EnvValue $Env "DOCUMENT_PRINTER_NAME") }
  )) {
    if (-not $Pair.Name) {
      $Status = if ($Pair.Mode -eq "real") { "BLOCKED" } else { "WARNING" }
      Add-Result $Pair.Device $Status "Printer name belum diisi; adapter=$($Pair.Mode)."
      continue
    }
    $Found = $Printers | Where-Object { $_.Name -eq $Pair.Name }
    if ($Found) { Add-Result $Pair.Device "PASS" "$($Pair.Name) ($($Pair.Mode))" }
    else {
      $Status = if ($Pair.Mode -eq "real") { "BLOCKED" } else { "WARNING" }
      Add-Result $Pair.Device $Status "$($Pair.Name) tidak ditemukan; adapter=$($Pair.Mode)."
    }
  }
} catch { Add-Result "Windows printers" "WARNING" $_.Exception.Message }

$SumatraPath = Get-EnvValue $Env "PDF_PRINT_EXECUTABLE" "C:\Program Files\SumatraPDF\SumatraPDF.exe"
if (Test-Path $SumatraPath) { Add-Result "SumatraPDF" "PASS" $SumatraPath }
else {
  $Status = if ($DocumentMode -eq "real") { "BLOCKED" } else { "WARNING" }
  Add-Result "SumatraPDF" $Status "$SumatraPath tidak ditemukan; document adapter=$DocumentMode."
}

if ($DrawerMode -eq "real") { Add-Result "Cash drawer safety" "BLOCKED" "Cash drawer real belum disetujui pada PR 10." }
else { Add-Result "Cash drawer safety" "PASS" "Adapter tetap fake." }

try {
  $HealthPort = [int](Get-EnvValue $Env "HARDWARE_HEALTH_SERVER_PORT" "3210")
  $LocalHealth = Invoke-WebRequest -Uri "http://127.0.0.1:$HealthPort/health" -UseBasicParsing -TimeoutSec 3
  Add-Result "Local health endpoint" "PASS" "HTTP $($LocalHealth.StatusCode) pada port $HealthPort."
} catch { Add-Result "Local health endpoint" "WARNING" "Agent mungkin belum berjalan: $($_.Exception.Message)" }

try {
  $Task = Get-ScheduledTask -TaskName "Asihjaya Hardware Hub Agent" -ErrorAction Stop
  Add-Result "Scheduled Task" "PASS" "$($Task.State); user=$($Task.Principal.UserId)"
} catch { Add-Result "Scheduled Task" "WARNING" "Belum dipasang atau tidak dapat dibaca." }

$Blocked = @($Results | Where-Object status -eq "BLOCKED").Count
$Warnings = @($Results | Where-Object status -eq "WARNING").Count
$Overall = if ($Blocked -gt 0) { "BLOCKED" } elseif ($Warnings -gt 0) { "WARNING" } else { "PASS" }
$Report = [PSCustomObject]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  computerName = $env:COMPUTERNAME
  windowsUser = "$env:USERDOMAIN\$env:USERNAME"
  hubRoot = $HubRoot.Path
  overall = $Overall
  blocked = $Blocked
  warnings = $Warnings
  adapterModes = @{ label = $LabelMode; document = $DocumentMode; drawer = $DrawerMode }
  results = $Results
}

if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $HubRoot "outlet-reports\preflight-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$JsonPath = Join-Path $OutputDirectory "preflight-report.json"
$MdPath = Join-Path $OutputDirectory "preflight-report.md"
$Report | ConvertTo-Json -Depth 8 | Set-Content $JsonPath -Encoding UTF8
$Md = @(
  "# Hardware Hub Outlet Preflight",
  "",
  "- Generated: $($Report.generatedAt)",
  "- Computer: $($Report.computerName)",
  "- User: $($Report.windowsUser)",
  "- Overall: **$Overall**",
  "",
  "| Check | Status | Detail |",
  "|---|---|---|"
)
foreach ($Item in $Results) {
  $Detail = ([string]$Item.detail).Replace("|", "\\|").Replace("`r", " ").Replace("`n", " ")
  $Md += "| $($Item.name) | $($Item.status) | $Detail |"
}
$Md -join "`r`n" | Set-Content $MdPath -Encoding UTF8

foreach ($Item in $Results) {
  $Color = switch ($Item.status) { "PASS" { "Green" } "WARNING" { "Yellow" } default { "Red" } }
  Write-Host "[$($Item.status)] $($Item.name): $($Item.detail)" -ForegroundColor $Color
}
Write-Host "Overall: $Overall" -ForegroundColor $(if ($Overall -eq "PASS") { "Green" } elseif ($Overall -eq "WARNING") { "Yellow" } else { "Red" })
Write-Host "Report: $OutputDirectory"
if ($Blocked -gt 0) { exit 2 }
exit 0
