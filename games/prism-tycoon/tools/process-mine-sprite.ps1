# Key white background, crop, copy mine cave sprite, print mouth UV.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$srcPath = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets\mine-cave.png'
$dstPath = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets\mine-cave.png'

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)
$g.Dispose(); $src.Dispose()

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
    $b = $buf[$i]; $gc = $buf[$i+1]; $r = $buf[$i+2]; $a = $buf[$i+3]
    $mn = [Math]::Min($r, [Math]::Min($gc, $b))
    $mx = [Math]::Max($r, [Math]::Max($gc, $b))
    $nearWhite = ($mn -ge 232 -and ($mx - $mn) -le 18) -or ($r -ge 245 -and $gc -ge 245 -and $b -ge 245)
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

$pad = 8
$x0 = [Math]::Max(0, $minX - $pad)
$y0 = [Math]::Max(0, $minY - $pad)
$x1 = [Math]::Min($w - 1, $maxX + $pad)
$y1 = [Math]::Min($h - 1, $maxY + $pad)
$cw = $x1 - $x0 + 1; $ch = $y1 - $y0 + 1
$out = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$og = [System.Drawing.Graphics]::FromImage($out)
$og.Clear([System.Drawing.Color]::Transparent)
$og.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0,0,$cw,$ch), (New-Object System.Drawing.Rectangle $x0,$y0,$cw,$ch), [System.Drawing.GraphicsUnit]::Pixel)
$og.Dispose(); $bmp.Dispose()
$out.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("saved mine-cave.png {0}x{1} aspect={2:N3}" -f $out.Width, $out.Height, ($out.Height / $out.Width))

$w = $out.Width; $h = $out.Height
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$d = $out.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$buf = New-Object byte[] ($d.Stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
$out.UnlockBits($d)

$dMinX = $w; $dMinY = $h; $dMaxX = -1; $dMaxY = -1; $n = 0; $sx = 0.0; $sy = 0.0; $footY = 0
for ($y = 0; $y -lt $h; $y++) {
  $row = $y * $d.Stride
  $rowOpaque = 0
  for ($x = 0; $x -lt $w; $x++) {
    $i = $row + $x * 4
    $b = $buf[$i]; $gc = $buf[$i+1]; $r = $buf[$i+2]; $a = $buf[$i+3]
    if ($a -lt 40) { continue }
    $rowOpaque++
    $mx = [Math]::Max($r, [Math]::Max($gc, $b))
    if ($mx -lt 48) {
      $n++; $sx += $x; $sy += $y
      if ($x -lt $dMinX) { $dMinX = $x }
      if ($y -lt $dMinY) { $dMinY = $y }
      if ($x -gt $dMaxX) { $dMaxX = $x }
      if ($y -gt $dMaxY) { $dMaxY = $y }
    }
  }
  if ($rowOpaque -gt 8) { $footY = $y }
}
$out.Dispose()
if ($n -gt 20) {
  Write-Output ("mouth n={0} uv=({1:N3},{2:N3},{3:N3},{4:N3}) center=({5:N3},{6:N3})" -f `
    $n, ($dMinX/$w), ($dMinY/$h), (($dMaxX-$dMinX+1)/$w), (($dMaxY-$dMinY+1)/$h), ($sx/$n/$w), ($sy/$n/$h))
}
Write-Output ("foot uv y={0:N3}" -f ($footY / $h))
