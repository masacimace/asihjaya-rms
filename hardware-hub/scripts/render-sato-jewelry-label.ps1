param(
  [string]$ConfigPath = "",
  [string]$ProductName = "NAMA PRODUK MASTER",
  [string]$Barcode = "AJ00000006",
  [string]$Weight = "6.05Gr",
  [string]$Purity = "16K-60%",
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

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $ConfigPath = Join-Path $HardwareHubRoot "config\sato-jewelry-barbell-host-bold.json"
} elseif (-not [System.IO.Path]::IsPathRooted($ConfigPath)) {
  $ConfigPath = Join-Path (Get-Location) $ConfigPath
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Host-bold layout config tidak ditemukan: $ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ($config.version -ne 2) {
  throw "Host-bold layout config version tidak didukung: $($config.version). Expected version 2 (split-back typography)."
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

function Resolve-InstalledFontFamily {
  param([string]$Requested)

  $installed = [System.Drawing.Text.InstalledFontCollection]::new()
  $match = $installed.Families | Where-Object { $_.Name -eq $Requested } | Select-Object -First 1
  if ($null -ne $match) {
    return $match.Name
  }

  $fallback = $installed.Families | Where-Object { $_.Name -eq "Arial" } | Select-Object -First 1
  if ($null -eq $fallback) {
    throw "Font '$Requested' tidak tersedia dan fallback Arial juga tidak ditemukan."
  }

  Write-Warning "Font '$Requested' tidak tersedia. Menggunakan fallback '$($fallback.Name)'."
  return $fallback.Name
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

function New-BoldTextGraphic {
  param(
    [string]$Family,
    [string]$Text,
    [int]$CanvasWidth,
    [int]$CanvasHeight,
    [int]$FontPx,
    [bool]$Rotate180,
    [int]$SpreadPx
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $CanvasWidth,
    $CanvasHeight,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

      $font = [System.Drawing.Font]::new(
        $Family,
        [float]$FontPx,
        [System.Drawing.FontStyle]::Bold,
        [System.Drawing.GraphicsUnit]::Pixel
      )
      try {
        $measureFormat = [System.Drawing.StringFormat]::GenericTypographic
        $measureFormat.FormatFlags = $measureFormat.FormatFlags -bor [System.Drawing.StringFormatFlags]::NoWrap
        $measured = $graphics.MeasureString($Text, $font, [int]::MaxValue, $measureFormat)
        if ([math]::Ceiling($measured.Width) -gt ($CanvasWidth - 2) -or [math]::Ceiling($measured.Height) -gt $CanvasHeight) {
          throw "Text '$Text' tidak muat: font=${FontPx}px, measured=$([math]::Ceiling($measured.Width))x$([math]::Ceiling($measured.Height)), canvas=${CanvasWidth}x${CanvasHeight}. Perbesar canvas atau kecilkan fontPx."
        }

        $format = [System.Drawing.StringFormat]::new()
        try {
          $format.Alignment = [System.Drawing.StringAlignment]::Center
          $format.LineAlignment = [System.Drawing.StringAlignment]::Center
          $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
          $rect = [System.Drawing.RectangleF]::new(0, 0, $CanvasWidth, $CanvasHeight)
          $graphics.DrawString($Text, $font, [System.Drawing.Brushes]::Black, $rect, $format)
        }
        finally {
          $format.Dispose()
        }

        if ($Rotate180) {
          $bitmap.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone)
        }

        return [pscustomobject]@{
          Bytes = Convert-To1BppBmpBytes -Source $bitmap -SpreadPx $SpreadPx
          FontPx = $FontPx
          Width = $CanvasWidth
          Height = $CanvasHeight
          MeasuredWidth = [int][math]::Ceiling($measured.Width)
          MeasuredHeight = [int][math]::Ceiling($measured.Height)
        }
      }
      finally {
        $font.Dispose()
      }
    }
    finally {
      $graphics.Dispose()
    }
  }
  finally {
    $bitmap.Dispose()
  }
}

function New-SplitBackGraphic {
  param(
    [string]$Family,
    [string]$WeightText,
    [string]$PurityText,
    [int]$CanvasWidth,
    [int]$CanvasHeight,
    [object]$WeightConfig,
    [object]$PurityConfig,
    [bool]$Rotate180,
    [int]$SpreadPx
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $CanvasWidth,
    $CanvasHeight,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )

  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

      $layers = @(
        [pscustomobject]@{ Name = "weight"; Text = $WeightText; Config = $WeightConfig },
        [pscustomobject]@{ Name = "purity"; Text = $PurityText; Config = $PurityConfig }
      )
      $measurements = [ordered]@{}

      foreach ($layer in $layers) {
        $cfg = $layer.Config
        $layerX = Get-RequiredInt $cfg.x "back.$($layer.Name).x" 0 $CanvasWidth
        $layerY = Get-RequiredInt $cfg.y "back.$($layer.Name).y" 0 $CanvasHeight
        $layerWidth = Get-RequiredInt $cfg.widthDots "back.$($layer.Name).widthDots" 4 $CanvasWidth
        $layerHeight = Get-RequiredInt $cfg.heightDots "back.$($layer.Name).heightDots" 4 $CanvasHeight
        $layerFontPx = Get-RequiredInt $cfg.fontPx "back.$($layer.Name).fontPx" 4 200
        if (($layerX + $layerWidth) -gt $CanvasWidth -or ($layerY + $layerHeight) -gt $CanvasHeight) {
          throw "back.$($layer.Name) keluar dari canvas back ${CanvasWidth}x${CanvasHeight}: x=$layerX y=$layerY width=$layerWidth height=$layerHeight."
        }
        if ([string]$cfg.textAlign -ne "center") {
          throw "back.$($layer.Name).textAlign saat ini wajib 'center'."
        }

        $font = [System.Drawing.Font]::new(
          $Family,
          [float]$layerFontPx,
          [System.Drawing.FontStyle]::Bold,
          [System.Drawing.GraphicsUnit]::Pixel
        )
        try {
          $measureFormat = [System.Drawing.StringFormat]::GenericTypographic
          $measureFormat.FormatFlags = $measureFormat.FormatFlags -bor [System.Drawing.StringFormatFlags]::NoWrap
          $measured = $graphics.MeasureString($layer.Text, $font, [int]::MaxValue, $measureFormat)
          $measuredWidth = [int][math]::Ceiling($measured.Width)
          $measuredHeight = [int][math]::Ceiling($measured.Height)
          if ($measuredWidth -gt ($layerWidth - 2) -or $measuredHeight -gt $layerHeight) {
            throw "Back $($layer.Name) '$($layer.Text)' tidak muat: font=${layerFontPx}px, measured=${measuredWidth}x${measuredHeight}, layer=${layerWidth}x${layerHeight}. Perbesar widthDots/heightDots atau kecilkan fontPx."
          }

          $format = [System.Drawing.StringFormat]::new()
          try {
            $format.Alignment = [System.Drawing.StringAlignment]::Center
            $format.LineAlignment = [System.Drawing.StringAlignment]::Center
            $format.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap
            $rect = [System.Drawing.RectangleF]::new($layerX, $layerY, $layerWidth, $layerHeight)
            $graphics.DrawString($layer.Text, $font, [System.Drawing.Brushes]::Black, $rect, $format)
          }
          finally {
            $format.Dispose()
          }

          $measurements[$layer.Name] = [ordered]@{
            text = $layer.Text
            fontPx = $layerFontPx
            x = $layerX
            y = $layerY
            widthDots = $layerWidth
            heightDots = $layerHeight
            measuredWidth = $measuredWidth
            measuredHeight = $measuredHeight
          }
        }
        finally {
          $font.Dispose()
        }
      }

      # Rotate the complete back panel once, not each text item independently.
      # This preserves the intended final left-to-right visual order after the tag is folded.
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
    finally {
      $graphics.Dispose()
    }
  }
  finally {
    $bitmap.Dispose()
  }
}

