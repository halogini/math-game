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

function Get-Px($x, $y) {
  $i = $y * $stride + $x * 4
  return @{ B = $buf[$i]; G = $buf[$i + 1]; R = $buf[$i + 2]; A = $buf[$i + 3] }
}
function Is-Dark($x, $y) {
  $p = Get-Px $x $y
  if ($p.A -lt 8) { return $false }
  return ($p.R -le 70 -and $p.G -le 80 -and $p.B -le 85)
}

# horizontal dark run through the screen interior (y=400 sits between the two neon bars)
foreach ($sy in 400, 330, 470, 310, 490) {
  $x = 591
  if (-not (Is-Dark $x $sy)) { Write-Output "y=$sy : x=591 not dark"; continue }
  $lo = $x; while ($lo -gt 0 -and (Is-Dark ($lo - 1) $sy)) { $lo-- }
  $hi = $x; while ($hi -lt $w - 1 -and (Is-Dark ($hi + 1) $sy)) { $hi++ }
  Write-Output "dark run y=$sy : x $lo..$hi (w=$($hi - $lo + 1))"
}

# vertical dark run through the screen
foreach ($sx in 591, 420, 780, 500, 700) {
  $y = 400
  if (-not (Is-Dark $sx $y)) { Write-Output "x=$sx : y=400 not dark"; continue }
  $lo = $y; while ($lo -gt 0 -and (Is-Dark $sx ($lo - 1))) { $lo-- }
  $hi = $y; while ($hi -lt $h - 1 -and (Is-Dark $sx ($hi + 1))) { $hi++ }
  Write-Output "dark run x=$sx : y $lo..$hi (h=$($hi - $lo + 1))"
}

# sample colors along a horizontal line to see frame material transitions
Write-Output "--- color samples at y=400 ---"
foreach ($x in 300, 320, 340, 350, 360, 370, 380, 400, 591, 800, 820, 830, 840, 850, 870, 900) {
  $p = Get-Px $x 400
  Write-Output ("x=$x  rgb=({0},{1},{2}) a={3}" -f $p.R, $p.G, $p.B, $p.A)
}
Write-Output "--- color samples at x=591 ---"
foreach ($y in 250, 270, 290, 300, 310, 320, 480, 490, 500, 510, 520, 540) {
  $p = Get-Px 591 $y
  Write-Output ("y=$y  rgb=({0},{1},{2}) a={3}" -f $p.R, $p.G, $p.B, $p.A)
}
