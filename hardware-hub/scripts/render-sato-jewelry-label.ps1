param(
  [string]$ConfigPath = "",
  [string]$MasterProductName = "NAMA PRODUK MASTER",
  [string]$ItemDisplayName = "NAMA ITEM PRODUK FISIK",
  [string]$Barcode = "AJ0002416",
  [string]$Weight = "2.75 Gr",
  [string]$OutputFile = "",
  [ValidateRange(1,20)]
  [int]$Copies = 1
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Drawing

$ESC = [char]27
$Encoding = [System.Text.Encoding]::ASCII
$HardwareHubRoot = Split-Path -Parent $PSScriptRoot
$PrivateFontCollection = $null

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $ConfigPath = Join-Path $HardwareHubRoot "config\sato-jewelry-barbell-host-bold.json"
} elseif (-not [System.IO.Path]::IsPathRooted($ConfigPath)) {
  $ConfigPath = Join-Path (Get-Location) $ConfigPath
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Layout config SATO tidak ditemukan: $ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ($config.version -ne 3) {
  throw "Layout config SATO version tidak didukung: $($config.version). Expected version 3 (Inter dual-name layout)."
}

function Get-RequiredInt {
  param(
    [object]$Value,
    [string]$Name,
    [int]$Minimum = 0,
    [int]$Maximum = 9999
  )

  $parsed = 0
  if (-not [int]::TryParse([string]$Value, [ref]$parsed)) {
    throw "$Name wajib integer."
  }
  if ($parsed -lt $Minimum -or $parsed -gt $Maximum) {
    throw "$Name harus antara $Minimum dan $Maximum; aktual=$parsed."
  }
  return $parsed
}

function Convert-To1BppBmpBytes {
  param(
    [System.Drawing.Bitmap]$Source,
    [ValidateRange(0, 255)]
    [int]$Threshold = 200,
    [ValidateRange(0, 2)]
    [int]$SpreadPx = 0
  )

  $width = $Source.Width
  $height = $Source.Height
  $black = [bool[,]]::new($width, $height)

  for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
      $pixel = $Source.GetPixel($x, $y)
      $luma = [int](0.299 * $pixel.R + 0.587 * $pixel.G + 0.114 * $pixel.B)
      if ($luma -lt $Threshold) {
        $black[$x, $y] = $true
      }
    }
  }

  if ($SpreadPx -gt 0) {
    $expanded = [bool[,]]::new($width, $height)
    for ($y = 0; $y -lt $height; $y++) {
      for ($x = 0; $x -lt $width; $x++) {
        if (-not $black[$x, $y]) { continue }
        for ($dy = -$SpreadPx; $dy -le $SpreadPx; $dy++) {
          for ($dx = -$SpreadPx; $dx -le $SpreadPx; $dx++) {
            $nx = $x + $dx
            $ny = $y + $dy
            if ($nx -ge 0 -and $nx -lt $width -and $ny -ge 0 -and $ny -lt $height) {
              $expanded[$nx, $ny] = $true
            }
          }
        }
      }
    }
    $black = $expanded
  }

  $rowStride = [int]([math]::Ceiling($width / 32.0) * 4)
  $imageBytes = $rowStride * $height
  $pixelOffset = 14 + 40 + 8
  $fileSize = $pixelOffset + $imageBytes
  $pixelsPerMeter = 7992

  $memory = [System.IO.MemoryStream]::new()
  $writer = [System.IO.BinaryWriter]::new($memory)
  try {
    $writer.Write([byte]0x42)
    $writer.Write([byte]0x4D)
    $writer.Write([uint32]$fileSize)
    $writer.Write([uint16]0)
    $writer.Write([uint16]0)
    $writer.Write([uint32]$pixelOffset)

    $writer.Write([uint32]40)
    $writer.Write([int32]$width)
    $writer.Write([int32]$height)
    $writer.Write([uint16]1)
    $writer.Write([uint16]1)
    $writer.Write([uint32]0)
    $writer.Write([uint32]$imageBytes)
    $writer.Write([int32]$pixelsPerMeter)
    $writer.Write([int32]$pixelsPerMeter)
    $writer.Write([uint32]2)
    $writer.Write([uint32]2)

    $writer.Write([byte]0xFF); $writer.Write([byte]0xFF); $writer.Write([byte]0xFF); $writer.Write([byte]0x00)
    $writer.Write([byte]0x00); $writer.Write([byte]0x00); $writer.Write([byte]0x00); $writer.Write([byte]0x00)

    for ($bmpY = $height - 1; $bmpY -ge 0; $bmpY--) {
      $row = [byte[]]::new($rowStride)
      for ($x = 0; $x -lt $width; $x++) {
        if (-not $black[$x, $bmpY]) { continue }
        $byteIndex = [int][math]::Floor($x / 8)
        $mask = [byte](0x80 -shr ($x % 8))
        $row[$byteIndex] = [byte]($row[$byteIndex] -bor $mask)
      }
      $writer.Write($row)
    }
    $writer.Flush()
    return $memory.ToArray()
  }
  finally {
    $writer.Dispose()
    $memory.Dispose()
  }
}

