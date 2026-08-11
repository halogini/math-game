# Slices the generated art sheets into game-ready sprites and composes the world background.
# Sources live in assets/src, outputs are written to assets/.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "assets\src"
$out = Join-Path $root "assets"

Add-Type @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

// The image generator bakes its "transparent" checkerboard into RGB, so the flat light
// background has to be flood filled away from the borders before slicing.
public static class Keyer {
  static bool IsBg(byte[] p, int i) {
    int b = p[i], g = p[i + 1], r = p[i + 2];
    int max = Math.Max(r, Math.Max(g, b));
    int min = Math.Min(r, Math.Min(g, b));
    return min >= 205 && (max - min) <= 14;
  }

  public static void Key(string inPath, string outPath) { Key(inPath, outPath, false); }

  // globalClear also removes background trapped inside the artwork, such as the gap under a
  // desk. Only safe for assets with no light neutral areas of their own.
  public static void Key(string inPath, string outPath, bool globalClear) {
    using (Bitmap src = new Bitmap(inPath))
    using (Bitmap bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb)) {
      using (Graphics g = Graphics.FromImage(bmp)) {
        g.Clear(Color.Transparent);
        g.DrawImage(src, 0, 0, src.Width, src.Height);
      }
      int w = bmp.Width, h = bmp.Height;
      BitmapData d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int stride = d.Stride;
      byte[] buf = new byte[stride * h];
      Marshal.Copy(d.Scan0, buf, 0, buf.Length);

      bool[] clear = new bool[w * h];
      Stack<int> stack = new Stack<int>();
      for (int x = 0; x < w; x++) { stack.Push(x); stack.Push((h - 1) * w + x); }
      for (int y = 0; y < h; y++) { stack.Push(y * w); stack.Push(y * w + w - 1); }
      while (stack.Count > 0) {
        int idx = stack.Pop();
        if (clear[idx]) continue;
        int x = idx % w, y = idx / w;
        if (!IsBg(buf, y * stride + x * 4)) continue;
        clear[idx] = true;
        if (x > 0) stack.Push(idx - 1);
        if (x < w - 1) stack.Push(idx + 1);
        if (y > 0) stack.Push(idx - w);
        if (y < h - 1) stack.Push(idx + w);
      }

      // Pockets enclosed by the artwork (under a desk, inside a frame) are unreachable from the
      // border, so also clear anything that exactly matches one of the two checkerboard tones.
      int[] tone = new int[2];
      tone[0] = buf[2] << 16 | buf[1] << 8 | buf[0];
      tone[1] = tone[0];
      for (int y = 0; y < 64 && tone[1] == tone[0]; y++)
        for (int x = 0; x < 64; x++) {
          int i = y * stride + x * 4;
          int c = buf[i + 2] << 16 | buf[i + 1] << 8 | buf[i];
          if (c != tone[0] && IsBg(buf, i)) { tone[1] = c; break; }
        }
      for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++) {
          int idx = y * w + x;
          if (clear[idx]) continue;
          int i = y * stride + x * 4;
          if (globalClear && IsBg(buf, i)) { clear[idx] = true; continue; }
          for (int k = 0; k < 2; k++) {
            int dr = Math.Abs(buf[i + 2] - ((tone[k] >> 16) & 255));
            int dg = Math.Abs(buf[i + 1] - ((tone[k] >> 8) & 255));
            int db = Math.Abs(buf[i] - (tone[k] & 255));
            if (dr <= 6 && dg <= 6 && db <= 6) { clear[idx] = true; break; }
          }
        }

      // Two feather passes drop the light anti-aliased fringe left along the cut edge.
      for (int pass = 0; pass < 2; pass++) {
        List<int> fade = new List<int>();
        for (int y = 0; y < h; y++) {
          for (int x = 0; x < w; x++) {
            int idx = y * w + x;
            if (clear[idx]) continue;
            bool edge = (x > 0 && clear[idx - 1]) || (x < w - 1 && clear[idx + 1])
              || (y > 0 && clear[idx - w]) || (y < h - 1 && clear[idx + w]);
            if (!edge) continue;
            int i = y * stride + x * 4;
            int luma = (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
            if (luma > 200) fade.Add(idx);
          }
        }
        foreach (int idx in fade) clear[idx] = true;
      }

      for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++)
          if (clear[y * w + x]) {
            int i = y * stride + x * 4;
            buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;
          } else {
            buf[y * stride + x * 4 + 3] = 255;
          }

