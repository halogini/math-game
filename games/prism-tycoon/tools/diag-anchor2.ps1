Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$gen = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets'

foreach ($n in 1..4) {
  $p = Join-Path $gen ("p3-lv{0}.png" -f $n)
  $bmp = [System.Drawing.Bitmap]::FromFile($p)
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $d.Stride
  $buf = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
  $bmp.UnlockBits($d)
  $bmp.Dispose()

  # 0 = interior material, 1 = thin dark line, 2 = hard boundary (bg / off-canvas)
  function Get-Kind($x, $y) {
    if ($x -lt 0 -or $x -ge $w -or $y -lt 0 -or $y -ge $h) { return 2 }
    $i = $y * $stride + $x * 4
    if ($buf[$i + 3] -lt 250) { return 2 }
    $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
    $mn = $b; if ($g -lt $mn) { $mn = $g }; if ($r -lt $mn) { $mn = $r }
    $mx = $b; if ($g -gt $mx) { $mx = $g }; if ($r -gt $mx) { $mx = $r }
    if ($mn -ge 245 -and ($mx - $mn) -le 12) { return 2 }
    if ($mx -lt 85) { return 1 }
    return 0
  }

  # coarse horizontal centre of the sprite
  $minX = $w; $maxX = -1
  for ($y = 0; $y -lt $h; $y += 4) {
    for ($x = 0; $x -lt $w; $x += 2) {
      if ((Get-Kind $x $y) -ne 2) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
      }
    }
  }
  $cx = [int](($minX + $maxX) / 2)

  # widest interior span (strict: any dark pixel ends the run) picks the opening row
  $bestSpan = 0; $bestY = -1; $bestLo = -1; $bestHi = -1
  for ($y = [int]($h * 0.30); $y -le [int]($h * 0.60); $y += 3) {
    if ((Get-Kind $cx $y) -ne 0) { continue }
    $lo = $cx; while ((Get-Kind ($lo - 1) $y) -eq 0) { $lo-- }
    $hi = $cx; while ((Get-Kind ($hi + 1) $y) -eq 0) { $hi++ }
    $span = $hi - $lo + 1
    if ($span -gt $bestSpan) { $bestSpan = $span; $bestY = $y; $bestLo = $lo; $bestHi = $hi }
  }
  $ocx = [int](($bestLo + $bestHi) / 2)

  # vertical walk: hop over dark runs up to 6px (plank grooves), stop at thicker structure
  function Walk-V($x, $y0, $step) {
    $y = $y0
    while ($true) {
      $k = Get-Kind $x ($y + $step)
      if ($k -eq 0) { $y += $step; continue }
      if ($k -eq 2) { return $y }
      $run = 0; $probe = $y + $step
      while ((Get-Kind $x $probe) -eq 1 -and $run -lt 8) { $run++; $probe += $step }
      if ($run -le 6 -and (Get-Kind $x $probe) -eq 0) { $y = $probe; continue }
      return $y
    }
  }
  $top = Walk-V $ocx $bestY -1
  $bot = Walk-V $ocx $bestY 1

  Write-Output ("p3-lv{0}: {1}x{2}  opening x:{3}..{4} (w={5}) y:{6}..{7} (h={8})  anchor=({9},{10})" -f `
    $n, $w, $h, $bestLo, $bestHi, $bestSpan, $top, $bot, ($bot - $top + 1), $ocx, $bot)
}