function Resolve-FontStyle {
  param([string]$Style)
  switch ($Style) {
    "Regular" { return [System.Drawing.FontStyle]::Regular }
    "Bold" { return [System.Drawing.FontStyle]::Bold }
    default { throw "font.style '$Style' tidak didukung. Gunakan Regular atau Bold." }
  }
}

function Resolve-FontContext {
  param(
    [string]$RequestedFamily,
    [string]$FilePathEnvName
  )

  $fontPath = ""
  if (-not [string]::IsNullOrWhiteSpace($FilePathEnvName)) {
    $fontPath = [Environment]::GetEnvironmentVariable($FilePathEnvName)
  }

  if (-not [string]::IsNullOrWhiteSpace($fontPath)) {
    if (-not [System.IO.Path]::IsPathRooted($fontPath)) {
      $fontPath = Join-Path $HardwareHubRoot $fontPath
    }
    if (-not (Test-Path -LiteralPath $fontPath)) {
      throw "Font SATO dari env $FilePathEnvName tidak ditemukan: $fontPath"
    }
    $script:PrivateFontCollection = [System.Drawing.Text.PrivateFontCollection]::new()
    $script:PrivateFontCollection.AddFontFile((Resolve-Path -LiteralPath $fontPath).Path)
    $family = $script:PrivateFontCollection.Families | Select-Object -First 1
    if ($null -eq $family) {
      throw "Font file SATO tidak menghasilkan FontFamily: $fontPath"
    }
    return [pscustomobject]@{
      Family = $family
      Name = $family.Name
      Source = "private-file"
      Path = (Resolve-Path -LiteralPath $fontPath).Path
    }
  }

  $installed = [System.Drawing.Text.InstalledFontCollection]::new()
  $family = $installed.Families | Where-Object { $_.Name -eq $RequestedFamily } | Select-Object -First 1
  if ($null -eq $family) {
    throw "Font '$RequestedFamily' tidak tersedia. Install Inter Medium atau set $FilePathEnvName ke Inter-Medium.ttf."
  }
  return [pscustomobject]@{
    Family = $family
    Name = $family.Name
    Source = "windows-installed"
    Path = $null
  }
}

function Get-StringAlignment {
  param([string]$Value)
  switch ($Value) {
    "left" { return [System.Drawing.StringAlignment]::Near }
    "center" { return [System.Drawing.StringAlignment]::Center }
    "right" { return [System.Drawing.StringAlignment]::Far }
    default { throw "textAlign '$Value' tidak didukung." }
  }
}

