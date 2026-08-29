# Builds the 5-tier "parallel frame" factory sprites.
#
# Design rules enforced here:
#   1. One machine, parts bolted on. Every tier is placed by the frame opening it
#      shares with the others (opening centre X + opening bottom Y, measured with
#      tools/diag-anchor2.ps1), so posts, base and roller conveyor never move.
#   2. The parallel symbol is never redrawn. It is cut out of the master artwork once
#      and stamped at one fixed cell rectangle on all five tiers, so its shape and
#      position are identical by construction. Only its finish changes:
#      carved -> painted -> dim neon -> neon -> full neon.
#   3. Lv1–4 use the gear-free p3-lv*.png sources unchanged. Lv5 keeps master gears.

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$gen = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets'
$repo = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'

# --- layout, in "cell units" (multiplied by $M when rendering) ---
$CELL_W = 1024.0
$CELL_H = 660.0
$ANCHOR_X = 500.0   # cell x that each tier's opening centre maps to
$ANCHOR_Y = 450.0   # cell y that each tier's opening bottom maps to

$S_GEN = 0.6150     # generated tiers all share one design scale
$S_MASTER = 0.7570  # master art is drawn ~1.23x smaller, so it needs a larger factor

$MASTER_AX = 630.0; $MASTER_AY = 566.0

$TIERS = @(
  @{ Path = (Join-Path $gen 'p3-lv1.png'); Ax = 758; Ay = 729; S = $S_GEN },
  @{ Path = (Join-Path $gen 'p3-lv2.png'); Ax = 774; Ay = 724; S = $S_GEN },
  @{ Path = (Join-Path $gen 'p3-lv3.png'); Ax = 778; Ay = 704; S = $S_GEN },
  @{ Path = (Join-Path $gen 'p3-lv4.png'); Ax = 748; Ay = 704; S = $S_GEN },
  @{ Path = (Join-Path $repo 'factory-parallel-lv5-master.png'); Ax = $MASTER_AX; Ay = $MASTER_AY; S = $S_MASTER }
)

# master-space rectangles (tools/analyze-panel.ps1, tools/analyze-master.ps1)
$PANEL = @{ X = 296; Y = 240; W = 583; H = 323 }   # dark screen + brass rim
$SYMBOL = @{ X = 358; Y = 313; W = 470; H = 176 }  # the two neon bars + arrowheads

function Read-Argb($path) {
  $bmp = [System.Drawing.Bitmap]::FromFile($path)
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $d.Stride
  $buf = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
  $bmp.UnlockBits($d)
  $bmp.Dispose()
  return @{ Buf = $buf; Stride = $stride; W = $w; H = $h }
}

function New-BitmapFrom($img) {
  $bmp = New-Object System.Drawing.Bitmap $img.W, $img.H, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $rect = New-Object System.Drawing.Rectangle 0, 0, $img.W, $img.H
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  [System.Runtime.InteropServices.Marshal]::Copy($img.Buf, 0, $d.Scan0, $img.Buf.Length)
  $bmp.UnlockBits($d)
  return $bmp
}

# solid white background -> transparent. Cleared pixels keep white rgb so that
# downscaling produces light edges instead of dark halos.
function Set-WhiteKeyed($img) {
  $buf = $img.Buf
  for ($i = 0; $i -lt $buf.Length; $i += 4) {
    $drop = $false
    if ($buf[$i + 3] -lt 8) {
      $drop = $true
    } else {
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
      $mn = $b; if ($g -lt $mn) { $mn = $g }; if ($r -lt $mn) { $mn = $r }
      $mx = $b; if ($g -gt $mx) { $mx = $g }; if ($r -gt $mx) { $mx = $r }
      if ($mn -ge 245 -and ($mx - $mn) -le 12) { $drop = $true }
    }
    if ($drop) { $buf[$i] = 255; $buf[$i + 1] = 255; $buf[$i + 2] = 255; $buf[$i + 3] = 0 }
    else { $buf[$i + 3] = 255 }
  }
}

