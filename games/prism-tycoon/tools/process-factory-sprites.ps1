# Key white backgrounds, crop to opaque bounds, copy factory sprites into game assets.
# Also print window / workbench / lantern UVs for placement.
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

function Measure-Sprite($path) {
  $bmp = Read-Argb $path
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $buf = New-Object byte[] ($d.Stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
  $bmp.UnlockBits($d)
  $bmp.Dispose()

  $winMinX = $w; $winMinY = $h; $winMaxX = -1; $winMaxY = -1; $winN = 0
  $lx = 0.0; $ly = 0.0; $ln = 0
  $opMinX = $w; $opMinY = $h; $opMaxX = -1; $opMaxY = -1

  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $d.Stride
    for ($x = 0; $x -lt $w; $x++) {
      $i = $row + $x * 4
      $b = $buf[$i]; $g = $buf[$i+1]; $r = $buf[$i+2]; $a = $buf[$i+3]
      if ($a -lt 24) { continue }
      if ($x -lt $opMinX) { $opMinX = $x }
      if ($y -lt $opMinY) { $opMinY = $y }
      if ($x -gt $opMaxX) { $opMaxX = $x }
      if ($y -gt $opMaxY) { $opMaxY = $y }

      $lum = (0.2126 * $r + 0.7152 * $g + 0.0722 * $b)
      if ($lum -le 42 -and $r -le 55 -and $g -le 60 -and $b -le 70) {
        if ($x -lt $winMinX) { $winMinX = $x }
        if ($y -lt $winMinY) { $winMinY = $y }
        if ($x -gt $winMaxX) { $winMaxX = $x }
        if ($y -gt $winMaxY) { $winMaxY = $y }
        $winN++
      }

      if ($r -ge 170 -and $g -ge 90 -and $g -le 210 -and $b -le 90 -and ($r - $b) -ge 80) {
        $lx += $x; $ly += $y; $ln++
      }
    }
  }

  $benchY = -1
  if ($winMaxY -ge 0) {
    $bestW = 0
    $bestY = $winMaxY
    $y0 = [Math]::Min($h - 1, $winMaxY + 2)
    $y1 = [Math]::Min($h - 1, $winMaxY + [Math]::Floor($h * 0.22))
    for ($y = $y0; $y -le $y1; $y++) {
      $row = $y * $d.Stride
      $lo = -1; $hi = -1
      for ($x = 0; $x -lt $w; $x++) {
        $i = $row + $x * 4
        if ($buf[$i+3] -lt 24) { continue }
        if ($lo -lt 0) { $lo = $x }
        $hi = $x
      }
      if ($lo -ge 0) {
        $bw = $hi - $lo + 1
        if ($bw -ge $bestW) { $bestW = $bw; $bestY = $y }
      }
    }
    $benchY = $bestY
  }

  $win = $null
  if ($winN -gt 80) {
    $win = @{
      x = [Math]::Round($winMinX / $w, 4)
      y = [Math]::Round($winMinY / $h, 4)
      w = [Math]::Round(($winMaxX - $winMinX + 1) / $w, 4)
      h = [Math]::Round(($winMaxY - $winMinY + 1) / $h, 4)
    }
  }
  $lantern = $null
  if ($ln -gt 40) {
    $lantern = @{
      x = [Math]::Round(($lx / $ln) / $w, 4)
      y = [Math]::Round(($ly / $ln) / $h, 4)
      n = $ln
    }
  }
  $bench = $null
  if ($benchY -ge 0) {
    $bench = [Math]::Round($benchY / $h, 4)
  }
  $foot = [Math]::Round(($opMaxY + 1) / $h, 4)

  return @{
    w = $w; h = $h; winN = $winN
    win = $win; lantern = $lantern; bench = $bench; foot = $foot
  }
}