      Marshal.Copy(buf, 0, d.Scan0, buf.Length);
      bmp.UnlockBits(d);
      bmp.Save(outPath, ImageFormat.Png);
    }
  }
}

public static class PixScan {
  public static byte[] Read(string path, out int w, out int h) {
    using (Bitmap src = new Bitmap(path))
    using (Bitmap bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb)) {
      using (Graphics g = Graphics.FromImage(bmp)) {
        g.Clear(Color.Transparent);
        g.DrawImage(src, 0, 0, src.Width, src.Height);
      }
      w = bmp.Width; h = bmp.Height;
      BitmapData d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      byte[] buf = new byte[d.Stride * h];
      Marshal.Copy(d.Scan0, buf, 0, buf.Length);
      bmp.UnlockBits(d);
      return buf;
    }
  }

  // Bounding box of pixels with alpha above the threshold. Returns {left, top, right, bottom} or null.
  public static int[] AlphaBox(string path, int thresh) {
    int w, h; byte[] buf = Read(path, out w, out h);
    int stride = w * 4;
    int l = w, t = h, r = -1, b = -1;
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++)
        if (buf[y * stride + x * 4 + 3] > thresh) {
          if (x < l) l = x;
          if (x > r) r = x;
          if (y < t) t = y;
          if (y > b) b = y;
        }
    if (r < 0) return null;
    return new int[] { l, t, r, b };
  }

  // Splits a sprite sheet into per-frame images. Frames on these sheets touch or overlap
  // horizontally, so they are separated as connected blobs rather than by column gaps.
  // Each frame is written on a full-size canvas, keeping every sheet in the same coordinate
  // space, and the flattened {left, top, right, bottom} of each frame is returned.
  public static int[] SplitFrames(string path, int thresh, int count, string outPrefix) {
    int w, h; byte[] buf = Read(path, out w, out h);
    int stride = w * 4;
    int[] label = new int[w * h];
    for (int i = 0; i < label.Length; i++) label[i] = -1;
    List<int[]> blobs = new List<int[]>();
    Stack<int> stack = new Stack<int>();

    for (int y0 = 0; y0 < h; y0++) {
      for (int x0 = 0; x0 < w; x0++) {
        int start = y0 * w + x0;
        if (label[start] >= 0 || buf[y0 * stride + x0 * 4 + 3] <= thresh) continue;
        int id = blobs.Count;
        int l = x0, t = y0, r = x0, b = y0, area = 0;
        label[start] = id;
        stack.Push(start);
        while (stack.Count > 0) {
          int idx = stack.Pop();
          int x = idx % w, y = idx / w;
          area++;
          if (x < l) l = x;
          if (x > r) r = x;
          if (y < t) t = y;
          if (y > b) b = y;
          if (x > 0 && label[idx - 1] < 0 && buf[y * stride + (x - 1) * 4 + 3] > thresh) { label[idx - 1] = id; stack.Push(idx - 1); }
          if (x < w - 1 && label[idx + 1] < 0 && buf[y * stride + (x + 1) * 4 + 3] > thresh) { label[idx + 1] = id; stack.Push(idx + 1); }
          if (y > 0 && label[idx - w] < 0 && buf[(y - 1) * stride + x * 4 + 3] > thresh) { label[idx - w] = id; stack.Push(idx - w); }
          if (y < h - 1 && label[idx + w] < 0 && buf[(y + 1) * stride + x * 4 + 3] > thresh) { label[idx + w] = id; stack.Push(idx + w); }
        }
        blobs.Add(new int[] { l, t, r, b, area });
      }
    }
    if (blobs.Count < count) throw new Exception(path + ": found only " + blobs.Count + " blobs");

    List<int> order = new List<int>();
    for (int i = 0; i < blobs.Count; i++) order.Add(i);
    order.Sort(delegate (int a, int c) { return blobs[c][4].CompareTo(blobs[a][4]); });
    List<int> main = order.GetRange(0, count);
    main.Sort(delegate (int a, int c) { return blobs[a][0].CompareTo(blobs[c][0]); });

    // Loose bits (whiskers, dropped highlights) join the frame they sit closest to.
    int[] frameOf = new int[blobs.Count];
    for (int i = 0; i < blobs.Count; i++) frameOf[i] = -1;
    for (int k = 0; k < count; k++) frameOf[main[k]] = k;
    for (int i = 0; i < blobs.Count; i++) {
      if (frameOf[i] >= 0) continue;
      double cx = (blobs[i][0] + blobs[i][2]) / 2.0;
      int best = 0;
      double bestD = double.MaxValue;
      for (int k = 0; k < count; k++) {
        int m = main[k];
        double d = Math.Abs(cx - (blobs[m][0] + blobs[m][2]) / 2.0);
        if (d < bestD) { bestD = d; best = k; }
      }
      frameOf[i] = best;
      int mm = main[best];
      if (blobs[i][0] < blobs[mm][0]) blobs[mm][0] = blobs[i][0];
      if (blobs[i][2] > blobs[mm][2]) blobs[mm][2] = blobs[i][2];
      if (blobs[i][1] < blobs[mm][1]) blobs[mm][1] = blobs[i][1];
      if (blobs[i][3] > blobs[mm][3]) blobs[mm][3] = blobs[i][3];
    }

    List<int> boxes = new List<int>();
    for (int k = 0; k < count; k++) {
      using (Bitmap frame = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        BitmapData fd = frame.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        byte[] fbuf = new byte[fd.Stride * h];
        for (int y = 0; y < h; y++)
          for (int x = 0; x < w; x++) {
            int id = label[y * w + x];
            if (id < 0 || frameOf[id] != k) continue;
            int si = y * stride + x * 4;
            int di = y * fd.Stride + x * 4;
            fbuf[di] = buf[si]; fbuf[di + 1] = buf[si + 1]; fbuf[di + 2] = buf[si + 2]; fbuf[di + 3] = buf[si + 3];
          }
        Marshal.Copy(fbuf, 0, fd.Scan0, fbuf.Length);
        frame.UnlockBits(fd);
        frame.Save(outPrefix + (k + 1) + ".png", ImageFormat.Png);
      }
      int m = main[k];
      boxes.Add(blobs[m][0]); boxes.Add(blobs[m][1]); boxes.Add(blobs[m][2]); boxes.Add(blobs[m][3]);
    }
    return boxes.ToArray();
  }

  // Per-row maximum luminance, used to trim the letterboxed bars off opaque art.
  public static int[] RowLuma(string path) {
    int w, h; byte[] buf = Read(path, out w, out h);
    int stride = w * 4;
    int[] luma = new int[h];
    for (int y = 0; y < h; y++) {
      int max = 0;
      for (int x = 0; x < w; x++) {
        int i = y * stride + x * 4;
        int v = (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
        if (v > max) max = v;
      }
      luma[y] = max;
    }
    return luma;
  }
}
"@ -ReferencedAssemblies System.Drawing

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  return @{ bmp = $bmp; g = $g }
}

