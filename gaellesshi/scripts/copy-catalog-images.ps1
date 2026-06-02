$root = "f:\HillWebWorkClients\Benie-s-Hair-Braiding"
$srcDir = Join-Path $root "assets"
$destDir = Join-Path $root "assets\catalog"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
# Order matches your seven style names; source filenames from Cursor workspace assets.
$map = @(
  @("c__Users_CJ_AppData_Roaming_Cursor_User_workspaceStorage_1df19726d4b2b92dc933bc59d78901de_images_image-c276853b-ee3d-42f6-b575-ce18ae167f72.png", "boho-bob-knotless.png"),
  @("c__Users_CJ_AppData_Roaming_Cursor_User_workspaceStorage_1df19726d4b2b92dc933bc59d78901de_images_image-23be9e3d-52b9-4189-a4fc-cc75a0dff54f.png", "boho-knotless-box.png"),
  @("c__Users_CJ_AppData_Roaming_Cursor_User_workspaceStorage_1df19726d4b2b92dc933bc59d78901de_images_image-5c858387-cc5a-48f3-b37c-a46563332164.png", "curly-knotless-boho-full.png"),
  @("c__Users_CJ_AppData_Roaming_Cursor_User_workspaceStorage_1df19726d4b2b92dc933bc59d78901de_images_image-8e125d81-fd45-4fab-a6bd-81c75f65e1e4.png", "goddess-knotless.png"),
  @("c__Users_CJ_AppData_Roaming_Cursor_User_workspaceStorage_1df19726d4b2b92dc933bc59d78901de_images_image-aaa0dc9c-c65b-40f5-91c1-f2d19ac2da2e.png", "passion-twists-havana.png"),
  @("c__Users_CJ_AppData_Roaming_Cursor_User_workspaceStorage_1df19726d4b2b92dc933bc59d78901de_images_image-a0669fc3-5326-4ee4-a170-1099e6b00fd4.png", "soft-locs-faux-locs.png"),
  @("c__Users_CJ_AppData_Roaming_Cursor_User_workspaceStorage_1df19726d4b2b92dc933bc59d78901de_images_image-6d3b4731-6485-4b02-8705-c81a1ad59e73.png", "straight-braid-ends.png")
)
foreach ($pair in $map) {
  $from = Join-Path $srcDir $pair[0]
  $to = Join-Path $destDir $pair[1]
  if (Test-Path $from) {
    Copy-Item -Force $from $to
    Write-Host "OK $($pair[1])"
  } else {
    Write-Host "MISSING $($pair[0])"
  }
}
