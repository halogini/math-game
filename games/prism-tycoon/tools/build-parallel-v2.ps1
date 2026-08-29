# Builds the 5-tier "parallel frame" factory sprites.
#
# Every tier is drawn from the same skeleton, so the upgrade reads as parts being
# bolted onto one machine instead of five different machines.
#
# Two things are pinned down here:
#   1. Alignment. Each tier is placed by the frame opening it shares with the others
#      (opening centre X + opening bottom Y, measured with tools/diag-anchor.ps1).
#      That keeps the posts, the base and the roller conveyor in the same spot.
#   2. The parallel symbol. It is not redrawn per tier - it is cut out of the master
#      artwork once and stamped at a single fixed cell rectangle for all five tiers,
#      so its shape and position are identical by construction. Only its colour and
#      glow change (carved -> painted -> dim neon -> neon -> full neon).

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$gen = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets'
$repo = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'

$CELL_W = 800
$CELL_H = 560
$ANCHOR_X = 400.0   # cell x that the opening centre maps to
$ANCHOR_Y = 380.0   # cell y that the opening bottom maps to

$S_GEN = 0.4817     # scale for the freshly generated tiers (all share one design scale)
$S_MASTER = 0.5929  # master art is drawn ~1.23x smaller, so it needs a larger factor

# per tier: source art + measured opening anchor in that art's own pixels
$TIERS = @(
  @{ Path = (Join-Path $gen 'p2-lv1.png'); Ax = 772; Ay = 674; S = $S_GEN },
  @{ Path = (Join-Path $gen 'p2-lv2.png'); Ax = 774; Ay = 692; S = $S_GEN },
  @{ Path = (Join-Path $gen 'p2-lv3.png'); Ax = 772; Ay = 694; S = $S_GEN },
  @{ Path = (Join-Path $gen 'p2-lv4.png'); Ax = 773; Ay = 687; S = $S_GEN },
  @{ Path = (Join-Path $repo 'factory-parallel-lv5-master.png'); Ax = 630; Ay = 566; S = $S_MASTER }
)

# master-space rectangles (tools/analyze-panel.ps1, tools/analyze-master.ps1)
$PANEL = @{ X = 296; Y = 240; W = 583; H = 323 }   # dark screen + brass rim
$SYMBOL = @{ X = 358; Y = 313; W = 470; H = 176 }  # the two neon bars + arrowheads
$MASTER_AX = 630; $MASTER_AY = 566                  # master's own opening anchor
$STAMP_NUDGE_X = 0.0
$STAMP_NUDGE_Y = 2.0

$DEBUG_PREVIEW = $true

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

# solid white background -> transparent; transparent pixels keep white rgb so that
# bilinear downscaling produces light edges instead of dark halos
function Set-WhiteKeyed($img) {
  $buf = $img.Buf; $stride = $img.Stride; $w = $img.W; $h = $img.H
  $minX = $w; $maxX = -1; $minY = $h; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $w; $x++) {
      $i = $row + $x * 4
      $keep = $true
      if ($buf[$i + 3] -lt 8) {
        $keep = $false
      } else {
        $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
        $mn = $b; if ($g -lt $mn) { $mn = $g }; if ($r -lt $mn) { $mn = $r }
        $mx = $b; if ($g -gt $mx) { $mx = $g }; if ($r -gt $mx) { $mx = $r }
        if ($mn -ge 245 -and ($mx - $mn) -le 12) { $keep = $false }
      }
      if ($keep) {
        $buf[$i + 3] = 255
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      } else {
        $buf[$i] = 255; $buf[$i + 1] = 255; $buf[$i + 2] = 255; $buf[$i + 3] = 0
      }
    }
  }
  $img.MinX = $minX; $img.MaxX = $maxX; $img.MinY = $minY; $img.MaxY = $maxY
}

