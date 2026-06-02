# Copies image files into assets/catalog/ with the filenames expected by the style pages.
# Edit $map below: source path → destination filename under assets/catalog/.
$root = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $root "assets"
$destDir = Join-Path $root "assets\catalog"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$map = @(
  # @( "your-source-photo.png", "boho-bob-knotless.png" ),
)

foreach ($pair in $map) {
  $from = Join-Path $srcDir $pair[0]
  $to = Join-Path $destDir $pair[1]
  if (Test-Path $from) {
    Copy-Item -Force $from $to
    Write-Host "OK $($pair[1])"
  } else {
    Write-Warning "Missing source: $from"
  }
}
