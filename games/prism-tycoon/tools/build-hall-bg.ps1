# 1) dirt + worn path at 2160x992
# 2) hall-paint rim blended only near edges (vague black fade, no continuous 1자 rocks)
# 3) sparse corner accents + lanterns sized to match market stall (~26 game-px)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$gen = 'C:\Users\samsung\.cursor\projects\c-Users-samsung-gemini-antigravity-scratch-halomath-games-math-game\assets'
$dst = 'C:\Users\samsung\.gemini\antigravity\scratch\halomath\games\math-game\games\prism-tycoon\assets'

$W = 2160; $HallH = 992

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class HallKit {
  static bool Dark(byte[] buf, int p, int thresh) {
    int b = buf[p], gc = buf[p+1], r = buf[p+2];
    int mx = r > gc ? r : gc; if (b > mx) mx = b;
    return mx <= thresh;
  }
  public static Bitmap EdgeKeyCrop(Bitmap src, int thresh, int pad) {
    int w = src.Width, h = src.Height;
    var tmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(tmp)) g.DrawImage(src, 0, 0, w, h);
    var data = tmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] buf = new byte[stride * h];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    bool[] seen = new bool[w * h];
    var q = new System.Collections.Generic.Queue<int>();
    Action<int,int> enq = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      int i = y * w + x;
      if (seen[i]) return;
      int p = y * stride + x * 4;
      if (!Dark(buf, p, thresh) && buf[p+3] > 8) return;
      seen[i] = true;
      buf[p+3] = 0;
      q.Enqueue(i);
    };
    for (int x = 0; x < w; x++) { enq(x, 0); enq(x, h-1); }
    for (int y = 0; y < h; y++) { enq(0, y); enq(w-1, y); }
    int[] dx = {1,-1,0,0}; int[] dy = {0,0,1,-1};
    while (q.Count > 0) {
      int i = q.Dequeue();
      int x = i % w, y = i / w;
      for (int k = 0; k < 4; k++) enq(x + dx[k], y + dy[k]);
    }
    int minX = w, minY = h, maxX = -1, maxY = -1;
    for (int y = 0; y < h; y++) {
      int row = y * stride;
      for (int x = 0; x < w; x++) {
        if (buf[row + x * 4 + 3] < 10) continue;
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
    Marshal.Copy(buf, 0, data.Scan0, buf.Length);
    tmp.UnlockBits(data);
    if (maxX < minX) return tmp;
    minX = Math.Max(0, minX - pad); minY = Math.Max(0, minY - pad);
    maxX = Math.Min(w-1, maxX + pad); maxY = Math.Min(h-1, maxY + pad);
    int cw = maxX - minX + 1, ch = maxY - minY + 1;
    var crop = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(crop)) {
      g.Clear(Color.Transparent);
      g.DrawImage(tmp, new Rectangle(0,0,cw,ch), new Rectangle(minX,minY,cw,ch), GraphicsUnit.Pixel);
    }
    tmp.Dispose();
    return crop;
  }
  static float DistSeg(float px, float py, float ax, float ay, float bx, float by) {
    float vx = bx - ax, vy = by - ay;
    float len2 = vx*vx + vy*vy; if (len2 < 1f) len2 = 1f;
    float t = ((px-ax)*vx + (py-ay)*vy) / len2;
    if (t < 0f) t = 0f; else if (t > 1f) t = 1f;
    float dx = px - (ax + vx*t), dy = py - (ay + vy*t);
    return (float)Math.Sqrt(dx*dx + dy*dy);
  }
  static int Hash(int x, int y) {
    uint n = (uint)(x * 374761393 + y * 668265263);
    n = (n ^ (n >> 13)) * 1274126177u;
    return (int)(n ^ (n >> 16));
  }
  public static void Wear(Bitmap bmp, float[] segs, float[] widths) {
    int w = bmp.Width, h = bmp.Height;
    var data = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] buf = new byte[stride * h];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    int nSeg = segs.Length / 4;
    for (int y = 0; y < h; y++) {
      int row = y * stride;
      for (int x = 0; x < w; x++) {
        float u = 0f;
        for (int i = 0; i < nSeg; i++) {
          int o = i * 4;
          float di = DistSeg(x, y, segs[o], segs[o+1], segs[o+2], segs[o+3]);
          float half = widths[i];
          if (di >= half) continue;
          float v = 1f - di / half;
          v = v * (0.55f + 0.55f * ((Hash(x/4, y/3) & 255) / 255f));
          if (v > u) u = v;
        }
        if (u < 0.06f) continue;
        if (u > 1f) u = 1f;
        int p = row + x * 4;
        int addB = (int)(u * 16f);
        int addG = (int)(u * 28f);
        int addR = (int)(u * 40f);
        int nb = buf[p] + addB; if (nb > 255) nb = 255;
        int ng = buf[p+1] + addG; if (ng > 255) ng = 255;
        int nr = buf[p+2] + addR; if (nr > 255) nr = 255;
        buf[p] = (byte)nb; buf[p+1] = (byte)ng; buf[p+2] = (byte)nr;
      }
    }
    Marshal.Copy(buf, 0, data.Scan0, buf.Length);
    bmp.UnlockBits(data);
  }
  public static Bitmap FadeEnds(Bitmap src, int left, int right, int top, int bottom) {
    int w = src.Width, h = src.Height;
    var dst = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(dst)) g.DrawImage(src, 0, 0, w, h);
    var data = dst.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] buf = new byte[stride * h];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    for (int y = 0; y < h; y++) {
      int row = y * stride;
      for (int x = 0; x < w; x++) {
        int p = row + x * 4;
        if (buf[p+3] < 4) continue;
        float f = 1f;
        if (left > 0 && x < left) f = Math.Min(f, (float)x / left);
        if (right > 0 && x > w - 1 - right) f = Math.Min(f, (float)(w - 1 - x) / right);
        if (top > 0 && y < top) f = Math.Min(f, (float)y / top);
        if (bottom > 0 && y > h - 1 - bottom) f = Math.Min(f, (float)(h - 1 - y) / bottom);
        if (f >= 0.999f) continue;
        if (f < 0f) f = 0f;
        f = f * f * (3f - 2f * f);
        buf[p] = (byte)(buf[p] * f);
        buf[p+1] = (byte)(buf[p+1] * f);
        buf[p+2] = (byte)(buf[p+2] * f);
        buf[p+3] = (byte)(buf[p+3] * f);
      }
    }
    Marshal.Copy(buf, 0, data.Scan0, buf.Length);
    dst.UnlockBits(data);
    return dst;
  }
  public static void VignetteBlack(Bitmap bmp, float margin) {
    int w = bmp.Width, h = bmp.Height;
    var data = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] buf = new byte[stride * h];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    for (int y = 0; y < h; y++) {
      int row = y * stride;
      float dy = Math.Min(y, h - 1 - y);
      for (int x = 0; x < w; x++) {
        float dx = Math.Min(x, w - 1 - x);
        float d = Math.Min(dx, dy);
        if (d >= margin) continue;
        float t = d / margin;
        t = t * t * (3f - 2f * t);
        int p = row + x * 4;
        buf[p] = (byte)(buf[p] * t);
        buf[p+1] = (byte)(buf[p+1] * t);
        buf[p+2] = (byte)(buf[p+2] * t);
      }
    }
    Marshal.Copy(buf, 0, data.Scan0, buf.Length);
    bmp.UnlockBits(data);
  }
  // Height-fit paint centered; blend only near edges. Skip warm lantern pixels from paint
  // so we can stamp market-sized lanterns ourselves.
  public static void BlendPaintRim(Bitmap dest, Bitmap paint, float margin) {
    int dw = dest.Width, dh = dest.Height;
    float scale = (float)dh / paint.Height;
    int pw = (int)Math.Round(paint.Width * scale);
    int ph = dh;
    int ox = (dw - pw) / 2;
    using (var scaled = new Bitmap(pw, ph, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(scaled)) {
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.DrawImage(paint, 0, 0, pw, ph);
      }
      var dData = dest.LockBits(new Rectangle(0,0,dw,dh), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      var sData = scaled.LockBits(new Rectangle(0,0,pw,ph), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int dStride = dData.Stride, sStride = sData.Stride;
      byte[] dBuf = new byte[dStride * dh];
      byte[] sBuf = new byte[sStride * ph];
      Marshal.Copy(dData.Scan0, dBuf, 0, dBuf.Length);
      Marshal.Copy(sData.Scan0, sBuf, 0, sBuf.Length);
      for (int y = 0; y < dh; y++) {
        float dy = Math.Min(y, dh - 1 - y);
        int dRow = y * dStride;
        int sRow = y * sStride;
        for (int x = 0; x < dw; x++) {
          float dx = Math.Min(x, dw - 1 - x);
          float d = Math.Min(dx, dy);
          if (d >= margin) continue;
          int sx = x - ox;
          if (sx < 0 || sx >= pw) {
            // Outside paint: pull toward black for vague wide ends.
            float edge = 1f - d / margin;
            edge = edge * edge * (3f - 2f * edge);
            int op = dRow + x * 4;
            float keep = 1f - edge * 0.92f;
            dBuf[op] = (byte)(dBuf[op] * keep);
            dBuf[op+1] = (byte)(dBuf[op+1] * keep);
            dBuf[op+2] = (byte)(dBuf[op+2] * keep);
            continue;
          }
          int sp = sRow + sx * 4;
          int r = sBuf[sp+2], gc = sBuf[sp+1], b = sBuf[sp];
          // Drop paint lanterns (warm orange) — we stamp market-sized ones later.
          if (r > 170 && gc > 90 && b < 95 && r > gc + 30) continue;
          float wgt = 1f - d / margin;
          wgt = wgt * wgt * (3f - 2f * wgt);
          // Prefer rock/crystal detail over flat dirt in the paint.
          int mx = r > gc ? r : gc; if (b > mx) mx = b;
          float detail = Math.Min(1f, mx / 70f);
          wgt *= (0.35f + 0.65f * detail);
          int dp = dRow + x * 4;
          dBuf[dp] = (byte)(dBuf[dp] * (1f - wgt) + b * wgt);
          dBuf[dp+1] = (byte)(dBuf[dp+1] * (1f - wgt) + gc * wgt);
          dBuf[dp+2] = (byte)(dBuf[dp+2] * (1f - wgt) + r * wgt);
        }
      }
      Marshal.Copy(dBuf, 0, dData.Scan0, dBuf.Length);
      dest.UnlockBits(dData);
      scaled.UnlockBits(sData);
    }
  }
  // Pull a unique painted corner: keep rocks/crystals, fade toward the room, drop warm lanterns.
  public static Bitmap ExtractPaintCorner(Bitmap paint, string corner, int size, float fade) {
    int pw = paint.Width, ph = paint.Height;
    int sx = 0, sy = 0;
    if (corner == "tr" || corner == "br") sx = pw - size;
    if (corner == "bl" || corner == "br") sy = ph - size;
    if (sx < 0) sx = 0; if (sy < 0) sy = 0;
    int cw = Math.Min(size, pw - sx), ch = Math.Min(size, ph - sy);
    var dst = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(dst)) {
      g.Clear(Color.Transparent);
      g.DrawImage(paint, new Rectangle(0,0,cw,ch), new Rectangle(sx,sy,cw,ch), GraphicsUnit.Pixel);
    }
    var data = dst.LockBits(new Rectangle(0,0,cw,ch), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] buf = new byte[stride * ch];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    for (int y = 0; y < ch; y++) {
      int row = y * stride;
      float ny = (corner == "tl" || corner == "tr") ? (float)y / Math.Max(1, ch - 1)
                                                    : (float)(ch - 1 - y) / Math.Max(1, ch - 1);
      for (int x = 0; x < cw; x++) {
        int p = row + x * 4;
        int b = buf[p], gc = buf[p+1], r = buf[p+2];
        // Drop lantern glow so corners stay rock/crystal, not copy-paste lamps.
        if (r > 165 && gc > 85 && b < 100 && r > gc + 25) {
          buf[p+3] = 0;
          continue;
        }
        float nx = (corner == "tl" || corner == "bl") ? (float)x / Math.Max(1, cw - 1)
                                                      : (float)(cw - 1 - x) / Math.Max(1, cw - 1);
        // Distance from outer corner (0 at outer, 1 deep into room).
        float into = (float)Math.Sqrt(nx * nx + ny * ny) / 1.41421356f;
        float keep = 1f - into / fade;
        if (keep < 0f) keep = 0f;
        if (keep > 1f) keep = 1f;
        keep = keep * keep * (3f - 2f * keep);
        // Prefer rocky/crystal detail over flat dirt.
        int mx = r > gc ? r : gc; if (b > mx) mx = b;
        int mn = r < gc ? r : gc; if (b < mn) mn = b;
        bool crystal = (r > 90 && b > 120 && r + 20 < b) || (r > 110 && b > 110 && gc < 90);
        bool rock = mx < 95 && (mx - mn) < 40;
        float detail = crystal ? 1f : (rock ? 0.95f : Math.Min(1f, mx / 55f) * 0.55f);
        keep *= detail;
        buf[p] = (byte)(buf[p] * keep);
        buf[p+1] = (byte)(buf[p+1] * keep);
        buf[p+2] = (byte)(buf[p+2] * keep);
        buf[p+3] = (byte)(255 * keep);
      }
    }
    Marshal.Copy(buf, 0, data.Scan0, buf.Length);
    dst.UnlockBits(data);
    return dst;
  }
  public static void WearZone(Bitmap bmp, float cx, float cy, float rx, float ry, float strength) {
    int w = bmp.Width, h = bmp.Height;
    var data = bmp.LockBits(new Rectangle(0,0,w,h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = data.Stride;
    byte[] buf = new byte[stride * h];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    float rx2 = rx * rx, ry2 = ry * ry;
    if (rx2 < 1f) rx2 = 1f; if (ry2 < 1f) ry2 = 1f;
    int x0 = Math.Max(0, (int)(cx - rx) - 2);
    int x1 = Math.Min(w - 1, (int)(cx + rx) + 2);
    int y0 = Math.Max(0, (int)(cy - ry) - 2);
    int y1 = Math.Min(h - 1, (int)(cy + ry) + 2);
    for (int y = y0; y <= y1; y++) {
      int row = y * stride;
      float ny = (y - cy) / ry;
      for (int x = x0; x <= x1; x++) {
        float nx = (x - cx) / rx;
        float e = nx * nx + ny * ny;
        if (e >= 1f) continue;
        float u = (1f - e) * strength;
        u = u * (0.55f + 0.55f * ((Hash(x/4, y/3) & 255) / 255f));
        if (u < 0.05f) continue;
        if (u > 1f) u = 1f;
        int p = row + x * 4;
        int nb = buf[p] + (int)(u * 16f); if (nb > 255) nb = 255;
        int ng = buf[p+1] + (int)(u * 28f); if (ng > 255) ng = 255;
        int nr = buf[p+2] + (int)(u * 40f); if (nr > 255) nr = 255;
        buf[p] = (byte)nb; buf[p+1] = (byte)ng; buf[p+2] = (byte)nr;
      }
    }
    Marshal.Copy(buf, 0, data.Scan0, buf.Length);
    bmp.UnlockBits(data);
  }
}
"@

function Load-Key([string]$name) {
  $raw = [System.Drawing.Bitmap]::FromFile((Join-Path $dst $name))
  $k = [HallKit]::EdgeKeyCrop($raw, 14, 4)
  $raw.Dispose()
  return $k
}

$bmp = New-Object System.Drawing.Bitmap $W, $HallH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$dirt = [System.Drawing.Bitmap]::FromFile((Join-Path $dst 'hall-dirt.png'))
$g.DrawImage($dirt, 0, 0, $W, $HallH)
$dirt.Dispose()

function Map-Pt([double]$gx, [double]$gy) {
  return [System.Drawing.PointF]::new([float](($gx - 20) * 2), [float](($gy - 44) * 2))
}
function Add-Bezier(
  [System.Collections.Generic.List[float]]$segFlat,
  [System.Collections.Generic.List[float]]$wFlat,
  [System.Drawing.PointF]$p0, [System.Drawing.PointF]$p1,
  [System.Drawing.PointF]$p2, [System.Drawing.PointF]$p3,
  [float]$half
) {
  $prev = $p0
  for ($i = 1; $i -le 24; $i++) {
    $t = $i / 24.0
    $u = 1.0 - $t
    $x = $u*$u*$u*$p0.X + 3*$u*$u*$t*$p1.X + 3*$u*$t*$t*$p2.X + $t*$t*$t*$p3.X
    $y = $u*$u*$u*$p0.Y + 3*$u*$u*$t*$p1.Y + 3*$u*$t*$t*$p2.Y + $t*$t*$t*$p3.Y
    $wiggle = 0.85 + 0.22 * [Math]::Sin($i * 0.9)
    $segFlat.Add($prev.X); $segFlat.Add($prev.Y); $segFlat.Add([float]$x); $segFlat.Add([float]$y)
    $wFlat.Add([float]($half * $wiggle))
    $prev = [System.Drawing.PointF]::new([float]$x, [float]$y)
  }
}
$bag = Map-Pt 235 159
$mine = Map-Pt 176.5 359.4
$f0 = Map-Pt 410 364.32
$f1 = Map-Pt 650 249.32
$f2 = Map-Pt 650 479.32
$mkt = Map-Pt 877 346.8
$segFlat = New-Object 'System.Collections.Generic.List[float]'
$wFlat = New-Object 'System.Collections.Generic.List[float]'
Add-Bezier $segFlat $wFlat $bag (Map-Pt 208 240) (Map-Pt 170 305) $mine 36
Add-Bezier $segFlat $wFlat $mine (Map-Pt 248 372) (Map-Pt 328 358) $f0 78
Add-Bezier $segFlat $wFlat (Map-Pt 338 368) (Map-Pt 378 360) (Map-Pt 448 370) (Map-Pt 496 362) 88
Add-Bezier $segFlat $wFlat $f0 (Map-Pt 508 318) (Map-Pt 568 268) $f1 62
Add-Bezier $segFlat $wFlat $f0 (Map-Pt 492 418) (Map-Pt 590 455) $f2 58
Add-Bezier $segFlat $wFlat (Map-Pt 600 248) (Map-Pt 630 246) (Map-Pt 670 252) (Map-Pt 700 250) 48
Add-Bezier $segFlat $wFlat (Map-Pt 605 478) (Map-Pt 640 482) (Map-Pt 675 476) (Map-Pt 705 480) 44
# Trunk toward market only — no f1/f2 line segments that close a kite with the Y-fork
Add-Bezier $segFlat $wFlat (Map-Pt 520 365) (Map-Pt 650 352) (Map-Pt 780 348) $mkt 54
[HallKit]::Wear($bmp, $segFlat.ToArray(), $wFlat.ToArray())
# Soft plazas: benches bleed into the market approach as worn ground, not outline paths
$f1i = Map-Pt 650 249.32
$f2i = Map-Pt 650 479.32
$mkti = Map-Pt 877 346.8
[HallKit]::WearZone($bmp, $f1i.X + 80, $f1i.Y + 40, 140, 90, 0.55)
[HallKit]::WearZone($bmp, $f2i.X + 70, $f2i.Y - 45, 135, 95, 0.50)
[HallKit]::WearZone($bmp, 780, 355, 175, 125, 0.62)
[HallKit]::WearZone($bmp, $mkti.X - 20, $mkti.Y, 130, 85, 0.70)
[HallKit]::VignetteBlack($bmp, 140)

# Four unique painted corners only — no lantern rows, no 1자 rock strips, no flips of the same L.
$paint = [System.Drawing.Bitmap]::FromFile((Join-Path $dst 'hall-paint.png'))
$cTL = [HallKit]::ExtractPaintCorner($paint, 'tl', 560, 0.98)
$cTR = [HallKit]::ExtractPaintCorner($paint, 'tr', 560, 0.98)
$cBL = [HallKit]::ExtractPaintCorner($paint, 'bl', 560, 0.98)
$cBR = [HallKit]::ExtractPaintCorner($paint, 'br', 560, 0.98)
$paint.Dispose()
Write-Output ("corners tl={0}x{1} tr={2}x{3} bl={4}x{5} br={6}x{7}" -f $cTL.Width,$cTL.Height,$cTR.Width,$cTR.Height,$cBL.Width,$cBL.Height,$cBR.Width,$cBR.Height)

function Stamp([System.Drawing.Bitmap]$img, [float]$x, [float]$y, [float]$scale, [bool]$flipX, [bool]$flipY, [float]$angleDeg) {
  $dw = [float]($img.Width * $scale)
  $dh = [float]($img.Height * $scale)
  $g.ResetTransform()
  $g.TranslateTransform($x + $dw / 2, $y + $dh / 2)
  if ($angleDeg -ne 0) { $g.RotateTransform($angleDeg) }
  $sx = 1; if ($flipX) { $sx = -1 }
  $sy = 1; if ($flipY) { $sy = -1 }
  $g.ScaleTransform($sx, $sy)
  $g.DrawImage($img, -$dw / 2, -$dh / 2, $dw, $dh)
  $g.ResetTransform()
}

# Four unique paint corners + one distinct L accent each on opposite corners (not a flip pair).
$sTL = 1.15; $sTR = 1.18; $sBL = 1.10; $sBR = 1.20
Stamp $cTL -36 -28 $sTL $false $false -3
Stamp $cTR ($W - $cTR.Width * $sTR + 36) -28 $sTR $false $false 4
Stamp $cBL -24 ($HallH - $cBL.Height * $sBL + 28) $sBL $false $false 3
Stamp $cBR ($W - $cBR.Width * $sBR + 12) ($HallH - $cBR.Height * $sBR + 10) $sBR $false $false -2
$nieun = Load-Key 'rock-nieun.png'
$giyeok = Load-Key 'rock-giyeok.png'
$nFade = [HallKit]::FadeEnds($nieun, 0, 280, 260, 0)
$gFade = [HallKit]::FadeEnds($giyeok, 260, 0, 0, 280)
Stamp $nFade ($W - 440) ($HallH - 420) 0.52 $true $false 0
Stamp $gFade 16 16 0.50 $true $false 0
$nieun.Dispose(); $giyeok.Dispose(); $nFade.Dispose(); $gFade.Dispose()

$cTL.Dispose(); $cTR.Dispose(); $cBL.Dispose(); $cBR.Dispose()
$g.Dispose()

$out = Join-Path $dst 'hall-bg.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("saved hall-bg {0}x{1}" -f $bmp.Width, $bmp.Height)
$bmp.Dispose()

Get-ChildItem $dst -Filter '_paint-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem $dst -Filter '_edge-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem $dst -Filter '_chk-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force
