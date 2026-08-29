Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$gen = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets'
$repo = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'

$paths = @(
  (Join-Path $gen 'p3-lv1.png'),
  (Join-Path $gen 'p3-lv2.png'),
  (Join-Path $gen 'p3-lv3.png'),
  (Join-Path $gen 'p3-lv4.png')
)

foreach ($p in $paths) {
  $bmp = [System.Drawing.Bitmap]::FromFile($p)
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $d.Stride
  $buf = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
  $bmp.UnlockBits($d)
  $bmp.Dispose()

  function Test-Boundary($x, $y) {
    if ($x -lt 0 -or $x -ge $w -or $y -lt 0 -or $y -ge $h) { return $true }
    $i = $y * $stride + $x * 4
    if ($buf[$i + 3] -lt 250) { return $true }
    $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
    $mn = $b; if ($g -lt $mn) { $mn = $g }; if ($r -lt $mn) { $mn = $r }
    $mx = $b; if ($g -gt $mx) { $mx = $g }; if ($r -gt $mx) { $mx = $r }
    if ($mn -ge 245 -and ($mx - $mn) -le 12) { return $true }
    return ($mx -lt 85)
  }

  # sprite bbox
  $minX = $w; $maxX = -1; $minY = $h; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $w; $x++) {
      $i = $row + $x * 4
      if ($buf[$i + 3] -lt 8) { continue }
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
      $mn = $b; if ($g -lt $mn) { $mn = $g }; if ($r -lt $mn) { $mn = $r }
      $mx = $b; if ($g -gt $mx) { $mx = $g }; if ($r -gt $mx) { $mx = $r }
      if ($mn -ge 245 -and ($mx - $mn) -le 12) { continue }
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  $cx = [int](($minX + $maxX) / 2)

  # widest interior span across candidate rows = the frame opening
  $bestSpan = 0; $bestY = -1; $bestLo = -1; $bestHi = -1
  for ($y = [int]($h * 0.30); $y -le [int]($h * 0.60); $y += 3) {
    if (Test-Boundary $cx $y) { continue }
    $lo = $cx; while (-not (Test-Boundary ($lo - 1) $y)) { $lo-- }
    $hi = $cx; while (-not (Test-Boundary ($hi + 1) $y)) { $hi++ }
    $span = $hi - $lo + 1
    if ($span -gt $bestSpan) { $bestSpan = $span; $bestY = $y; $bestLo = $lo; $bestHi = $hi }
  }

  $ocx = [int](($bestLo + $bestHi) / 2)
  $top = $bestY; while (-not (Test-Boundary $ocx ($top - 1))) { $top-- }
  $bot = $bestY; while (-not (Test-Boundary $ocx ($bot + 1))) { $bot++ }

  Write-Output ("{0}: canvas {1}x{2} bbox x:{3}..{4} y:{5}..{6}" -f [IO.Path]::GetFileName($p), $w, $h, $minX, $maxX, $minY, $maxY)
  Write-Output ("    opening x:{0}..{1} (w={2}) y:{3}..{4} (h={5})  anchor=({6},{7})" -f `
    $bestLo, $bestHi, $bestSpan, $top, $bot, ($bot - $top + 1), $ocx, $bot)
}
