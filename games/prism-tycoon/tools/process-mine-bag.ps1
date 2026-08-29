Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$gen = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets'
$repo = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'

function Read-Argb($path) {
  $src = [System.Drawing.Bitmap]::FromFile($path)
  $bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, 0, 0, $src.Width, $src.Height)
  $g.Dispose(); $src.Dispose()
  return $bmp
}

function Key-And-Crop($bmp, $mode) {
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
      $b = $buf[$i]; $gc = $buf[$i+1]; $r = $buf[$i+2]; $a = $buf[$i+3]
      $mn = [Math]::Min($r, [Math]::Min($gc, $b))
      $mx = [Math]::Max($r, [Math]::Max($gc, $b))
      $kill = $false
      if ($mode -eq 'white') {
        $kill = ($a -lt 10) -or ($mn -ge 232 -and ($mx - $mn) -le 18) -or ($r -ge 245 -and $gc -ge 245 -and $b -ge 245)
      } else {
        $kill = ($a -lt 10) -or ($r -lt 18 -and $gc -lt 18 -and $b -lt 18)
      }
      if ($kill) {
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
  $og = [System.Drawing.Graphics]::FromImage($out)
  $og.Clear([System.Drawing.Color]::Transparent)
  $og.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0,0,$cw,$ch), (New-Object System.Drawing.Rectangle $x0,$y0,$cw,$ch), [System.Drawing.GraphicsUnit]::Pixel)
  $og.Dispose(); $bmp.Dispose()
  return $out
}

$mine = Key-And-Crop (Read-Argb (Join-Path $gen 'mine-wall.png')) 'white'
$mine.Save((Join-Path $repo 'mine-cave.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("mine-cave.png {0}x{1} aspect={2:N3}" -f $mine.Width, $mine.Height, ($mine.Height / $mine.Width))
$mine.Dispose()
