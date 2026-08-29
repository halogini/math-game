# Layout guide at game hall aspect (2160x992) and 16:9 reference for generation.
# Hall cover in game: (20,44) 1080x496. Image maps 2x: ix=(gx-20)*2, iy=(gy-44)*2.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$dst = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'
$W = 2160; $H = 992
$bmp = New-Object System.Drawing.Bitmap $W, $H, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(255, 38, 26, 20))

function MapPt([double]$gx, [double]$gy) {
  return [System.Drawing.PointF]::new([float](($gx - 20) * 2), [float](($gy - 44) * 2))
}

# Outer rock rim — even thickness on the wide 2.18:1 frame (not a square frame).
$rim = [int]($H * 0.09)
$rock = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 28, 28, 32))
$g.FillRectangle($rock, 0, 0, $W, $rim)
$g.FillRectangle($rock, 0, ($H - $rim), $W, $rim)
$g.FillRectangle($rock, 0, 0, $rim, $H)
$g.FillRectangle($rock, ($W - $rim), 0, $rim, $H)
$rock.Dispose()

# Gameplay hubs (after resize)
$bag = MapPt 235 159
$mine = MapPt 176.5 359.4
$f0 = MapPt 410 364.32
$f1 = MapPt 650 249.32
$f2 = MapPt 650 479.32
$mkt = MapPt 877 346.8

function Bezier([System.Drawing.PointF]$p0, [System.Drawing.PointF]$p1, [System.Drawing.PointF]$p2, [System.Drawing.PointF]$p3) {
  $pts = New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
  for ($i = 0; $i -le 24; $i++) {
    $t = $i / 24.0
    $u = 1.0 - $t
    $x = $u*$u*$u*$p0.X + 3*$u*$u*$t*$p1.X + 3*$u*$t*$t*$p2.X + $t*$t*$t*$p3.X
    $y = $u*$u*$u*$p0.Y + 3*$u*$u*$t*$p1.Y + 3*$u*$t*$t*$p2.Y + $t*$t*$t*$p3.Y
    $pts.Add([System.Drawing.PointF]::new([float]$x, [float]$y)) | Out-Null
  }
  return $pts.ToArray()
}

function DrawTrail([System.Drawing.Pen]$pen, [System.Drawing.PointF[]]$pts) {
  if ($pts.Length -ge 2) { $g.DrawCurve($pen, $pts, 0.4) }
}

# Natural wishbone — no square corners.
$heavy = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 138, 108, 78), 56)
$heavy.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$heavy.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$heavy.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$mid = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 118, 92, 66), 40)
$mid.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$mid.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$light = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 96, 76, 56), 28)
$light.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$light.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

DrawTrail $light (Bezier $bag (MapPt 200 230) (MapPt 168 300) $mine)
DrawTrail $heavy (Bezier $mine (MapPt 250 368) (MapPt 330 362) $f0)
DrawTrail $mid (Bezier $f0 (MapPt 500 330) (MapPt 580 255) $f1)
DrawTrail $mid (Bezier $f0 (MapPt 500 400) (MapPt 580 470) $f2)
DrawTrail $mid (Bezier $f1 (MapPt 740 252) (MapPt 820 300) $mkt)
DrawTrail $mid (Bezier $f2 (MapPt 740 476) (MapPt 820 400) $mkt)

$heavy.Dispose(); $mid.Dispose(); $light.Dispose()

# Bench-front aprons — heaviest wear in front of machines (player stands here).
$apron = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 150, 118, 86))
function Apron([System.Drawing.PointF]$p, [int]$rw, [int]$rh) {
  $g.FillEllipse($apron, $p.X - $rw, $p.Y - $rh, $rw * 2, $rh * 2)
}
Apron $f0 128 42
Apron $f1 110 36
Apron $f2 110 36
Apron $mine 70 40
Apron $mkt 70 40
$apron.Dispose()

# Keep-out boxes for sprites (no rocks / no painted buildings).
$keep = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 90, 200, 255), 2)
function KeepBox([double]$gx, [double]$gy, [double]$gw, [double]$gh) {
  $p = MapPt $gx $gy
  $g.DrawRectangle($keep, $p.X, $p.Y, [float]($gw * 2), [float]($gh * 2))
}
KeepBox 105 285 130 120   # mine
KeepBox 172 100 126 82    # bag
KeepBox 340 220 140 160   # parallel body+front
KeepBox 580 105 140 160   # adjacent
KeepBox 580 335 140 160   # right
KeepBox 825 230 160 180   # market
$keep.Dispose()

# Lantern marks — more on the long edges so they stay even in 2.18:1.
$lantern = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 190, 80))
$crystal = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 160, 90, 255))
$crystal2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 70, 210, 230))
$cyTop = [float]($rim * 0.48)
$cyBot = [float]($H - $rim * 0.48)
foreach ($frac in @(0.12, 0.28, 0.44, 0.60, 0.76, 0.90)) {
  $x = [float]($W * $frac)
  $g.FillEllipse($lantern, $x - 10, $cyTop - 10, 20, 20)
  $g.FillEllipse($lantern, $x - 10, $cyBot - 10, 20, 20)
}
foreach ($frac in @(0.20, 0.36, 0.52, 0.68, 0.84)) {
  $x = [float]($W * $frac)
  $g.FillEllipse($crystal, $x - 8, $cyTop - 8, 16, 16)
  $g.FillEllipse($crystal2, $x - 8, $cyBot - 8, 16, 16)
}
# Short sides: only two lights each (wide hall — do not pack like a square room).
foreach ($frac in @(0.32, 0.68)) {
  $y = [float]($H * $frac)
  $g.FillEllipse($lantern, ($rim * 0.48) - 10, $y - 10, 20, 20)
  $g.FillEllipse($lantern, ($W - $rim * 0.48) - 10, $y - 10, 20, 20)
}
$lantern.Dispose(); $crystal.Dispose(); $crystal2.Dispose()
$g.Dispose()

$out = Join-Path $dst 'hall-layout.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("layout {0}x{1}" -f $W, $H)

# 16:9 reference: same hall centered vertically so generation can be cropped, not stretched.
$W16 = 1920; $H16 = 1080
$cropH = [int][Math]::Round($W16 * $H / $W)  # 882
$oy = [int](($H16 - $cropH) / 2)
$bmp16 = New-Object System.Drawing.Bitmap $W16, $H16, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g16 = [System.Drawing.Graphics]::FromImage($bmp16)
$g16.Clear([System.Drawing.Color]::FromArgb(255, 12, 8, 14))
$g16.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g16.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, $oy, $W16, $cropH), 0, 0, $W, $H, [System.Drawing.GraphicsUnit]::Pixel)
$penCrop = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 255, 220, 80), 3)
$g16.DrawRectangle($penCrop, 0, $oy, $W16 - 1, $cropH - 1)
$penCrop.Dispose()
$g16.Dispose()
$out16 = Join-Path $dst 'hall-layout-16x9.png'
$bmp16.Save($out16, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("layout16 {0}x{1} cropY={2} cropH={3}" -f $W16, $H16, $oy, $cropH)
$bmp.Dispose(); $bmp16.Dispose()
