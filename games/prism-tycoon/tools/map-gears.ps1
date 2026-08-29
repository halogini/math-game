Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$p = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets\factory-parallel-lv5-master.png'
$bmp = [System.Drawing.Bitmap]::FromFile($p)
$w = $bmp.Width; $h = $bmp.Height
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $d.Stride
$buf = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
$bmp.UnlockBits($d)
$bmp.Dispose()

Write-Output ("master canvas: {0}x{1}" -f $w, $h)

$X0 = 640; $X1 = 1247; $Y0 = 80; $Y1 = 460; $CELL = 8

# brass = warm yellow, clearly separated from the teal body
function Test-Brass($x, $y) {
  $i = $y * $stride + $x * 4
  if ($buf[$i + 3] -lt 8) { return $false }
  $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
  return ($r -ge 120 -and ($r - $b) -ge 55 -and $r -ge $g -and $g -gt $b)
}

$minX = $X1; $maxX = -1; $minY = $Y1; $maxY = -1
for ($y = $Y0; $y -le $Y1; $y++) {
  for ($x = $X0; $x -le $X1; $x++) {
    if (Test-Brass $x $y) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
Write-Output ("brass bbox in region: x {0}..{1}  y {2}..{3}" -f $minX, $maxX, $minY, $maxY)

$hdr = '      '
for ($x = $X0; $x -le $X1; $x += ($CELL * 5)) { $hdr += ("{0,-5}" -f [Math]::Floor($x / 10)) }
Write-Output $hdr

for ($y = $Y0; $y -le $Y1; $y += $CELL) {
  $line = ("{0,5} " -f $y)
  for ($x = $X0; $x -le $X1; $x += $CELL) {
    $n = 0
    for ($dy = 0; $dy -lt $CELL; $dy += 2) {
      for ($dx = 0; $dx -lt $CELL; $dx += 2) {
        $xx = $x + $dx; $yy = $y + $dy
        if ($xx -le $X1 -and $yy -le $Y1) { if (Test-Brass $xx $yy) { $n++ } }
      }
    }
    if ($n -ge 12) { $line += '#' } elseif ($n -ge 6) { $line += '+' } elseif ($n -ge 1) { $line += '.' } else { $line += ' ' }
  }
  Write-Output $line
}