$ids = @('parallel','adjacent','right')
foreach ($id in $ids) {
  for ($lv = 1; $lv -le 5; $lv++) {
    $name = "factory-$id-lv$lv.png"
    $pickPath = Join-Path $gen "factory-$id-lv$lv-pick.png"
    $stylePath = Join-Path $gen "factory-$id-lv$lv-style.png"
    $srcPath = if (Test-Path $pickPath) { $pickPath } elseif (Test-Path $stylePath) { $stylePath } else { Join-Path $gen $name }
    if (-not (Test-Path $srcPath)) { Write-Output "MISSING $name"; continue }
    Write-Output ("SRC {0} <- {1}" -f $name, (Split-Path $srcPath -Leaf))
    $bmp = Read-Argb $srcPath
    $out = Key-And-Crop $bmp
    $dstPath = Join-Path $repo $name
    $out.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output ("SAVED {0} ({1}x{2})" -f $name, $out.Width, $out.Height)
    $out.Dispose()
  }
}

Write-Output '--- UV ---'
$sumWx=0; $sumWy=0; $sumWw=0; $sumWh=0; $nW=0
$sumBx=0; $nB=0
$sumLx=0; $sumLy=0; $nL=0
$sumFoot=0; $nF=0
foreach ($id in $ids) {
  for ($lv = 1; $lv -le 5; $lv++) {
    $name = "factory-$id-lv$lv.png"
    $dstPath = Join-Path $repo $name
    $m = Measure-Sprite $dstPath
    $winS = if ($m.win) { "win=$($m.win.x),$($m.win.y),$($m.win.w)x$($m.win.h) n=$($m.winN)" } else { "win=NONE n=$($m.winN)" }
    $lanS = if ($m.lantern) { "lan=$($m.lantern.x),$($m.lantern.y) n=$($m.lantern.n)" } else { "lan=NONE" }
    Write-Output ("{0,-28} {1}x{2}  {3}  bench={4}  foot={5}  {6}" -f $name, $m.w, $m.h, $winS, $m.bench, $m.foot, $lanS)
    if ($m.win) {
      $sumWx += $m.win.x; $sumWy += $m.win.y; $sumWw += $m.win.w; $sumWh += $m.win.h; $nW++
    }
    if ($m.bench) { $sumBx += $m.bench; $nB++ }
    if ($m.lantern) { $sumLx += $m.lantern.x; $sumLy += $m.lantern.y; $nL++ }
    if ($m.foot) { $sumFoot += $m.foot; $nF++ }
  }
}

Write-Output '--- AVERAGES ---'
if ($nW -gt 0) {
  Write-Output ("WINDOW  x={0:N4} y={1:N4} w={2:N4} h={3:N4}  (n={4})" -f ($sumWx/$nW), ($sumWy/$nW), ($sumWw/$nW), ($sumWh/$nW), $nW)
}
if ($nB -gt 0) { Write-Output ("BENCH   y={0:N4}  (n={1})" -f ($sumBx/$nB), $nB) }
if ($nF -gt 0) { Write-Output ("FOOT    y={0:N4}  (n={1})" -f ($sumFoot/$nF), $nF) }
if ($nL -gt 0) { Write-Output ("LANTERN x={0:N4} y={1:N4}  (n={2})" -f ($sumLx/$nL), ($sumLy/$nL), $nL) }

Write-Output '--- LV4/5 ONLY ---'
$sumWx=0; $sumWy=0; $sumWw=0; $sumWh=0; $nW=0
$sumBx=0; $nB=0
$sumLx=0; $sumLy=0; $nL=0
foreach ($id in $ids) {
  foreach ($lv in 4,5) {
    $m = Measure-Sprite (Join-Path $repo "factory-$id-lv$lv.png")
    if ($m.win) {
      $sumWx += $m.win.x; $sumWy += $m.win.y; $sumWw += $m.win.w; $sumWh += $m.win.h; $nW++
    }
    if ($m.bench) { $sumBx += $m.bench; $nB++ }
    if ($m.lantern) { $sumLx += $m.lantern.x; $sumLy += $m.lantern.y; $nL++ }
  }
}
if ($nW -gt 0) {
  Write-Output ("WINDOW  x={0:N4} y={1:N4} w={2:N4} h={3:N4}" -f ($sumWx/$nW), ($sumWy/$nW), ($sumWw/$nW), ($sumWh/$nW))
}
if ($nB -gt 0) { Write-Output ("BENCH   y={0:N4}" -f ($sumBx/$nB)) }
if ($nL -gt 0) { Write-Output ("LANTERN x={0:N4} y={1:N4}" -f ($sumLx/$nL), ($sumLy/$nL)) }