function Add-FittedTextLayer {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.FontFamily]$FontFamily,
    [System.Drawing.FontStyle]$FontStyle,
    [string]$Text,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [int]$FontPx,
    [int]$MinFontPx,
    [string]$TextAlign,
    [bool]$TruncateWithEllipsis = $false
  )

  $candidate = $Text.Trim()
  if ([string]::IsNullOrWhiteSpace($candidate)) { $candidate = "-" }
  $measureFormat = [System.Drawing.StringFormat]::GenericTypographic
  $measureFormat.FormatFlags = $measureFormat.FormatFlags -bor [System.Drawing.StringFormatFlags]::NoWrap

  $resolvedFont = $null
  $measuredWidth = 0
  $measuredHeight = 0
  $resolvedFontPx = $FontPx

  for ($size = $FontPx; $size -ge $MinFontPx; $size--) {
    $font = [System.Drawing.Font]::new($FontFamily, [float]$size, $FontStyle, [System.Drawing.GraphicsUnit]::Pixel)
    $measured = $Graphics.MeasureString($candidate, $font, [int]::MaxValue, $measureFormat)
    $w = [int][math]::Ceiling($measured.Width)
    $h = [int][math]::Ceiling($measured.Height)
    if ($w -le ($Width - 2) -and $h -le $Height) {
      $resolvedFont = $font
      $resolvedFontPx = $size
      $measuredWidth = $w
      $measuredHeight = $h
      break
    }
    $font.Dispose()
  }

  if ($null -eq $resolvedFont -and $TruncateWithEllipsis) {
    $resolvedFontPx = $MinFontPx
    $resolvedFont = [System.Drawing.Font]::new($FontFamily, [float]$MinFontPx, $FontStyle, [System.Drawing.GraphicsUnit]::Pixel)
    $base = $candidate
    while ($base.Length -gt 4) {
      $base = $base.Substring(0, $base.Length - 1).TrimEnd()
      $candidate = "$base..."
      $measured = $Graphics.MeasureString($candidate, $resolvedFont, [int]::MaxValue, $measureFormat)
      $measuredWidth = [int][math]::Ceiling($measured.Width)
      $measuredHeight = [int][math]::Ceiling($measured.Height)
      if ($measuredWidth -le ($Width - 2) -and $measuredHeight -le $Height) { break }
    }
  }

  if ($null -eq $resolvedFont) {
    throw "Text '$Text' tidak muat pada layer ${Width}x${Height} sampai minimum ${MinFontPx}px."
  }

  if ($measuredWidth -gt ($Width - 2) -or $measuredHeight -gt $Height) {
    $resolvedFont.Dispose()
    throw "Text '$candidate' tetap tidak muat pada layer ${Width}x${Height}."
  }

  try {
    $format = [System.Drawing.StringFormat]::new()
    try {
      $format.Alignment = Get-StringAlignment -Value $TextAlign
      $format.LineAlignment = [System.Drawing.StringAlignment]::Center
      $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
      $rect = [System.Drawing.RectangleF]::new($X, $Y, $Width, $Height)
      $Graphics.DrawString($candidate, $resolvedFont, [System.Drawing.Brushes]::Black, $rect, $format)
    }
    finally {
      $format.Dispose()
    }
  }
  finally {
    $resolvedFont.Dispose()
  }

  return [pscustomobject]@{
    text = $candidate
    fontPx = $resolvedFontPx
    x = $X
    y = $Y
    widthDots = $Width
    heightDots = $Height
    measuredWidth = $measuredWidth
    measuredHeight = $measuredHeight
    truncated = ($candidate -ne $Text.Trim())
  }
}

function Get-WrappedLinesForFont {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Font]$Font,
    [string]$Text,
    [int]$MaxWidth,
    [int]$MaxLines
  )

  $measureFormat = [System.Drawing.StringFormat]::GenericTypographic
  $measureFormat.FormatFlags = $measureFormat.FormatFlags -bor [System.Drawing.StringFormatFlags]::NoWrap
  $words = $Text.Trim() -split '\s+'
  $lines = [System.Collections.Generic.List[string]]::new()
  $current = ""

  foreach ($word in $words) {
    $candidate = if ([string]::IsNullOrWhiteSpace($current)) { $word } else { "$current $word" }
    $measured = $Graphics.MeasureString($candidate, $Font, [int]::MaxValue, $measureFormat)
    if ([math]::Ceiling($measured.Width) -le ($MaxWidth - 2)) {
      $current = $candidate
      continue
    }

    if ([string]::IsNullOrWhiteSpace($current)) {
      return $null
    }
    $lines.Add($current)
    $current = $word
    if ($lines.Count -ge $MaxLines) { return $null }
  }

  if (-not [string]::IsNullOrWhiteSpace($current)) { $lines.Add($current) }
  if ($lines.Count -gt $MaxLines) { return $null }
  return $lines.ToArray()
}

