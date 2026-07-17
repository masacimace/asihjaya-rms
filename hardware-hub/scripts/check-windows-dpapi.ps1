$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "Asihjaya Hardware Hub Windows DPAPI check"
Write-Host "=========================================="
Write-Host ("PowerShell version : {0}" -f $PSVersionTable.PSVersion.ToString())
Write-Host ("PowerShell edition : {0}" -f $PSVersionTable.PSEdition)
Write-Host ("Windows user       : {0}\\{1}" -f $env:USERDOMAIN, $env:USERNAME)
Write-Host ("Process bitness    : {0}-bit" -f ([IntPtr]::Size * 8))

$assemblyErrors = @()
$loadedAssembly = $null
foreach ($assemblyName in @("System.Security.Cryptography.ProtectedData", "System.Security")) {
  try {
    Add-Type -AssemblyName $assemblyName -ErrorAction Stop
    $loadedAssembly = $assemblyName
    break
  }
  catch {
    $assemblyErrors += $_.Exception.Message
  }
}

$protectedDataType = "System.Security.Cryptography.ProtectedData" -as [type]
$scopeType = "System.Security.Cryptography.DataProtectionScope" -as [type]
if ($null -eq $protectedDataType -or $null -eq $scopeType) {
  throw ("DPAPI type tidak tersedia. Assembly errors: {0}" -f ($assemblyErrors -join " | "))
}

$sentinel = "asihjaya-dpapi-self-test:{0}" -f ([Guid]::NewGuid().ToString("D"))
$bytes = [System.Text.Encoding]::UTF8.GetBytes($sentinel)
$encrypted = [System.Security.Cryptography.ProtectedData]::Protect(
  $bytes,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
$decryptedBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $encrypted,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
$decrypted = [System.Text.Encoding]::UTF8.GetString($decryptedBytes)

if ($decrypted -ne $sentinel) {
  throw "DPAPI round-trip gagal: hasil decrypt tidak sama."
}

$loadedAssemblyLabel = if ($null -ne $loadedAssembly) { $loadedAssembly } else { "already loaded" }
Write-Host ("Loaded assembly    : {0}" -f $loadedAssemblyLabel)
Write-Host "DPAPI scope        : CurrentUser"
Write-Host "Round-trip test    : OK"
Write-Host ""
Write-Host "OK: Windows DPAPI siap dipakai Hardware Hub Protocol v2."
