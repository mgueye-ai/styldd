Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root "logo.png"
if (-not (Test-Path $src)) { $src = Join-Path $root "assets\logo.png" }
$out32 = Join-Path $root "assets\favicon-32.png"
$out180 = Join-Path $root "assets\apple-touch-icon.png"
$img = [System.Drawing.Image]::FromFile((Resolve-Path $src))
$sizes = @(32, 180)
$outs = @($out32, $out180)
for ($i = 0; $i -lt $sizes.Length; $i++) {
  $sz = $sizes[$i]
  $path = $outs[$i]
  $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $sz, $sz)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}
$img.Dispose()
Get-Item $out32, $out180 | Select-Object Name, Length