$frames = @()
$masterPristine = $null
foreach ($t in $TIERS) {
  $img = Read-Argb $t.Path
  Set-WhiteKeyed $img
  if ($t.Path -like '*master*') { $masterPristine = New-BitmapFrom $img }
  $img.Bmp = New-BitmapFrom $img
  $img.Ax = [double]$t.Ax; $img.Ay = [double]$t.Ay; $img.S = [double]$t.S
  $img.Name = [IO.Path]::GetFileName($t.Path)
  $frames += $img
  Write-Output ("loaded {0} ({1}x{2}) anchor=({3},{4}) scale={5:N4}" -f $img.Name, $img.W, $img.H, $img.Ax, $img.Ay, $img.S)
}
$master = $frames[4]

# --- stamps carved out of the master artwork ---
function Crop-Master($r) {
  $out = New-Object System.Drawing.Bitmap $r.W, $r.H, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::Transparent)
  $src = New-Object System.Drawing.Rectangle $r.X, $r.Y, $r.W, $r.H
  $dst = New-Object System.Drawing.Rectangle 0, 0, $r.W, $r.H
  $g.DrawImage($masterPristine, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  return $out
}

function Edit-Pixels($bmp, $fn) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $buf = New-Object byte[] ($d.Stride * $bmp.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
  & $fn $buf
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $d.Scan0, $buf.Length)
  $bmp.UnlockBits($d)
}

# whole panel, neon dimmed towards the dark screen colour
function Get-PanelStamp($glow) {
  $bmp = Crop-Master $PANEL
  Edit-Pixels $bmp {
    param($buf)
    for ($i = 0; $i -lt $buf.Length; $i += 4) {
      if ($buf[$i + 3] -lt 8) { continue }
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
      if (($g - $r) -ge 35 -and $g -ge 90) {
        $buf[$i] = [byte][Math]::Round(26 + ($b - 26) * $glow)
        $buf[$i + 1] = [byte][Math]::Round(30 + ($g - 30) * $glow)
        $buf[$i + 2] = [byte][Math]::Round(24 + ($r - 24) * $glow)
      }
    }
  }
  return $bmp
}

# only the symbol silhouette, flat-recoloured, everything else transparent
function Get-SymbolStamp($cr, $cg, $cb) {
  $bmp = Crop-Master $SYMBOL
  Edit-Pixels $bmp {
    param($buf)
    for ($i = 0; $i -lt $buf.Length; $i += 4) {
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
      $neon = ($buf[$i + 3] -ge 8 -and ($g - $r) -ge 30 -and $g -ge 110 -and $b -ge 100)
      if ($neon) { $buf[$i] = [byte]$cb; $buf[$i + 1] = [byte]$cg; $buf[$i + 2] = [byte]$cr; $buf[$i + 3] = 255 }
      else { $buf[$i] = 0; $buf[$i + 1] = 0; $buf[$i + 2] = 0; $buf[$i + 3] = 0 }
    }
  }
  return $bmp
}

# Lv1 is chiselled into bare wood and Lv2 is painted on it: both get a light/dark
# offset copy underneath so the mark reads clearly against the wood grain.
$LV1_GROOVE = Get-SymbolStamp 84 46 20
$LV1_LIP = Get-SymbolStamp 226 182 126
$LV2_PAINT = Get-SymbolStamp 246 240 218
$LV2_SHADE = Get-SymbolStamp 74 46 26

$STAMPS = @(
  @{ Kind = 'symbol'; Under = $LV1_LIP; Over = $LV1_GROOVE; Thicken = $true },
  @{ Kind = 'symbol'; Under = $LV2_SHADE; Over = $LV2_PAINT; Thicken = $false },
  @{ Kind = 'panel'; Bmp = (Get-PanelStamp 0.42) },
  @{ Kind = 'panel'; Bmp = (Get-PanelStamp 0.80) },
  @{ Kind = 'panel'; Bmp = (Get-PanelStamp 1.00) }
)

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap ([int]$w), ([int]$h), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  return @{ Bmp = $bmp; G = $g }
}

function Clear-Ghosts($bmp) {
  Edit-Pixels $bmp {
    param($buf)
    for ($i = 0; $i -lt $buf.Length; $i += 4) {
      if ($buf[$i + 3] -lt 12) { $buf[$i] = 0; $buf[$i + 1] = 0; $buf[$i + 2] = 0; $buf[$i + 3] = 0 }
    }
  }
}