function Add-FittedWrappedTextLayer {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.FontFamily]$FontFamily,
    [System.Drawing.FontStyle]$FontStyle,
    [string]$Text,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [int]$FontPx,
    [int]$MinFontPx,
    [int]$MaxLines,
    [string]$TextAlign,
    [bool]$TruncateWithEllipsis = $false
  )

  $candidate = $Text.Trim()
  if ([string]::IsNullOrWhiteSpace($candidate)) { $candidate = "-" }
  $resolvedFont = $null
  $resolvedLines = $null
  $resolvedFontPx = $FontPx
  $lineHeight = 0

  for ($size = $FontPx; $size -ge $MinFontPx; $size--) {
    $font = [System.Drawing.Font]::new($FontFamily, [float]$size, $FontStyle, [System.Drawing.GraphicsUnit]::Pixel)
    $lines = Get-WrappedLinesForFont -Graphics $Graphics -Font $font -Text $candidate -MaxWidth $Width -MaxLines $MaxLines
    if ($null -ne $lines) {
      $probe = $Graphics.MeasureString("Ag", $font)
      $candidateLineHeight = [int][math]::Ceiling($probe.Height)
      if (($candidateLineHeight * $lines.Count) -le $Height) {
        $resolvedFont = $font
        $resolvedLines = $lines
        $resolvedFontPx = $size
        $lineHeight = $candidateLineHeight
        break
      }
    }
    $font.Dispose()
  }

  $truncated = $false
  if ($null -eq $resolvedFont -and $TruncateWithEllipsis) {
    $resolvedFontPx = $MinFontPx
    $resolvedFont = [System.Drawing.Font]::new($FontFamily, [float]$MinFontPx, $FontStyle, [System.Drawing.GraphicsUnit]::Pixel)
    $base = $candidate
    while ($base.Length -gt 4) {
      $base = $base.Substring(0, $base.Length - 1).TrimEnd()
      $trial = "$base..."
      $lines = Get-WrappedLinesForFont -Graphics $Graphics -Font $resolvedFont -Text $trial -MaxWidth $Width -MaxLines $MaxLines
      if ($null -eq $lines) { continue }
      $probe = $Graphics.MeasureString("Ag", $resolvedFont)
      $candidateLineHeight = [int][math]::Ceiling($probe.Height)
      if (($candidateLineHeight * $lines.Count) -le $Height) {
        $candidate = $trial
        $resolvedLines = $lines
        $lineHeight = $candidateLineHeight
        $truncated = $true
        break
      }
    }
  }

  if ($null -eq $resolvedFont -or $null -eq $resolvedLines) {
    if ($null -ne $resolvedFont) { $resolvedFont.Dispose() }
    throw "Text multi-line '$Text' tidak muat pada layer ${Width}x${Height} sampai minimum ${MinFontPx}px."
  }

  try {
    $alignment = Get-StringAlignment -Value $TextAlign
    $blockHeight = $lineHeight * $resolvedLines.Count
    $startY = $Y + [int][math]::Floor(($Height - $blockHeight) / 2.0)
    for ($index = 0; $index -lt $resolvedLines.Count; $index++) {
      $format = [System.Drawing.StringFormat]::new()
      try {
        $format.Alignment = $alignment
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
        $rect = [System.Drawing.RectangleF]::new($X, $startY + ($index * $lineHeight), $Width, $lineHeight)
        $Graphics.DrawString($resolvedLines[$index], $resolvedFont, [System.Drawing.Brushes]::Black, $rect, $format)
      }
      finally { $format.Dispose() }
    }
  }
  finally { $resolvedFont.Dispose() }

  return [pscustomobject]@{
    text = $candidate
    lines = @($resolvedLines)
    lineCount = $resolvedLines.Count
    fontPx = $resolvedFontPx
    x = $X
    y = $Y
    widthDots = $Width
    heightDots = $Height
    truncated = $truncated
  }
}

