param(
  [string]$AppRoot = "",
  [string]$StateDirectory = "",
  [string]$LogDirectory = "",
  [string]$ReportDirectory = "",
  [string]$TaskName = "Asihjaya Hardware Hub Agent",
  [switch]$TestLabel,
  [switch]$TestDocument,
  [switch]$ExportSupportBundle
)

$ErrorActionPreference = "Stop"

if (-not $AppRoot) {
  $AppRoot = Join-Path $env:ProgramFiles "ASIHJAYA\Hardware Hub\app"
}
if (-not $StateDirectory) {
  $StateDirectory = Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\data"
}
if (-not $LogDirectory) {
  $LogDirectory = Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\logs"
}
if (-not $ReportDirectory) {
  $ReportDirectory = Join-Path $env:ProgramData "ASIHJAYA\Hardware Hub\uat-reports"
}

$AppRoot = [System.IO.Path]::GetFullPath($AppRoot)
$StateDirectory = [System.IO.Path]::GetFullPath($StateDirectory)
$LogDirectory = [System.IO.Path]::GetFullPath($LogDirectory)
$ReportDirectory = [System.IO.Path]::GetFullPath($ReportDirectory)
$InstallRoot = Split-Path $AppRoot -Parent
$PrivateNode = Join-Path $InstallRoot "runtime\node.exe"
$PdfExecutable = Join-Path $InstallRoot "tools\SumatraPDF.exe"
$EnvPath = Join-Path $AppRoot ".env"
$CredentialPath = Join-Path $StateDirectory "agent-credential.json"
$HealthPath = Join-Path $StateDirectory "health-state.json"

$Checks = New-Object System.Collections.Generic.List[object]

function Add-Check([string]$Name, [bool]$Success, [string]$Detail) {
  $Checks.Add([PSCustomObject]@{
    name = $Name
    success = $Success
    detail = $Detail
  }) | Out-Null

  $Prefix = if ($Success) { "PASS" } else { "FAIL" }
  Write-Host "[$Prefix] $Name - $Detail"
}

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

function Invoke-PrivateNode([string]$Script, [string[]]$Arguments) {
  $ScriptPath = Join-Path $AppRoot "scripts\$Script"
  $Output = & $PrivateNode $ScriptPath @Arguments 2>&1 | Out-String
  return [PSCustomObject]@{
    ExitCode = $LASTEXITCODE
    Output = $Output.Trim()
  }
}

New-Item -ItemType Directory -Force -Path $ReportDirectory | Out-Null

Add-Check "Installed application" (Test-Path $AppRoot) $AppRoot
Add-Check "Private Node runtime" (Test-Path $PrivateNode) $PrivateNode
Add-Check "Bundled SumatraPDF" (Test-Path $PdfExecutable) $PdfExecutable
Add-Check "Non-secret configuration" (Test-Path $EnvPath) $EnvPath
Add-Check "Secure credential store" (Test-Path $CredentialPath) $CredentialPath
Add-Check "ProgramData state directory" (Test-Path $StateDirectory) $StateDirectory
Add-Check "ProgramData log directory" (Test-Path $LogDirectory) $LogDirectory

if (-not (Test-Path $PrivateNode)) {
  throw "Private Node runtime tidak ditemukan. Install ulang ASIHJAYA Hardware Hub sebelum menjalankan UAT."
}

$LabelPrinter = Get-EnvValue "LABEL_PRINTER_NAME"
$DocumentPrinter = Get-EnvValue "DOCUMENT_PRINTER_NAME"
Add-Check "Configured label printer" ([bool]$LabelPrinter) $(if ($LabelPrinter) { $LabelPrinter } else { "LABEL_PRINTER_NAME kosong" })
Add-Check "Configured document printer" ([bool]$DocumentPrinter) $(if ($DocumentPrinter) { $DocumentPrinter } else { "DOCUMENT_PRINTER_NAME kosong" })

try {
  $ConfigCheck = Invoke-PrivateNode "check-config.js" @()
  Add-Check "Hardware Hub config check" ($ConfigCheck.ExitCode -eq 0) $(if ($ConfigCheck.ExitCode -eq 0) { "exit=0" } else { "exit=$($ConfigCheck.ExitCode): $($ConfigCheck.Output)" })
} catch {
  Add-Check "Hardware Hub config check" $false $_.Exception.Message
}

try {
  $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  $TaskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
  $ExpectedUser = "$env:USERDOMAIN\$env:USERNAME"
  $PrincipalMatches = [string]::Equals($Task.Principal.UserId, $ExpectedUser, [System.StringComparison]::OrdinalIgnoreCase)
  Add-Check "Scheduled Task exists" $true "state=$($Task.State); lastResult=$($TaskInfo.LastTaskResult)"
  Add-Check "Scheduled Task user context" $PrincipalMatches "task=$($Task.Principal.UserId); current=$ExpectedUser"
} catch {
  Add-Check "Scheduled Task exists" $false $_.Exception.Message
  Add-Check "Scheduled Task user context" $false "Scheduled Task tidak tersedia"
}