# master-space rect -> cell rect, at render multiplier $M
function Get-CellRect($r, $originX, $M) {
  return New-Object System.Drawing.RectangleF `
  ([float]($originX + ($r.X - $MASTER_AX) * $S_MASTER * $M)), `
  ([float](($ANCHOR_Y + ($r.Y - $MASTER_AY) * $S_MASTER) * $M)), `
  ([float]($r.W * $S_MASTER * $M)), `
  ([float]($r.H * $S_MASTER * $M))
}

function Draw-Tier($g, $idx, $originX, $M) {
  $f = $frames[$idx]
  $s = $f.S * $M
  $dx = $originX - $f.Ax * $s
  $dy = $ANCHOR_Y * $M - $f.Ay * $s
  $g.DrawImage($f.Bmp, (New-Object System.Drawing.RectangleF ([float]$dx), ([float]$dy), ([float]($f.W * $s)), ([float]($f.H * $s))))

  $st = $STAMPS[$idx]
  if ($st.Kind -eq 'panel') {
    $g.DrawImage($st.Bmp, (Get-CellRect $PANEL $originX $M))
  } else {
    $r = Get-CellRect $SYMBOL $originX $M
    $off = [float][Math]::Max(2.0, 3.0 * $M)
    $g.DrawImage($st.Under, (New-Object System.Drawing.RectangleF ($r.X + $off), ($r.Y + $off), $r.Width, $r.Height))
    $g.DrawImage($st.Over, $r)
    if ($st.Thicken) {
      $g.DrawImage($st.Over, (New-Object System.Drawing.RectangleF ($r.X + 1), ($r.Y + 1), $r.Width, $r.Height))
    }
  }
  return @{ Dx = $dx; Dy = $dy }
}

# --- individual sprites, full resolution ---
for ($k = 0; $k -lt 5; $k++) {
  $c = New-Canvas $CELL_W $CELL_H
  $info = Draw-Tier $c.G $k ($CELL_W / 2.0) 1.0
  $c.G.Dispose()
  Clear-Ghosts $c.Bmp
  $out = Join-Path $repo ("factory-parallel-lv{0}.png" -f ($k + 1))
  $c.Bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $c.Bmp.Dispose()
  Write-Output ("lv{0}: {1}x{2} art dx={3:N1} dy={4:N1}" -f `
    ($k + 1), $CELL_W, $CELL_H, $info.Dx, $info.Dy)
}

# --- 1x5 sheet, scaled down so the texture stays under 4096px wide ---
$M = 0.75
$cw = [Math]::Floor($CELL_W * $M)
$ch = [Math]::Floor($CELL_H * $M)
$sheet = New-Canvas ($cw * 5) $ch
for ($k = 0; $k -lt 5; $k++) { Draw-Tier $sheet.G $k ($k * $cw + $cw / 2.0) $M | Out-Null }
$sheet.G.Dispose()
Clear-Ghosts $sheet.Bmp
$sheetOut = Join-Path $repo 'factory-parallel-sheet.png'
$sheet.Bmp.Save($sheetOut, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Bmp.Dispose()
Write-Output ("sheet: {0} ({1}x{2})" -f $sheetOut, ($cw * 5), $ch)

# dark-background preview so alignment and transparency are easy to eyeball
$pv = New-Canvas ($cw * 5) $ch
$pv.G.Clear([System.Drawing.Color]::FromArgb(255, 38, 38, 50))
for ($k = 0; $k -lt 5; $k++) {
  Draw-Tier $pv.G $k ($k * $cw + $cw / 2.0) $M | Out-Null
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 255, 210, 60)), 1
  $pv.G.DrawLine($pen, ($k * $cw), ($ANCHOR_Y * $M), (($k + 1) * $cw), ($ANCHOR_Y * $M))
  $pv.G.DrawLine($pen, ($k * $cw + $ANCHOR_X * $M), 0, ($k * $cw + $ANCHOR_X * $M), $ch)
}
$pv.G.Dispose()
$pvOut = Join-Path $repo 'preview-parallel-v3.png'
$pv.Bmp.Save($pvOut, [System.Drawing.Imaging.ImageFormat]::Png)
$pv.Bmp.Dispose()
Write-Output "preview: $pvOut"