function Save-Canvas($canvas, [string]$path) {
  $canvas.g.Dispose()
  $canvas.bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.bmp.Dispose()
  Write-Host "  -> $(Split-Path -Leaf $path)"
}

# Opaque backdrops ship as JPEG; as PNG they are several megabytes each.
function Save-CanvasJpeg($canvas, [string]$path, [int]$quality) {
  $canvas.g.Dispose()
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
  $flat = New-Object System.Drawing.Bitmap($canvas.bmp.Width, $canvas.bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $fg = [System.Drawing.Graphics]::FromImage($flat)
  $fg.Clear([System.Drawing.Color]::Black)
  $fg.DrawImage($canvas.bmp, 0, 0, $canvas.bmp.Width, $canvas.bmp.Height)
  $fg.Dispose()
  $flat.Save($path, $codec, $params)
  $flat.Dispose()
  $canvas.bmp.Dispose()
  Write-Host "  -> $(Split-Path -Leaf $path)"
}

function Split-Sheet([string]$path, [string]$outPrefix, [int]$count) {
  $flat = [PixScan]::SplitFrames($path, 24, $count, $outPrefix)
  $frames = New-Object System.Collections.ArrayList
  for ($i = 0; $i -lt $flat.Length; $i += 4) {
    [void]$frames.Add([pscustomobject]@{ L = $flat[$i]; T = $flat[$i + 1]; R = $flat[$i + 2]; B = $flat[$i + 3] })
  }
  return $frames
}

Write-Host "Keying backgrounds"
$keyed = Join-Path $src "keyed"
New-Item -ItemType Directory -Force -Path $keyed | Out-Null
foreach ($name in @("v4-idle", "v4-walk-base", "v4-walk-tools", "v4-walk-triangle", "v4-tank-cracked", "v4-tank-repaired", "v4-ruler")) {
  [Keyer]::Key((Join-Path $src "$name.png"), (Join-Path $keyed "$name.png"))
  Write-Host "  -> keyed/$name.png"
}
# These have see-through pockets the border fill cannot reach: the gap under the desk and
# the hollow middle of the protractor.
foreach ($name in @("v4-bench-station", "v4-protractor")) {
  [Keyer]::Key((Join-Path $src "$name.png"), (Join-Path $keyed "$name.png"), $true)
  Write-Host "  -> keyed/$name.png"
}

Write-Host "Slicing cat sheets"

$sheets = [ordered]@{
  walk     = Join-Path $keyed "v4-walk-base.png"
  tools    = Join-Path $keyed "v4-walk-tools.png"
  triangle = Join-Path $keyed "v4-walk-triangle.png"
}

$frameDir = Join-Path $src "frames"
New-Item -ItemType Directory -Force -Path $frameDir | Out-Null

$segs = @{}
foreach ($k in $sheets.Keys) {
  $segs[$k] = Split-Sheet $sheets[$k] (Join-Path $frameDir "$k-") 4
  Write-Host "  $k frames: $(($segs[$k] | ForEach-Object { "$($_.L)-$($_.R)" }) -join ', ')"
}

# One shared crop rectangle per frame keeps the cat's body in the same spot across all three sheets.
$SPRITE = 256
$MARGIN = 10
$BOX = $SPRITE - $MARGIN * 2
$top = ($segs.Values | ForEach-Object { $_ } | ForEach-Object { $_.T } | Measure-Object -Minimum).Minimum
$bottom = ($segs.Values | ForEach-Object { $_ } | ForEach-Object { $_.B } | Measure-Object -Maximum).Maximum
$contentH = $bottom - $top + 1

$cells = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt 4; $i++) {
  $base = $segs["walk"][$i]
  $center = ($base.L + $base.R) / 2
  $half = 0.0
  foreach ($k in $sheets.Keys) {
    $s = $segs[$k][$i]
    $half = [Math]::Max($half, [Math]::Max($center - $s.L, $s.R - $center))
  }
  [void]$cells.Add([pscustomobject]@{ center = $center; half = $half + 4 })
}

