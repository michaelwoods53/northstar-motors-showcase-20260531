param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$KeyColor = "#00ff00",

  [int]$Tolerance = 70
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing.Common

$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$source = [System.Drawing.Bitmap]([System.Drawing.Image]::FromFile($InputPath))
$working = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$key = [System.Drawing.ColorTranslator]::FromHtml($KeyColor)

$minX = $source.Width
$minY = $source.Height
$maxX = -1
$maxY = -1

for ($y = 0; $y -lt $source.Height; $y++) {
  for ($x = 0; $x -lt $source.Width; $x++) {
    $pixel = $source.GetPixel($x, $y)
    $dr = $pixel.R - $key.R
    $dg = $pixel.G - $key.G
    $db = $pixel.B - $key.B
    $distance = [Math]::Sqrt(($dr * $dr) + ($dg * $dg) + ($db * $db))

    if ($distance -le $Tolerance) {
      $working.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
      continue
    }

    $working.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $pixel.R, $pixel.G, $pixel.B))
    if ($x -lt $minX) { $minX = $x }
    if ($y -lt $minY) { $minY = $y }
    if ($x -gt $maxX) { $maxX = $x }
    if ($y -gt $maxY) { $maxY = $y }
  }
}

if ($maxX -lt 0 -or $maxY -lt 0) {
  throw "No opaque pixels remained after chroma key removal for $InputPath"
}

$padding = 16
$minX = [Math]::Max(0, $minX - $padding)
$minY = [Math]::Max(0, $minY - $padding)
$maxX = [Math]::Min($working.Width - 1, $maxX + $padding)
$maxY = [Math]::Min($working.Height - 1, $maxY + $padding)

$cropRect = [System.Drawing.Rectangle]::new($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
$cropped = $working.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$cropped.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$cropped.Dispose()
$working.Dispose()
$source.Dispose()
