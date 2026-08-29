# Key white backgrounds, crop, copy bill + stall sprites into game assets.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$gen = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets'
$repo = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'

$jobs = @(
  @{ Src = 'bill-icon.png';     Dst = 'bill.png' }
  @{ Src = 'bill-wanted.png';   Dst = 'bill-wanted.png' }
  @{ Src = 'stall-hopper.png';  Dst = 'stall-register.png' }
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

function Find-Hopper($path) {
  $bmp = Read-Argb $path
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $buf = New-Object byte[] ($d.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
  $sx = 0.0; $sy = 0.0; $n = 0
  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $d.Stride
    for ($x = 0; $x -lt $w; $x++) {
      $i = $row + $x * 4
      $b = $buf[$i]; $gc = $buf[$i+1]; $r = $buf[$i+2]; $a = $buf[$i+3]
      $mx = [Math]::Max($r, [Math]::Max($gc, $b))
      if ($a -gt 80 -and $mx -lt 28) {
        $sx += $x; $sy += $y; $n++
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $bmp.UnlockBits($d)
  $bmp.Dispose()
  if ($n -lt 20) { Write-Output 'hopper: none'; return }
  $cx = $sx / $n; $cy = $sy / $n
  Write-Output ('hopper n={0} bbox=({1},{2})-({3},{4}) center=({5:N1},{6:N1}) uv=({7:N3},{8:N3}) size={9}x{10}' -f `
    $n, $minX, $minY, $maxX, $maxY, $cx, $cy, ($cx / $w), ($cy / $h), $w, $h)
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

Find-Hopper (Join-Path $repo 'stall-register.png')