$frames = @()
foreach ($t in $TIERS) {
  $img = Read-Argb $t.Path
  Set-WhiteKeyed $img
  $img.Bmp = New-BitmapFrom $img
  $img.Ax = $t.Ax; $img.Ay = $t.Ay; $img.S = $t.S
  $img.Name = [IO.Path]::GetFileName($t.Path)
  $frames += $img
  Write-Output ("loaded {0} ({1}x{2}) bbox x:{3}..{4} y:{5}..{6} anchor=({7},{8}) scale={9:N4}" -f `
    $img.Name, $img.W, $img.H, $img.MinX, $img.MaxX, $img.MinY, $img.MaxY, $img.Ax, $img.Ay, $img.S)
}
$master = $frames[4]

# --- stamps carved out of the master artwork ---
function Crop-Master($r) {
  $out = New-Object System.Drawing.Bitmap $r.W, $r.H, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::Transparent)
  $src = New-Object System.Drawing.Rectangle $r.X, $r.Y, $r.W, $r.H
  $dst = New-Object System.Drawing.Rectangle 0, 0, $r.W, $r.H
  $g.DrawImage($master.Bmp, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
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

# panel with the neon faded towards the dark screen colour
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

# just the symbol silhouette, recoloured, everything else transparent
function Get-SymbolStamp($cr, $cg, $cb) {
  $bmp = Crop-Master $SYMBOL
  Edit-Pixels $bmp {
    param($buf)
    for ($i = 0; $i -lt $buf.Length; $i += 4) {
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]
      $neon = ($buf[$i + 3] -ge 8 -and ($g - $r) -ge 30 -and $g -ge 110 -and $b -ge 100)
      if ($neon) {
        $buf[$i] = [byte]$cb; $buf[$i + 1] = [byte]$cg; $buf[$i + 2] = [byte]$cr; $buf[$i + 3] = 255
      } else {
        $buf[$i] = 0; $buf[$i + 1] = 0; $buf[$i + 2] = 0; $buf[$i + 3] = 0
      }
    }
  }
  return $bmp
}

$STAMPS = @(
  @{ Bmp = (Get-SymbolStamp 96 58 30); Rect = $SYMBOL },   # Lv1 carved groove
  @{ Bmp = (Get-SymbolStamp 242 234 210); Rect = $SYMBOL }, # Lv2 painted marking
  @{ Bmp = (Get-PanelStamp 0.40); Rect = $PANEL },          # Lv3 weak glow
  @{ Bmp = (Get-PanelStamp 0.78); Rect = $PANEL },          # Lv4 neon
  @{ Bmp = (Get-PanelStamp 1.00); Rect = $PANEL }           # Lv5 full neon
)

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  return @{ Bmp = $bmp; G = $g }
}

# the stamp rectangle is identical for every tier: derived once from the master
$stampW = $PANEL.W * $S_MASTER
$stampH = $PANEL.H * $S_MASTER
$stampX = $ANCHOR_X + ($PANEL.X - $MASTER_AX) * $S_MASTER + $STAMP_NUDGE_X
$stampY = $ANCHOR_Y + ($PANEL.Y - $MASTER_AY) * $S_MASTER + $STAMP_NUDGE_Y
Write-Output ("stamp rect (cell): x={0:N1} y={1:N1} {2:N1}x{3:N1}" -f $stampX, $stampY, $stampW, $stampH)

function Draw-Tier($g, $idx, $originX) {
  $f = $frames[$idx]
  $s = $f.S
  $dx = $originX - $f.Ax * $s
  $dy = $ANCHOR_Y - $f.Ay * $s
  $g.DrawImage($f.Bmp, (New-Object System.Drawing.RectangleF $dx, $dy, ($f.W * $s), ($f.H * $s)))

  $st = $STAMPS[$idx]
  $r = $st.Rect
  # symbol stamps sit inside the panel, so offset them by their own master position
  $sx = $originX + ($r.X - $MASTER_AX) * $S_MASTER + $STAMP_NUDGE_X
  $sy = $ANCHOR_Y + ($r.Y - $MASTER_AY) * $S_MASTER + $STAMP_NUDGE_Y
  $g.DrawImage($st.Bmp, (New-Object System.Drawing.RectangleF $sx, $sy, ($r.W * $S_MASTER), ($r.H * $S_MASTER)))
  return @{ Dx = $dx; Dy = $dy; Sx = $sx; Sy = $sy; Sw = ($r.W * $S_MASTER); Sh = ($r.H * $S_MASTER) }
}

function Clear-Ghosts($bmp) {
  Edit-Pixels $bmp {
    param($buf)
    for ($i = 0; $i -lt $buf.Length; $i += 4) {
      if ($buf[$i + 3] -lt 12) { $buf[$i] = 0; $buf[$i + 1] = 0; $buf[$i + 2] = 0; $buf[$i + 3] = 0 }
    }
  }
}

for ($k = 0; $k -lt 5; $k++) {
  $c = New-Canvas $CELL_W $CELL_H
  $info = Draw-Tier $c.G $k ($CELL_W / 2.0)
  $c.G.Dispose()
  Clear-Ghosts $c.Bmp
  $out = Join-Path $repo ("factory-parallel-lv{0}.png" -f ($k + 1))
  $c.Bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $c.Bmp.Dispose()
  Write-Output ("lv{0}: art dx={1:N1} dy={2:N1}   stamp x={3:N1} y={4:N1} {5:N0}x{6:N0}" -f `
    ($k + 1), $info.Dx, $info.Dy, $info.Sx, $info.Sy, $info.Sw, $info.Sh)
}

$sheet = New-Canvas ($CELL_W * 5) $CELL_H
for ($k = 0; $k -lt 5; $k++) { Draw-Tier $sheet.G $k ($k * $CELL_W + $CELL_W / 2.0) | Out-Null }
$sheet.G.Dispose()
Clear-Ghosts $sheet.Bmp
$sheetOut = Join-Path $repo 'factory-parallel-sheet.png'
$sheet.Bmp.Save($sheetOut, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Bmp.Dispose()
Write-Output ("sheet: {0} ({1}x{2})" -f $sheetOut, ($CELL_W * 5), $CELL_H)

if ($DEBUG_PREVIEW) {
  $pv = New-Canvas ($CELL_W * 5) $CELL_H
  $pv.G.Clear([System.Drawing.Color]::FromArgb(255, 38, 38, 50))
  for ($k = 0; $k -lt 5; $k++) {
    Draw-Tier $pv.G $k ($k * $CELL_W + $CELL_W / 2.0) | Out-Null
    $penY = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 255, 210, 60)), 1
    $pv.G.DrawLine($penY, ($k * $CELL_W), $ANCHOR_Y, (($k + 1) * $CELL_W), $ANCHOR_Y)
    $pv.G.DrawLine($penY, ($k * $CELL_W + $ANCHOR_X), 0, ($k * $CELL_W + $ANCHOR_X), $CELL_H)
    $penR = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(190, 255, 70, 70)), 2
    $pv.G.DrawRectangle($penR, [int]($k * $CELL_W + $stampX), [int]$stampY, [int]$stampW, [int]$stampH)
    $penC = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 120, 200, 255)), 1
    $pv.G.DrawRectangle($penC, ($k * $CELL_W), 0, $CELL_W - 1, $CELL_H - 1)
  }
  $pv.G.Dispose()
  $pvOut = Join-Path $repo 'preview-parallel-v2.png'
  $pv.Bmp.Save($pvOut, [System.Drawing.Imaging.ImageFormat]::Png)
  $pv.Bmp.Dispose()
  Write-Output "preview: $pvOut"
}