function New-FittedTextGraphic {
  param(
    [System.Drawing.FontFamily]$FontFamily,
    [System.Drawing.FontStyle]$FontStyle,
    [string]$Text,
    [int]$CanvasWidth,
    [int]$CanvasHeight,
    [int]$FontPx,
    [int]$MinFontPx,
    [string]$TextAlign,
    [bool]$Rotate180,
    [int]$SpreadPx,
    [bool]$TruncateWithEllipsis = $false
  )

  $bitmap = [System.Drawing.Bitmap]::new($CanvasWidth, $CanvasHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

      $measurement = Add-FittedTextLayer -Graphics $graphics -FontFamily $FontFamily -FontStyle $FontStyle -Text $Text -X 0 -Y 0 -Width $CanvasWidth -Height $CanvasHeight -FontPx $FontPx -MinFontPx $MinFontPx -TextAlign $TextAlign -TruncateWithEllipsis $TruncateWithEllipsis
      if ($Rotate180) {
        $bitmap.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone)
      }
      return [pscustomobject]@{
        Bytes = Convert-To1BppBmpBytes -Source $bitmap -SpreadPx $SpreadPx
        Width = $CanvasWidth
        Height = $CanvasHeight
        Measurement = $measurement
      }
    }
    finally { $graphics.Dispose() }
  }
  finally { $bitmap.Dispose() }
}

function New-BackGraphicV3 {
  param(
    [System.Drawing.FontFamily]$FontFamily,
    [System.Drawing.FontStyle]$FontStyle,
    [string]$WeightText,
    [string]$ItemDisplayName,
    [int]$CanvasWidth,
    [int]$CanvasHeight,
    [object]$WeightConfig,
    [object]$ItemConfig,
    [bool]$Rotate180,
    [int]$SpreadPx
  )

  $bitmap = [System.Drawing.Bitmap]::new($CanvasWidth, $CanvasHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

      $layers = @(
        [pscustomobject]@{ Name = "weight"; Text = $WeightText; Config = $WeightConfig; Truncate = $false },
        [pscustomobject]@{ Name = "itemDisplayName"; Text = $ItemDisplayName; Config = $ItemConfig; Truncate = [bool]$ItemConfig.truncateWithEllipsis }
      )
      $measurements = [ordered]@{}

      foreach ($layer in $layers) {
        $cfg = $layer.Config
        $x = Get-RequiredInt $cfg.x "back.$($layer.Name).x" 0 $CanvasWidth
        $y = Get-RequiredInt $cfg.y "back.$($layer.Name).y" 0 $CanvasHeight
        $w = Get-RequiredInt $cfg.widthDots "back.$($layer.Name).widthDots" 8 $CanvasWidth
        $h = Get-RequiredInt $cfg.heightDots "back.$($layer.Name).heightDots" 8 $CanvasHeight
        $fontPx = Get-RequiredInt $cfg.fontPx "back.$($layer.Name).fontPx" 4 200
        $minFontPx = Get-RequiredInt $cfg.minFontPx "back.$($layer.Name).minFontPx" 4 $fontPx
        if (($x + $w) -gt $CanvasWidth -or ($y + $h) -gt $CanvasHeight) {
          throw "back.$($layer.Name) keluar dari canvas back ${CanvasWidth}x${CanvasHeight}."
        }
        if ($layer.Name -eq "itemDisplayName") {
          $maxLines = Get-RequiredInt $cfg.maxLines "back.itemDisplayName.maxLines" 1 3
          $measurements[$layer.Name] = Add-FittedWrappedTextLayer -Graphics $graphics -FontFamily $FontFamily -FontStyle $FontStyle -Text $layer.Text -X $x -Y $y -Width $w -Height $h -FontPx $fontPx -MinFontPx $minFontPx -MaxLines $maxLines -TextAlign ([string]$cfg.textAlign) -TruncateWithEllipsis $layer.Truncate
        } else {
          $measurements[$layer.Name] = Add-FittedTextLayer -Graphics $graphics -FontFamily $FontFamily -FontStyle $FontStyle -Text $layer.Text -X $x -Y $y -Width $w -Height $h -FontPx $fontPx -MinFontPx $minFontPx -TextAlign ([string]$cfg.textAlign) -TruncateWithEllipsis $layer.Truncate
        }
      }

      if ($Rotate180) {
        $bitmap.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone)
      }
      return [pscustomobject]@{
        Bytes = Convert-To1BppBmpBytes -Source $bitmap -SpreadPx $SpreadPx
        Width = $CanvasWidth
        Height = $CanvasHeight
        Measurements = $measurements
      }
    }
    finally { $graphics.Dispose() }
  }
  finally { $bitmap.Dispose() }
}