try {
  if (-not (Test-Path $HealthPath)) { throw "health-state.json belum tersedia" }
  $Health = Get-Content -LiteralPath $HealthPath -Raw | ConvertFrom-Json
  $UpdatedAt = [DateTimeOffset]::Parse([string]$Health.updatedAt)
  $AgeSeconds = [Math]::Round(([DateTimeOffset]::UtcNow - $UpdatedAt.ToUniversalTime()).TotalSeconds, 1)
  $Ready = ($Health.ready -eq $true) -and ([string]$Health.status -eq "healthy") -and ($AgeSeconds -le 120)
  Add-Check "Agent health readiness" $Ready "status=$($Health.status); ready=$($Health.ready); ageSeconds=$AgeSeconds; pid=$($Health.process.pid)"
} catch {
  Add-Check "Agent health readiness" $false $_.Exception.Message
}

try {
  $Printers = @(Get-Printer | Select-Object -ExpandProperty Name)
  $LabelFound = [bool]$LabelPrinter -and ($Printers -contains $LabelPrinter)
  $DocumentFound = [bool]$DocumentPrinter -and ($Printers -contains $DocumentPrinter)
  Add-Check "Label printer installed for current user" $LabelFound $(if ($LabelPrinter) { $LabelPrinter } else { "printer belum dikonfigurasi" })
  Add-Check "Document printer installed for current user" $DocumentFound $(if ($DocumentPrinter) { $DocumentPrinter } else { "printer belum dikonfigurasi" })
} catch {
  Add-Check "Label printer installed for current user" $false $_.Exception.Message
  Add-Check "Document printer installed for current user" $false $_.Exception.Message
}

if ($TestLabel) {
  if (-not $LabelPrinter) {
    Add-Check "Physical label test" $false "LABEL_PRINTER_NAME kosong"
  } else {
    try {
      $Result = Invoke-PrivateNode "installer-test-print.js" @(
        "--device", "label",
        "--printer", $LabelPrinter,
        "--state-dir", $StateDirectory
      )
      Add-Check "Physical label test" ($Result.ExitCode -eq 0) $(if ($Result.ExitCode -eq 0) { "job dikirim ke $LabelPrinter" } else { $Result.Output })
    } catch {
      Add-Check "Physical label test" $false $_.Exception.Message
    }
  }
}

if ($TestDocument) {
  if (-not $DocumentPrinter) {
    Add-Check "Physical document test" $false "DOCUMENT_PRINTER_NAME kosong"
  } else {
    try {
      $Result = Invoke-PrivateNode "installer-test-print.js" @(
        "--device", "document",
        "--printer", $DocumentPrinter,
        "--state-dir", $StateDirectory,
        "--pdf-executable", $PdfExecutable
      )
      Add-Check "Physical document test" ($Result.ExitCode -eq 0) $(if ($Result.ExitCode -eq 0) { "job dikirim ke $DocumentPrinter" } else { $Result.Output })
    } catch {
      Add-Check "Physical document test" $false $_.Exception.Message
    }
  }
}

$Failed = @($Checks | Where-Object { -not $_.success })
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ReportPath = Join-Path $ReportDirectory "hardware-hub-uat-$Stamp.json"
$Report = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  computerName = $env:COMPUTERNAME
  windowsUser = "$env:USERDOMAIN\$env:USERNAME"
  appRoot = $AppRoot
  stateDirectory = $StateDirectory
  logDirectory = $LogDirectory
  labelPrinter = $LabelPrinter
  documentPrinter = $DocumentPrinter
  physicalTestsRequested = [ordered]@{
    label = [bool]$TestLabel
    document = [bool]$TestDocument
  }
  passed = ($Failed.Count -eq 0)
  checks = $Checks
  security = [ordered]@{
    rawEnvironmentIncluded = $false
    agentSecretIncluded = $false
    credentialContentIncluded = $false
  }
}
$Report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Write-Host ""
Write-Host "UAT report: $ReportPath"

if ($ExportSupportBundle) {
  $BundleScript = Join-Path $AppRoot "scripts\export-support-bundle.ps1"
  if (Test-Path $BundleScript) {
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $BundleScript `
      -AppRoot $AppRoot `
      -StateDirectory $StateDirectory `
      -LogDirectory $LogDirectory
  } else {
    Write-Warning "Support bundle script tidak ditemukan: $BundleScript"
  }
}

if ($Failed.Count -gt 0) {
  Write-Host ""
  Write-Host "FAIL: $($Failed.Count) UAT check gagal." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "PASS: Hardware Hub local UAT berhasil." -ForegroundColor Green
exit 0
