param(
  [string]$ApiUrl = "https://ajsystem.id",
  [string]$NodeVersion = "24.14.0",
  [string]$InnoCompiler = "",
  [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"
$InstallerRoot = Resolve-Path $PSScriptRoot
$HubRoot = Resolve-Path (Join-Path $InstallerRoot "..")
$PayloadRoot = Join-Path $InstallerRoot "payload"
$AppPayload = Join-Path $PayloadRoot "app"
$RuntimePayload = Join-Path $PayloadRoot "runtime"
$ToolsPayload = Join-Path $PayloadRoot "tools"
$DownloadRoot = Join-Path $InstallerRoot ".downloads"
$OutputRoot = Join-Path $InstallerRoot "output"
$IssPath = Join-Path $InstallerRoot "AsihjayaHardwareHub.iss"

$NodeZipHash = "313fa40c0d7b18575821de8cb17483031fe07d95de5994f6f435f3b345f85c66"
$SumatraVersion = "3.6.1"
$SumatraZipHash = "98b33a518d42986856d225064b0cd2d3643ecf78cbf84ab873d26cc51877a544"

function Assert-Sha256([string]$Path, [string]$Expected) {
  $Actual = (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
  if ($Actual -ne $Expected.ToLowerInvariant()) {
    throw "SHA-256 mismatch untuk $Path. expected=$Expected actual=$Actual"
  }
}

function Download-Verified([string]$Uri, [string]$Destination, [string]$Sha256) {
  if (-not (Test-Path $Destination)) {
    Write-Host "Downloading $Uri"
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination
  }
  Assert-Sha256 -Path $Destination -Expected $Sha256
}

function Copy-HubPayload {
  New-Item -ItemType Directory -Force -Path $AppPayload | Out-Null
  foreach ($File in @("agent.js", ".env.example", "package.json", "package-lock.json", "fake-plan.example.json", "README.md")) {
    Copy-Item (Join-Path $HubRoot $File) (Join-Path $AppPayload $File) -Force
  }
  foreach ($Directory in @("config", "lib", "scripts", "node_modules")) {
    Copy-Item (Join-Path $HubRoot $Directory) (Join-Path $AppPayload $Directory) -Recurse -Force
  }
}

function Resolve-InnoCompiler {
  if ($InnoCompiler) {
    if (-not (Test-Path $InnoCompiler)) {
      throw "ISCC.exe tidak ditemukan: $InnoCompiler"
    }
    return (Resolve-Path $InnoCompiler).Path
  }

  $Candidates = @(
    "$env:ProgramFiles\Inno Setup 7\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 7\ISCC.exe"
  ) | Where-Object { $_ -and (Test-Path $_) }

  if (-not $Candidates) {
    throw "Inno Setup 7 ISCC.exe belum terpasang. Install JRSoftware.InnoSetup.7 atau berikan -InnoCompiler."
  }
  return (Resolve-Path $Candidates[0]).Path
}

$Api = [Uri]$ApiUrl
$IsLoopbackHttp =
  ($Api.Scheme -eq "http") -and
  (($Api.Host -eq "127.0.0.1") -or ($Api.Host -eq "localhost"))

if (($Api.Scheme -ne "https") -and (-not $IsLoopbackHttp)) {
  throw "Setup.exe production wajib memakai HTTPS ApiUrl. HTTP hanya diizinkan untuk localhost/127.0.0.1 pada local UAT."
}

if ($IsLoopbackHttp) {
  Write-Host "LOCAL UAT MODE          : HTTP loopback diizinkan untuk $ApiUrl"
}

$Package = Get-Content (Join-Path $HubRoot "package.json") -Raw | ConvertFrom-Json
$AppVersion = [string]$Package.version
if (-not $AppVersion) { throw "hardware-hub/package.json tidak memiliki version." }

Remove-Item $PayloadRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $OutputRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $PayloadRoot, $RuntimePayload, $ToolsPayload, $DownloadRoot, $OutputRoot | Out-Null

if (-not $SkipNpmInstall) {
  Push-Location $HubRoot
  try {
    npm ci --omit=dev
    if ($LASTEXITCODE -ne 0) { throw "npm ci hardware-hub gagal." }
  } finally {
    Pop-Location
  }
}
if (-not (Test-Path (Join-Path $HubRoot "node_modules\dotenv"))) {
  throw "Production node_modules belum tersedia. Jalankan tanpa -SkipNpmInstall atau siapkan npm ci --omit=dev."
}

Copy-HubPayload

$NodeZipName = "node-v$NodeVersion-win-x64.zip"
$NodeZip = Join-Path $DownloadRoot $NodeZipName
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeZipName"
Download-Verified -Uri $NodeUrl -Destination $NodeZip -Sha256 $NodeZipHash
$NodeExtract = Join-Path $DownloadRoot "node-$NodeVersion"
Remove-Item $NodeExtract -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $NodeZip -DestinationPath $NodeExtract -Force
$NodeExe = Get-ChildItem $NodeExtract -Filter node.exe -Recurse | Select-Object -First 1
if (-not $NodeExe) { throw "node.exe tidak ditemukan di archive Node.js." }
Copy-Item $NodeExe.FullName (Join-Path $RuntimePayload "node.exe") -Force

$SumatraZipName = "SumatraPDF-$SumatraVersion-64.zip"
$SumatraZip = Join-Path $DownloadRoot $SumatraZipName
$SumatraUrl = "https://www.sumatrapdfreader.org/dl/rel/$SumatraVersion/$SumatraZipName"
Download-Verified -Uri $SumatraUrl -Destination $SumatraZip -Sha256 $SumatraZipHash
$SumatraExtract = Join-Path $DownloadRoot "sumatra-$SumatraVersion"
Remove-Item $SumatraExtract -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $SumatraZip -DestinationPath $SumatraExtract -Force
$SumatraExe = Get-ChildItem $SumatraExtract -Filter "SumatraPDF*.exe" -Recurse | Select-Object -First 1
if (-not $SumatraExe) { throw "SumatraPDF executable tidak ditemukan di archive." }
Copy-Item $SumatraExe.FullName (Join-Path $ToolsPayload "SumatraPDF.exe") -Force

$NodeRuntimeHash = (Get-FileHash -Algorithm SHA256 (Join-Path $RuntimePayload "node.exe")).Hash.ToLowerInvariant()
$SumatraRuntimeHash = (Get-FileHash -Algorithm SHA256 (Join-Path $ToolsPayload "SumatraPDF.exe")).Hash.ToLowerInvariant()
Write-Host "Node runtime SHA-256   : $NodeRuntimeHash"
Write-Host "SumatraPDF SHA-256     : $SumatraRuntimeHash"

$ISCC = Resolve-InnoCompiler
Write-Host "Inno Setup compiler    : $ISCC"
Write-Host "RMS API URL            : $ApiUrl"
Write-Host "Hardware Hub version   : $AppVersion"

Push-Location $InstallerRoot
try {
  & $ISCC "/DAppVersion=$AppVersion" "/DAppApiUrl=$ApiUrl" $IssPath
  if ($LASTEXITCODE -ne 0) { throw "Inno Setup compile gagal dengan exit code $LASTEXITCODE." }
} finally {
  Pop-Location
}

$SetupExe = Join-Path $OutputRoot "ASIHJAYA-Hardware-Hub-Setup.exe"
if (-not (Test-Path $SetupExe)) {
  throw "Setup.exe tidak ditemukan setelah compile: $SetupExe"
}

$SetupHash = (Get-FileHash -Algorithm SHA256 $SetupExe).Hash.ToLowerInvariant()
Write-Host ""
Write-Host "PASS: ASIHJAYA Hardware Hub Setup.exe berhasil dibuat."
Write-Host "Output : $SetupExe"
Write-Host "SHA256 : $SetupHash"