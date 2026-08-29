Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$repo = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'
$p = Join-Path $repo 'factory-parallel-lv5-master.png'

$bmp = [System.Drawing.Bitmap]::FromFile($p)
$w = $bmp.Width; $h = $bmp.Height
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $d.Stride
$buf = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
$bmp.UnlockBits($d)
$bmp.Dispose()

# brass: high red+green, low-ish blue, not wood-brown (wood has similar hue but more muted)
# typical brass in this art: R 170-250, G 100-180, B 20-80
$minX = $w; $maxX = -1; $minY = $h; $maxY = -1; $n = 0
$histY = @{}
for ($y = 0; $y -lt [int]($h * 0.72); $y++) {
  $row = $y * $stride
  $rowN = 0
  for ($x = [int]($w * 0.55); $x -lt $w; $x++) {
    $i = $row + $x * 4
    if ($buf[$i + 3] -lt 250) { continue }
    $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
    # brass-ish, not wood (wood is darker, more red-dominant with low brightness)
    $isBrass = ($r -ge 150 -and $g -ge 90 -and $b -le 90 -and ($r - $b) -ge 80 -and $g -ge ($r * 0.45))
    if ($isBrass) {
      $n++; $rowN++
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  if ($rowN -gt 8) { $histY[$y] = $rowN }
}

Write-Output "master ${w}x${h}"
Write-Output "brass UR px=$n  bbox x:$minX..$maxX y:$minY..$maxY  size=$($maxX-$minX+1)x$($maxY-$minY+1)"
Write-Output "--- brass row profile ---"
$histY.GetEnumerator() | Sort-Object Name | ForEach-Object {
  if ($_.Value -ge 12) { Write-Output ("y=$($_.Name) n=$($_.Value)") }
}

# sample a few pixels around expected gear area
Write-Output "--- samples ---"
foreach ($xy in @(
  @(980,180),(1000,180),(1050,180),(1080,180),
  @(980,220),(1020,220),(1060,220),
  @(980,260),(1020,260),(1060,260)
)) {
  $x = $xy[0]; $y = $xy[1]
  if ($x -ge $w -or $y -ge $h) { continue }
  $i = $y * $stride + $x * 4
  Write-Output ("($x,$y) rgb=($($buf[$i+2]),$($buf[$i+1]),$($buf[$i])) a=$($buf[$i+3])")
}