function Add-Ascii {
  param([System.IO.Stream]$Stream, [string]$Text)
  $bytes = $Encoding.GetBytes($Text)
  $Stream.Write($bytes, 0, $bytes.Length)
}

function Add-BmpGraphicCommand {
  param([System.IO.Stream]$Stream, [int]$X, [int]$Y, [byte[]]$BmpBytes)
  if ($BmpBytes.Length -gt 32768) {
    throw "BMP graphic terlalu besar: $($BmpBytes.Length) bytes (maksimum 32768 bytes untuk ESC GM)."
  }
  Add-Ascii -Stream $Stream -Text ("$ESC" + "H" + $X.ToString("0000") + "$ESC" + "V" + $Y.ToString("0000"))
  Add-Ascii -Stream $Stream -Text ("$ESC" + "GM" + $BmpBytes.Length.ToString("00000") + ",")
  $Stream.Write($BmpBytes, 0, $BmpBytes.Length)
}

function Get-Code128BWidthDots {
  param([string]$Value, [int]$NarrowDots)
  $symbolCount = 1 + $Value.Length
  return (11 * ($symbolCount + 1) + 13) * $NarrowDots
}

try {
  if ($Barcode -notmatch '^[0-9A-Z .$/+%-]{1,40}$') {
    throw "Barcode '$Barcode' tidak valid untuk CODE128 Set B."
  }

  $fontFamilyRequested = [string]$config.font.family
  $fontStyleName = [string]$config.font.style
  $fontStyle = Resolve-FontStyle -Style $fontStyleName
  $fontPathEnvName = [string]$config.font.filePathEnv
  $inkSpreadPx = Get-RequiredInt -Value $config.font.inkSpreadPx -Name "font.inkSpreadPx" -Minimum 0 -Maximum 2
  $fontContext = Resolve-FontContext -RequestedFamily $fontFamilyRequested -FilePathEnvName $fontPathEnvName

  $product = $config.front.productMasterName
  $productX = Get-RequiredInt $product.x "front.productMasterName.x"
  $productY = Get-RequiredInt $product.y "front.productMasterName.y"
  $productCanvasWidth = Get-RequiredInt $product.canvasWidthDots "front.productMasterName.canvasWidthDots" 8 999
  $productCanvasHeight = Get-RequiredInt $product.canvasHeightDots "front.productMasterName.canvasHeightDots" 8 999
  $productFontPx = Get-RequiredInt $product.fontPx "front.productMasterName.fontPx" 4 200
  $productMinFontPx = Get-RequiredInt $product.minFontPx "front.productMasterName.minFontPx" 4 $productFontPx
  $productMaxChars = Get-RequiredInt $product.maxChars "front.productMasterName.maxChars" 1 220
  $productText = $MasterProductName.Trim().ToUpperInvariant()
  if ($productText.Length -gt $productMaxChars) {
    $productText = $productText.Substring(0, $productMaxChars).TrimEnd()
  }

  $barcodeConfig = $config.front.barcode
  $barcodeHeightDots = Get-RequiredInt $barcodeConfig.heightDots "front.barcode.heightDots" 1 999
  $narrowBarDots = Get-RequiredInt $barcodeConfig.narrowBarDots "front.barcode.narrowBarDots" 1 12
  $quietZoneModules = Get-RequiredInt $barcodeConfig.quietZoneModules "front.barcode.quietZoneModules" 0 100
  if ([string]$barcodeConfig.strategy -ne "CODE128_B") { throw "front.barcode.strategy wajib CODE128_B." }
  $barcodeWidth = Get-Code128BWidthDots -Value $Barcode -NarrowDots $narrowBarDots
  $quietDots = $quietZoneModules * $narrowBarDots
  if (($barcodeWidth + (2 * $quietDots)) -gt $productCanvasWidth) {
    throw "Barcode '$Barcode' terlalu lebar untuk panel front: bars=$barcodeWidth quiet=$quietDots panel=$productCanvasWidth."
  }
  $barcodeX = $productX + [int][math]::Round(($productCanvasWidth - $barcodeWidth) / 2.0)
  $barcodeY = Get-RequiredInt $barcodeConfig.y "front.barcode.y"

  $barcodeTextConfig = $config.front.barcodeText
  $barcodeTextX = Get-RequiredInt $barcodeTextConfig.x "front.barcodeText.x"
  $barcodeTextY = Get-RequiredInt $barcodeTextConfig.y "front.barcodeText.y"
  $barcodeTextCanvasWidth = Get-RequiredInt $barcodeTextConfig.canvasWidthDots "front.barcodeText.canvasWidthDots" 8 999
  $barcodeTextCanvasHeight = Get-RequiredInt $barcodeTextConfig.canvasHeightDots "front.barcodeText.canvasHeightDots" 8 999
  $barcodeTextFontPx = Get-RequiredInt $barcodeTextConfig.fontPx "front.barcodeText.fontPx" 4 200
  $barcodeTextMinFontPx = Get-RequiredInt $barcodeTextConfig.minFontPx "front.barcodeText.minFontPx" 4 $barcodeTextFontPx

  $backConfig = $config.back
  $backX = Get-RequiredInt $backConfig.x "back.x"
  $backY = Get-RequiredInt $backConfig.y "back.y"
  $backCanvasWidth = Get-RequiredInt $backConfig.canvasWidthDots "back.canvasWidthDots" 8 999
  $backCanvasHeight = Get-RequiredInt $backConfig.canvasHeightDots "back.canvasHeightDots" 8 999
  $backRotation = Get-RequiredInt $backConfig.rotation "back.rotation" 0 359
  if ($backRotation -ne 180) { throw "back.rotation wajib 180 untuk jewelry barbell yang sudah dikalibrasi." }

  $weightText = $Weight.Trim()
  $itemText = $ItemDisplayName.Trim().ToUpperInvariant()
  if ([string]::IsNullOrWhiteSpace($weightText)) { throw "Weight tidak boleh kosong." }
  if ([string]::IsNullOrWhiteSpace($itemText)) { throw "ItemDisplayName tidak boleh kosong." }

  $itemMaxChars = Get-RequiredInt $backConfig.itemDisplayName.maxChars "back.itemDisplayName.maxChars" 1 220
  if ($itemText.Length -gt $itemMaxChars) {
    $itemText = $itemText.Substring(0, $itemMaxChars).TrimEnd()
  }

  $productGraphic = New-FittedTextGraphic -FontFamily $fontContext.Family -FontStyle $fontStyle -Text $productText -CanvasWidth $productCanvasWidth -CanvasHeight $productCanvasHeight -FontPx $productFontPx -MinFontPx $productMinFontPx -TextAlign ([string]$product.textAlign) -Rotate180 $false -SpreadPx $inkSpreadPx
  $barcodeTextGraphic = New-FittedTextGraphic -FontFamily $fontContext.Family -FontStyle $fontStyle -Text $Barcode -CanvasWidth $barcodeTextCanvasWidth -CanvasHeight $barcodeTextCanvasHeight -FontPx $barcodeTextFontPx -MinFontPx $barcodeTextMinFontPx -TextAlign ([string]$barcodeTextConfig.textAlign) -Rotate180 $false -SpreadPx $inkSpreadPx
  $backGraphic = New-BackGraphicV3 -FontFamily $fontContext.Family -FontStyle $fontStyle -WeightText $weightText -ItemDisplayName $itemText -CanvasWidth $backCanvasWidth -CanvasHeight $backCanvasHeight -WeightConfig $backConfig.weight -ItemConfig $backConfig.itemDisplayName -Rotate180 $true -SpreadPx $inkSpreadPx

  $outputDir = Join-Path $HardwareHubRoot "data\temp"
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
  if ([string]::IsNullOrWhiteSpace($OutputFile)) {
    $OutputFile = Join-Path $outputDir "sato-jewelry-v3.sbpl"
  } elseif (-not [System.IO.Path]::IsPathRooted($OutputFile)) {
    $OutputFile = Join-Path (Get-Location) $OutputFile
  }

  $stream = [System.IO.MemoryStream]::new()
  try {
    Add-Ascii -Stream $stream -Text ("$ESC" + "A")
    Add-BmpGraphicCommand -Stream $stream -X $productX -Y $productY -BmpBytes $productGraphic.Bytes
    Add-Ascii -Stream $stream -Text ("$ESC" + "H" + $barcodeX.ToString("0000") + "$ESC" + "V" + $barcodeY.ToString("0000"))
    Add-Ascii -Stream $stream -Text ("$ESC" + "BG" + $narrowBarDots.ToString("00") + $barcodeHeightDots.ToString("000") + ">H" + $Barcode)
    Add-BmpGraphicCommand -Stream $stream -X $barcodeTextX -Y $barcodeTextY -BmpBytes $barcodeTextGraphic.Bytes
    Add-BmpGraphicCommand -Stream $stream -X $backX -Y $backY -BmpBytes $backGraphic.Bytes
    Add-Ascii -Stream $stream -Text ("$ESC" + "Q" + $Copies + "$ESC" + "Z")
    [System.IO.File]::WriteAllBytes($OutputFile, $stream.ToArray())
  }
  finally { $stream.Dispose() }

  $meta = [ordered]@{
    configPath = $ConfigPath
    configId = [string]$config.id
    outputFile = $OutputFile
    bytes = (Get-Item $OutputFile).Length
    fontFamilyRequested = $fontFamilyRequested
    fontFamilyUsed = $fontContext.Name
    fontStyle = $fontStyleName
    fontSource = $fontContext.Source
    fontPath = $fontContext.Path
    inkSpreadPx = $inkSpreadPx
    copies = $Copies
    renderer = "host_inter_bmp_v3"
    front = [ordered]@{
      productMasterName = $productGraphic.Measurement
      barcode = [ordered]@{
        data = $Barcode
        symbology = "CODE128"
        strategy = "Set B"
        x = $barcodeX
        y = $barcodeY
        barsWidthDots = $barcodeWidth
        quietZoneDotsPerSide = $quietDots
        heightDots = $barcodeHeightDots
        narrowBarDots = $narrowBarDots
      }
      barcodeText = $barcodeTextGraphic.Measurement
    }
    back = [ordered]@{
      canvas = "$($backGraphic.Width)x$($backGraphic.Height)"
      x = $backX
      y = $backY
      rotation = $backRotation
      weight = $backGraphic.Measurements.weight
      itemDisplayName = $backGraphic.Measurements.itemDisplayName
      bmpBytes = $backGraphic.Bytes.Length
    }
  }

  $metaPath = "$OutputFile.json"
  $meta | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metaPath -Encoding UTF8

  Write-Host "[PASS] Production SATO jewelry v3 SBPL: $OutputFile"
  Write-Host "[INFO] Config: $ConfigPath"
  Write-Host "[INFO] Font: $($fontContext.Name) $fontStyleName ($($fontContext.Source)); inkSpread=$inkSpreadPx"
  Write-Host "[INFO] Front master: '$($productGraphic.Measurement.text)' font=$($productGraphic.Measurement.fontPx)px"
  Write-Host "[INFO] Barcode: CODE128 Set B '$Barcode'; H=$barcodeX V=$barcodeY bars=${barcodeWidth} dots height=${barcodeHeightDots}"
  Write-Host "[INFO] Barcode number: '$($barcodeTextGraphic.Measurement.text)' font=$($barcodeTextGraphic.Measurement.fontPx)px"
  Write-Host "[INFO] Back weight: '$($backGraphic.Measurements.weight.text)' font=$($backGraphic.Measurements.weight.fontPx)px"
  Write-Host "[INFO] Back item: '$($backGraphic.Measurements.itemDisplayName.text)' font=$($backGraphic.Measurements.itemDisplayName.fontPx)px truncated=$($backGraphic.Measurements.itemDisplayName.truncated)"
  Write-Host "[INFO] Metadata: $metaPath"
}
finally {
  if ($null -ne $PrivateFontCollection) {
    $PrivateFontCollection.Dispose()
  }
}