function Add-Ascii {
  param([System.IO.Stream]$Stream, [string]$Text)
  $bytes = $Encoding.GetBytes($Text)
  $Stream.Write($bytes, 0, $bytes.Length)
}

function Add-BmpGraphicCommand {
  param(
    [System.IO.Stream]$Stream,
    [int]$X,
    [int]$Y,
    [byte[]]$BmpBytes
  )

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

if ($Barcode -notmatch '^[0-9A-Z .$/+%-]{1,40}$') {
  throw "Barcode '$Barcode' tidak valid untuk prototype CODE128 Set B."
}

$fontFamilyRequested = [string]$config.font.family
$fontStyle = [string]$config.font.style
if ($fontStyle -ne "Bold") {
  throw "Production host-bold renderer hanya mendukung font.style='Bold'; aktual='$fontStyle'."
}
$inkSpreadPx = Get-RequiredInt -Value $config.font.inkSpreadPx -Name "font.inkSpreadPx" -Minimum 0 -Maximum 2
$resolvedFontFamily = Resolve-InstalledFontFamily -Requested $fontFamilyRequested

$product = $config.front.productName
$productX = Get-RequiredInt $product.x "front.productName.x"
$productY = Get-RequiredInt $product.y "front.productName.y"
$productCanvasWidth = Get-RequiredInt $product.canvasWidthDots "front.productName.canvasWidthDots" 8 999
$productCanvasHeight = Get-RequiredInt $product.canvasHeightDots "front.productName.canvasHeightDots" 8 999
$productFontPx = Get-RequiredInt $product.fontPx "front.productName.fontPx" 4 200
$productMaxChars = Get-RequiredInt $product.maxChars "front.productName.maxChars" 1 200
$productText = $ProductName.Trim().ToUpperInvariant()
if ($productText.Length -gt $productMaxChars) {
  $productText = $productText.Substring(0, $productMaxChars).TrimEnd()
}

$barcodeConfig = $config.front.barcode
$barcodeX = Get-RequiredInt $barcodeConfig.x "front.barcode.x"
$barcodeY = Get-RequiredInt $barcodeConfig.y "front.barcode.y"
$barcodeHeightDots = Get-RequiredInt $barcodeConfig.heightDots "front.barcode.heightDots" 1 999
$narrowBarDots = Get-RequiredInt $barcodeConfig.narrowBarDots "front.barcode.narrowBarDots" 1 12
$quietZoneModules = Get-RequiredInt $barcodeConfig.quietZoneModules "front.barcode.quietZoneModules" 0 100
if ([string]$barcodeConfig.strategy -ne "CODE128_B") {
  throw "front.barcode.strategy wajib CODE128_B pada Option A."
}

$barcodeTextConfig = $config.front.barcodeText
$barcodeTextX = Get-RequiredInt $barcodeTextConfig.x "front.barcodeText.x"
$barcodeTextY = Get-RequiredInt $barcodeTextConfig.y "front.barcodeText.y"
$barcodeTextCanvasWidth = Get-RequiredInt $barcodeTextConfig.canvasWidthDots "front.barcodeText.canvasWidthDots" 8 999
$barcodeTextCanvasHeight = Get-RequiredInt $barcodeTextConfig.canvasHeightDots "front.barcodeText.canvasHeightDots" 8 999
$barcodeTextFontPx = Get-RequiredInt $barcodeTextConfig.fontPx "front.barcodeText.fontPx" 4 200

$backConfig = $config.back
$backX = Get-RequiredInt $backConfig.x "back.x"
$backY = Get-RequiredInt $backConfig.y "back.y"
$backCanvasWidth = Get-RequiredInt $backConfig.canvasWidthDots "back.canvasWidthDots" 8 999
$backCanvasHeight = Get-RequiredInt $backConfig.canvasHeightDots "back.canvasHeightDots" 8 999
$backRotation = Get-RequiredInt $backConfig.rotation "back.rotation" 0 359
if ($backRotation -ne 180) {
  throw "back.rotation wajib 180 untuk jewelry barbell yang sudah dikalibrasi."
}

$weightText = $Weight.Trim()
if ([string]::IsNullOrWhiteSpace($weightText)) {
  throw "Weight tidak boleh kosong."
}
$purityValue = $Purity.Trim()
if ([string]::IsNullOrWhiteSpace($purityValue)) {
  throw "Purity tidak boleh kosong."
}
$purityPrefix = [string]$backConfig.purity.prefix
$purityText = "$purityPrefix$purityValue"

$productGraphic = New-BoldTextGraphic -Family $resolvedFontFamily -Text $productText -CanvasWidth $productCanvasWidth -CanvasHeight $productCanvasHeight -FontPx $productFontPx -Rotate180 $false -SpreadPx $inkSpreadPx
$barcodeTextGraphic = New-BoldTextGraphic -Family $resolvedFontFamily -Text $Barcode -CanvasWidth $barcodeTextCanvasWidth -CanvasHeight $barcodeTextCanvasHeight -FontPx $barcodeTextFontPx -Rotate180 $false -SpreadPx $inkSpreadPx
$backGraphic = New-SplitBackGraphic -Family $resolvedFontFamily -WeightText $weightText -PurityText $purityText -CanvasWidth $backCanvasWidth -CanvasHeight $backCanvasHeight -WeightConfig $backConfig.weight -PurityConfig $backConfig.purity -Rotate180 $true -SpreadPx $inkSpreadPx

$barcodeWidth = Get-Code128BWidthDots -Value $Barcode -NarrowDots $narrowBarDots
$quietDots = $quietZoneModules * $narrowBarDots

$outputDir = Join-Path $HardwareHubRoot "data\temp"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
if ([string]::IsNullOrWhiteSpace($OutputFile)) {
  $OutputFile = Join-Path $outputDir "sato-jewelry-production.sbpl"
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
finally {
  $stream.Dispose()
}

$meta = [ordered]@{
  configPath = $ConfigPath
  configId = [string]$config.id
  outputFile = $OutputFile
  bytes = (Get-Item $OutputFile).Length
  fontFamilyRequested = $fontFamilyRequested
  fontFamilyUsed = $resolvedFontFamily
  fontStyle = $fontStyle
  inkSpreadPx = $inkSpreadPx
  copies = $Copies
  renderer = "host_bold_bmp_v2"
  product = [ordered]@{
    text = $productText
    fontPx = $productGraphic.FontPx
    canvas = "$($productGraphic.Width)x$($productGraphic.Height)"
    measured = "$($productGraphic.MeasuredWidth)x$($productGraphic.MeasuredHeight)"
    x = $productX
    y = $productY
    bmpBytes = $productGraphic.Bytes.Length
  }
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
  barcodeText = [ordered]@{
    text = $Barcode
    fontPx = $barcodeTextGraphic.FontPx
    canvas = "$($barcodeTextGraphic.Width)x$($barcodeTextGraphic.Height)"
    measured = "$($barcodeTextGraphic.MeasuredWidth)x$($barcodeTextGraphic.MeasuredHeight)"
    x = $barcodeTextX
    y = $barcodeTextY
    bmpBytes = $barcodeTextGraphic.Bytes.Length
  }
  back = [ordered]@{
    canvas = "$($backGraphic.Width)x$($backGraphic.Height)"
    x = $backX
    y = $backY
    rotation = $backRotation
    weight = $backGraphic.Measurements.weight
    purity = $backGraphic.Measurements.purity
    bmpBytes = $backGraphic.Bytes.Length
  }
}

$metaPath = "$OutputFile.json"
$meta | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $metaPath -Encoding UTF8

Write-Host "[PASS] Production SATO jewelry SBPL: $OutputFile"
Write-Host "[INFO] Config: $ConfigPath"
Write-Host "[INFO] Font: $resolvedFontFamily Bold; inkSpread=$inkSpreadPx"
Write-Host "[INFO] Product: H=$productX V=$productY font=${productFontPx}px canvas=${productCanvasWidth}x${productCanvasHeight}"
Write-Host "[INFO] Barcode: CODE128 Set B '$Barcode'; H=$barcodeX V=$barcodeY bars=${barcodeWidth} dots height=${barcodeHeightDots}"
Write-Host "[INFO] Barcode text: H=$barcodeTextX V=$barcodeTextY font=${barcodeTextFontPx}px canvas=${barcodeTextCanvasWidth}x${barcodeTextCanvasHeight}"
Write-Host "[INFO] Back panel: H=$backX V=$backY canvas=${backCanvasWidth}x${backCanvasHeight} rotation=180"
Write-Host "[INFO] Back weight: '$weightText' font=$($backGraphic.Measurements.weight.fontPx)px layer=$($backGraphic.Measurements.weight.widthDots)x$($backGraphic.Measurements.weight.heightDots)"
Write-Host "[INFO] Back purity: '$purityText' font=$($backGraphic.Measurements.purity.fontPx)px layer=$($backGraphic.Measurements.purity.widthDots)x$($backGraphic.Measurements.purity.heightDots)"
Write-Host "[INFO] Metadata: $metaPath"
Write-Host "[INFO] Copies: $Copies"
