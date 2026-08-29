Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$repo = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'
$master = Join-Path $repo 'factory-parallel-lv5-master.png'

$bmp = [System.Drawing.Bitmap]::FromFile($master)
$w = $bmp.Width; $h = $bmp.Height
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $d.Stride
$buf = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
$bmp.UnlockBits($d)
$bmp.Dispose()

Write-Output "master ${w}x${h}"

# neon cyan: strong blue+green, weak red
$cMinX = $w; $cMaxX = -1; $cMinY = $h; $cMaxY = -1; $cCount = 0
# dark panel interior
$pMinX = $w; $pMaxX = -1; $pMinY = $h; $pMaxY = -1; $pCount = 0

for ($y = 0; $y -lt $h; $y++) {
  $row = $y * $stride
  for ($x = 0; $x -lt $w; $x++) {
    $i = $row + $x * 4
    if ($buf[$i + 3] -lt 8) { continue }
    $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]

    if ($g -ge 140 -and $b -ge 140 -and $r -le 130 -and ($g - $r) -ge 50) {
      $cCount++
      if ($x -lt $cMinX) { $cMinX = $x }
      if ($x -gt $cMaxX) { $cMaxX = $x }
      if ($y -lt $cMinY) { $cMinY = $y }
      if ($y -gt $cMaxY) { $cMaxY = $y }
    }
    if ($r -le 55 -and $g -le 65 -and $b -le 70) {
      $pCount++
      if ($x -lt $pMinX) { $pMinX = $x }
      if ($x -gt $pMaxX) { $pMaxX = $x }
      if ($y -lt $pMinY) { $pMinY = $y }
      if ($y -gt $pMaxY) { $pMaxY = $y }
    }
  }
}

Write-Output ("neon cyan px=$cCount  bbox x:$cMinX..$cMaxX y:$cMinY..$cMaxY  size=" + ($cMaxX - $cMinX + 1) + "x" + ($cMaxY - $cMinY + 1))
Write-Output ("dark  px=$pCount  bbox x:$pMinX..$pMaxX y:$pMinY..$pMaxY  size=" + ($pMaxX - $pMinX + 1) + "x" + ($pMaxY - $pMinY + 1))

# row profile of cyan to see the two parallel bars
Write-Output "--- cyan row profile (y: count, xLo..xHi) ---"
for ($y = $cMinY; $y -le $cMaxY; $y++) {
  $row = $y * $stride
  $n = 0; $lo = -1; $hi = -1
  for ($x = 0; $x -lt $w; $x++) {
    $i = $row + $x * 4
    if ($buf[$i + 3] -lt 8) { continue }
    $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
    if ($g -ge 140 -and $b -ge 140 -and $r -le 130 -and ($g - $r) -ge 50) {
      $n++
      if ($lo -lt 0) { $lo = $x }
      $hi = $x
    }
  }
  if ($n -gt 0) { Write-Output ("y=$y n=$n x:$lo..$hi") }
}