# A single scale for every frame and sheet, so the cat never resizes between poses.
$maxCellW = ($cells | ForEach-Object { $_.half * 2 } | Measure-Object -Maximum).Maximum
$scale = [Math]::Min($BOX / $contentH, $BOX / $maxCellW)
$walkH = $contentH * $scale
Write-Host "  sprite scale $([Math]::Round($scale, 3)), cat height $([int]$walkH)px in $SPRITE"

foreach ($k in $sheets.Keys) {
  for ($i = 0; $i -lt 4; $i++) {
    $cell = $cells[$i]
    $srcX = $cell.center - $cell.half
    $srcW = $cell.half * 2
    $dstW = $srcW * $scale
    $img = [System.Drawing.Image]::FromFile((Join-Path $frameDir "$k-$($i + 1).png"))
    $canvas = New-Canvas $SPRITE $SPRITE
    $canvas.g.DrawImage(
      $img,
      (New-Object System.Drawing.RectangleF(($SPRITE / 2 - $dstW / 2), ($SPRITE - $MARGIN - $walkH), $dstW, $walkH)),
      (New-Object System.Drawing.RectangleF($srcX, $top, $srcW, $contentH)),
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $name = if ($k -eq "walk") { "cat-walk-$($i + 1).png" } else { "cat-$k-walk-$($i + 1).png" }
    Save-Canvas $canvas (Join-Path $out $name)
    $img.Dispose()
  }
}

# Standing poses reuse the passing frame of each sheet so the cat never changes size or style.
foreach ($k in @("tools", "triangle")) {
  Copy-Item (Join-Path $out "cat-$k-walk-2.png") (Join-Path $out "cat-$k.png") -Force
  Write-Host "  -> cat-$k.png"
}

Write-Host "Normalising idle pose"
$idlePath = Join-Path $keyed "v4-idle.png"
$idleBox = [PixScan]::AlphaBox($idlePath, 24)
$idleW = $idleBox[2] - $idleBox[0] + 1
$idleH = $idleBox[3] - $idleBox[1] + 1
$idleTargetH = [Math]::Min($walkH * 1.05, $BOX)
$idleTargetW = $idleW * ($idleTargetH / $idleH)
if ($idleTargetW -gt $BOX) {
  $idleTargetH = $idleTargetH * ($BOX / $idleTargetW)
  $idleTargetW = $BOX
}
$img = [System.Drawing.Image]::FromFile($idlePath)
$canvas = New-Canvas $SPRITE $SPRITE
$canvas.g.DrawImage(
  $img,
  (New-Object System.Drawing.RectangleF(($SPRITE / 2 - $idleTargetW / 2), ($SPRITE - $MARGIN - $idleTargetH), $idleTargetW, $idleTargetH)),
  (New-Object System.Drawing.RectangleF($idleBox[0], $idleBox[1], $idleW, $idleH)),
  [System.Drawing.GraphicsUnit]::Pixel
)
Save-Canvas $canvas (Join-Path $out "cat-idle.png")
$img.Dispose()

function Export-Trimmed([string]$name, [string]$outName, [int]$targetW) {
  $path = Join-Path $keyed $name
  $box = [PixScan]::AlphaBox($path, 16)
  $w = $box[2] - $box[0] + 1
  $h = $box[3] - $box[1] + 1
  $targetH = [int][Math]::Round($h * ($targetW / $w))
  $img = [System.Drawing.Image]::FromFile($path)
  $canvas = New-Canvas $targetW $targetH
  $canvas.g.DrawImage(
    $img,
    (New-Object System.Drawing.RectangleF(0, 0, $targetW, $targetH)),
    (New-Object System.Drawing.RectangleF($box[0], $box[1], $w, $h)),
    [System.Drawing.GraphicsUnit]::Pixel
  )
  Save-Canvas $canvas (Join-Path $out $outName)
  $img.Dispose()
  return @{ w = $targetW; h = $targetH }
}

# The cracked and repaired tanks must share one crop box, otherwise the repaired overlay
# lands at a different size than the tank baked into the background and the two show double.
function Export-TankPair([int]$targetW) {
  $paths = @((Join-Path $keyed "v4-tank-cracked.png"), (Join-Path $keyed "v4-tank-repaired.png"))
  $names = @("tank-cracked.png", "tank-repaired.png")
  $l = [int]::MaxValue; $t = [int]::MaxValue; $r = 0; $b = 0
  foreach ($p in $paths) {
    $box = [PixScan]::AlphaBox($p, 16)
    $l = [Math]::Min($l, $box[0]); $t = [Math]::Min($t, $box[1])
    $r = [Math]::Max($r, $box[2]); $b = [Math]::Max($b, $box[3])
  }
  $w = $r - $l + 1
  $h = $b - $t + 1
  $targetH = [int][Math]::Round($h * ($targetW / $w))
  for ($i = 0; $i -lt 2; $i++) {
    $img = [System.Drawing.Image]::FromFile($paths[$i])
    $canvas = New-Canvas $targetW $targetH
    $canvas.g.DrawImage(
      $img,
      (New-Object System.Drawing.RectangleF(0, 0, $targetW, $targetH)),
      (New-Object System.Drawing.RectangleF($l, $t, $w, $h)),
      [System.Drawing.GraphicsUnit]::Pixel
    )
    Save-Canvas $canvas (Join-Path $out $names[$i])
    $img.Dispose()
  }
}

Write-Host "Trimming props"
Export-TankPair 300
Export-Trimmed "v4-bench-station.png" "bench-station.png" 460 | Out-Null
Export-Trimmed "v4-ruler.png" "ruler.png" 300 | Out-Null
Export-Trimmed "v4-protractor.png" "protractor.png" 220 | Out-Null

function Export-Scene([string]$name, [string]$outName, [int]$targetW, [int]$targetH) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $src $name))
  $canvas = New-Canvas $targetW $targetH
  $canvas.g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $targetW, $targetH)))
  Save-CanvasJpeg $canvas (Join-Path $out $outName) 84
  $img.Dispose()
}

