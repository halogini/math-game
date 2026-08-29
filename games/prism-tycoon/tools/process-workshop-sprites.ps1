# Key white backgrounds, crop to opaque bounds, copy into game assets.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$gen = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets'
$repo = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'

$jobs = @(
  @{ Src = 'workshop-parallel-lv1.png';  Dst = 'factory-parallel-lv1.png' }
  @{ Src = 'workshop-parallel-lv2.png';  Dst = 'factory-parallel-lv2.png' }
  @{ Src = 'workshop-parallel-lv3.png';  Dst = 'factory-parallel-lv3.png' }
  @{ Src = 'workshop-parallel-lv4.png';  Dst = 'factory-parallel-lv4.png' }
  @{ Src = 'workshop-parallel-lv5.png';  Dst = 'factory-parallel-lv5.png' }
  @{ Src = 'workshop-adjacent-lv1.png';  Dst = 'factory-adjacent-lv1.png' }
  @{ Src = 'workshop-adjacent-lv3.png';  Dst = 'factory-adjacent-lv3.png' }
  @{ Src = 'workshop-adjacent-lv5.png';  Dst = 'factory-adjacent-lv5.png' }
  @{ Src = 'workshop-right-lv1.png';     Dst = 'factory-right-lv1.png' }
  @{ Src = 'workshop-right-lv3.png';     Dst = 'factory-right-lv3.png' }
  @{ Src = 'workshop-right-lv5.png';     Dst = 'factory-right-lv5.png' }
  @{ Src = 'workshop-market.png';        Dst = 'factory-market.png' }
)

function Read-Argb($path) {
  $src = [System.Drawing.Bitmap]::FromFile($path)
  $bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, 0, 0, $src.Width, $src.Height)
  $g.Dispose(); $src.Dispose()
  return $bmp
}

function Key-And-Crop($bmp) {
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $buf = New-Object byte[] ($d.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)

  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $d.Stride
    for ($x = 0; $x -lt $w; $x++) {
      $i = $row + $x * 4
      $b = $buf[$i]; $g = $buf[$i+1]; $r = $buf[$i+2]; $a = $buf[$i+3]
      $mn = [Math]::Min($r, [Math]::Min($g, $b))
      $mx = [Math]::Max($r, [Math]::Max($g, $b))
      $nearWhite = ($mn -ge 232 -and ($mx - $mn) -le 18) -or ($r -ge 245 -and $g -ge 245 -and $b -ge 245)
      if ($a -lt 10 -or $nearWhite) {
        $buf[$i] = 0; $buf[$i+1] = 0; $buf[$i+2] = 0; $buf[$i+3] = 0
      } else {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $d.Scan0, $buf.Length)
  $bmp.UnlockBits($d)

  if ($maxX -lt 0) { return $bmp }
  $pad = 8
  $x0 = [Math]::Max(0, $minX - $pad)
  $y0 = [Math]::Max(0, $minY - $pad)
  $x1 = [Math]::Min($w - 1, $maxX + $pad)
  $y1 = [Math]::Min($h - 1, $maxY + $pad)
  $cw = $x1 - $x0 + 1; $ch = $y1 - $y0 + 1
  $out = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0,0,$cw,$ch), (New-Object System.Drawing.Rectangle $x0,$y0,$cw,$ch), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp.Dispose()
  return $out
}

foreach ($j in $jobs) {
  $srcPath = Join-Path $gen $j.Src
  if (-not (Test-Path $srcPath)) { Write-Output "MISSING $($j.Src)"; continue }
  $bmp = Read-Argb $srcPath
  $out = Key-And-Crop $bmp
  $dstPath = Join-Path $repo $j.Dst
  $out.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output ("{0} -> {1} ({2}x{3})" -f $j.Src, $j.Dst, $out.Width, $out.Height)
  $out.Dispose()
}

# Fill missing adjacent/right even levels from nearest neighbor.
Copy-Item (Join-Path $repo 'factory-adjacent-lv1.png') (Join-Path $repo 'factory-adjacent-lv2.png') -Force
Copy-Item (Join-Path $repo 'factory-adjacent-lv3.png') (Join-Path $repo 'factory-adjacent-lv4.png') -Force
Copy-Item (Join-Path $repo 'factory-right-lv1.png') (Join-Path $repo 'factory-right-lv2.png') -Force
Copy-Item (Join-Path $repo 'factory-right-lv3.png') (Join-Path $repo 'factory-right-lv4.png') -Force
Write-Output 'copied even-level neighbors for adjacent/right'
