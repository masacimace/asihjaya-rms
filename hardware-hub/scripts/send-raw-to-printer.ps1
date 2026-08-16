param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$PrinterName,

  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$FilePath,

  [string]$DocumentName = "Asihjaya Hardware Hub RAW"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
  throw "RAW print file tidak ditemukan: $FilePath"
}

$ResolvedFilePath = (Resolve-Path -LiteralPath $FilePath).Path
$Bytes = [System.IO.File]::ReadAllBytes($ResolvedFilePath)
if ($Bytes.Length -lt 1) {
  throw "RAW print file kosong: $ResolvedFilePath"
}

if (-not ("Asihjaya.RawPrinter.NativeMethods" -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace Asihjaya.RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOC_INFO_1
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;

        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDatatype;
    }

    public static class NativeMethods
    {
        [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool OpenPrinter(
            string pPrinterName,
            out IntPtr phPrinter,
            IntPtr pDefault
        );

        [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern int StartDocPrinter(
            IntPtr hPrinter,
            int level,
            [In] DOC_INFO_1 pDocInfo
        );

        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool WritePrinter(
            IntPtr hPrinter,
            byte[] pBytes,
            int dwCount,
            out int dwWritten
        );

        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool ClosePrinter(IntPtr hPrinter);
    }
}
'@
}

function New-Win32Exception {
  param(
    [string]$Operation,
    [int]$Code
  )
  $Inner = [System.ComponentModel.Win32Exception]::new($Code)
  return [System.ComponentModel.Win32Exception]::new(
    $Code,
    "$Operation gagal untuk printer '$PrinterName': $($Inner.Message) (Win32=$Code)"
  )
}

function Get-LastWin32Exception {
  param([string]$Operation)
  $Code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  return New-Win32Exception -Operation $Operation -Code $Code
}

$PrinterHandle = [IntPtr]::Zero
$DocumentStarted = $false
$PageStarted = $false
$JobId = 0

try {
  if (-not [Asihjaya.RawPrinter.NativeMethods]::OpenPrinter(
      $PrinterName,
      [ref]$PrinterHandle,
      [IntPtr]::Zero
    )) {
    throw (Get-LastWin32Exception "OpenPrinter")
  }

  $DocInfo = New-Object Asihjaya.RawPrinter.DOC_INFO_1
  $DocInfo.pDocName = $DocumentName
  $DocInfo.pOutputFile = $null
  $DocInfo.pDatatype = "RAW"

  $JobId = [Asihjaya.RawPrinter.NativeMethods]::StartDocPrinter(
    $PrinterHandle,
    1,
    $DocInfo
  )
  if ($JobId -le 0) {
    throw (Get-LastWin32Exception "StartDocPrinter")
  }
  $DocumentStarted = $true

  if (-not [Asihjaya.RawPrinter.NativeMethods]::StartPagePrinter($PrinterHandle)) {
    throw (Get-LastWin32Exception "StartPagePrinter")
  }
  $PageStarted = $true

  $Written = 0
  if (-not [Asihjaya.RawPrinter.NativeMethods]::WritePrinter(
      $PrinterHandle,
      $Bytes,
      $Bytes.Length,
      [ref]$Written
    )) {
    throw (Get-LastWin32Exception "WritePrinter")
  }

  if ($Written -ne $Bytes.Length) {
    throw "WritePrinter hanya menulis $Written dari $($Bytes.Length) byte ke printer '$PrinterName'."
  }

  if (-not [Asihjaya.RawPrinter.NativeMethods]::EndPagePrinter($PrinterHandle)) {
    throw (Get-LastWin32Exception "EndPagePrinter")
  }
  $PageStarted = $false

  if (-not [Asihjaya.RawPrinter.NativeMethods]::EndDocPrinter($PrinterHandle)) {
    throw (Get-LastWin32Exception "EndDocPrinter")
  }
  $DocumentStarted = $false

  [PSCustomObject]@{
    printerName = $PrinterName
    jobId = $JobId
    bytesWritten = $Written
    dataType = "RAW"
    documentName = $DocumentName
  } | ConvertTo-Json -Compress
}
finally {
  if ($PageStarted -and $PrinterHandle -ne [IntPtr]::Zero) {
    try { [void][Asihjaya.RawPrinter.NativeMethods]::EndPagePrinter($PrinterHandle) } catch {}
  }
  if ($DocumentStarted -and $PrinterHandle -ne [IntPtr]::Zero) {
    try { [void][Asihjaya.RawPrinter.NativeMethods]::EndDocPrinter($PrinterHandle) } catch {}
  }
  if ($PrinterHandle -ne [IntPtr]::Zero) {
    try { [void][Asihjaya.RawPrinter.NativeMethods]::ClosePrinter($PrinterHandle) } catch {}
  }
}