Write-Host "Resizing scene backdrops"
Export-Scene "v4-scene-tank.png" "scene-tank.jpg" 1152 648
Export-Scene "v4-scene-bench.png" "scene-bench.jpg" 1152 648

Write-Host "Cropping opening still"
$stillSrc = Join-Path $src "ref-leak.png"
$stillLuma = [PixScan]::RowLuma($stillSrc)
$cTop = 0
while ($cTop -lt $stillLuma.Length -and $stillLuma[$cTop] -lt 14) { $cTop++ }
$cBottom = $stillLuma.Length - 1
while ($cBottom -gt $cTop -and $stillLuma[$cBottom] -lt 14) { $cBottom-- }
$still = [System.Drawing.Image]::FromFile($stillSrc)
$cH = $cBottom - $cTop + 1
$stillW = 960
$stillH = [int][Math]::Round($cH * ($stillW / $still.Width))
$canvas = New-Canvas $stillW $stillH
$canvas.g.DrawImage(
  $still,
  (New-Object System.Drawing.RectangleF(0, 0, $stillW, $stillH)),
  (New-Object System.Drawing.RectangleF(0, $cTop, $still.Width, $cH)),
  [System.Drawing.GraphicsUnit]::Pixel
)
Save-CanvasJpeg $canvas (Join-Path $out "opening-still.jpg") 84
$still.Dispose()

Write-Host "Composing world background"
# Matches VIEW/WORLD constants and the ZONES table in game.js.
$WORLD_W = 2600
$WORLD_H = 520
$FLOOR_Y = 430
$TANK_W = 150
$BENCH_W = 300
$TANK_X = @(420, 740, 1500, 1840, 2180)
$BENCH_X = 1120

$stripPath = Join-Path $src "v4-wall-strip.png"
$luma = [PixScan]::RowLuma($stripPath)
$sTop = 0
while ($sTop -lt $luma.Length -and $luma[$sTop] -lt 14) { $sTop++ }
$sBottom = $luma.Length - 1
while ($sBottom -gt $sTop -and $luma[$sBottom] -lt 14) { $sBottom-- }
$stripH = $sBottom - $sTop + 1
Write-Host "  wall strip band: $sTop..$sBottom"

$strip = [System.Drawing.Image]::FromFile($stripPath)
$world = New-Canvas $WORLD_W $WORLD_H
$world.g.Clear([System.Drawing.Color]::FromArgb(255, 6, 12, 18))
$tileW = [int][Math]::Round($strip.Width * ($WORLD_H / $stripH))
for ($x = 0; $x -lt $WORLD_W; $x += $tileW - 1) {
  $world.g.DrawImage(
    $strip,
    (New-Object System.Drawing.RectangleF($x, 0, $tileW, $WORLD_H)),
    (New-Object System.Drawing.RectangleF(0, $sTop, $strip.Width, $stripH)),
    [System.Drawing.GraphicsUnit]::Pixel
  )
}
$strip.Dispose()

$tank = [System.Drawing.Image]::FromFile((Join-Path $out "tank-cracked.png"))
$tankH = [int][Math]::Round($tank.Height * ($TANK_W / $tank.Width))
foreach ($tx in $TANK_X) {
  $world.g.DrawImage($tank, (New-Object System.Drawing.Rectangle(($tx - [int]($TANK_W / 2)), ($FLOOR_Y - $tankH), $TANK_W, $tankH)))
}
$tank.Dispose()

$bench = [System.Drawing.Image]::FromFile((Join-Path $out "bench-station.png"))
$benchH = [int][Math]::Round($bench.Height * ($BENCH_W / $bench.Width))
$world.g.DrawImage($bench, (New-Object System.Drawing.Rectangle(($BENCH_X - [int]($BENCH_W / 2)), ($FLOOR_Y - $benchH), $BENCH_W, $benchH)))
$bench.Dispose()

Save-CanvasJpeg $world (Join-Path $out "level-bg.jpg") 86

Write-Host "tank draw size: $TANK_W x $tankH  (top at $($FLOOR_Y - $tankH))"
Write-Host "Done"
