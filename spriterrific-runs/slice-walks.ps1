$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class WalkSlice {
  static bool IsKey(byte[] p, int i) {
    int b = p[i], g = p[i + 1], r = p[i + 2];
    int max = Math.Max(r, Math.Max(g, b));
    if (max <= 22) return true;
    if (g >= 180 && r <= 90 && b <= 90 && (g - r) >= 80 && (g - b) >= 80) return true;
    return false;
  }

  public static void Extract(string sheetPath, string outPath, int index, int cols, int cell, bool flip) {
    using (Bitmap src = new Bitmap(sheetPath))
    using (Bitmap cellBmp = new Bitmap(cell, cell, PixelFormat.Format32bppArgb)) {
      int col = index % cols;
      int row = index / cols;
      using (Graphics g = Graphics.FromImage(cellBmp)) {
        g.Clear(Color.Transparent);
        g.DrawImage(src, new Rectangle(0, 0, cell, cell), new Rectangle(col * cell, row * cell, cell, cell), GraphicsUnit.Pixel);
      }
      if (flip) cellBmp.RotateFlip(RotateFlipType.RotateNoneFlipX);
      KeyFromEdges(cellBmp);
      cellBmp.Save(outPath, ImageFormat.Png);
    }
  }

  static void KeyFromEdges(Bitmap bmp) {
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
      if (!IsKey(buf, y * stride + x * 4)) continue;
      clear[idx] = true;
      if (x > 0) stack.Push(idx - 1);
      if (x < w - 1) stack.Push(idx + 1);
      if (y > 0) stack.Push(idx - w);
      if (y < h - 1) stack.Push(idx + w);
    }
    for (int pass = 0; pass < 2; pass++) {
      List<int> fade = new List<int>();
      for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++) {
          int idx = y * w + x;
          if (clear[idx]) continue;
          bool edge = (x > 0 && clear[idx - 1]) || (x < w - 1 && clear[idx + 1])
            || (y > 0 && clear[idx - w]) || (y < h - 1 && clear[idx + w]);
          if (!edge) continue;
          int i = y * stride + x * 4;
          int luma = (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
          if (luma < 40 || (buf[i + 1] > 160 && buf[i + 2] < 100 && buf[i] < 100)) fade.Add(idx);
        }
      foreach (int idx in fade) clear[idx] = true;
    }
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++)
        if (clear[y * w + x]) {
          int i = y * stride + x * 4;
          buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;
        }
    Marshal.Copy(buf, 0, d.Scan0, buf.Length);
    bmp.UnlockBits(d);
  }
}
"@ -ReferencedAssemblies System.Drawing

$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "games\three-chances\assets"))) {
  $root = (Get-Location).Path
}
$assets = Join-Path $root "games\three-chances\assets"
$runs = Join-Path $root "spriterrific-runs"
$backup = Join-Path $runs "backup-game-walks"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

foreach ($name in @(
  "cat-walk-1.png","cat-walk-2.png","cat-walk-3.png","cat-walk-4.png",
  "cat-tools-walk-1.png","cat-tools-walk-2.png","cat-tools-walk-3.png","cat-tools-walk-4.png"
)) {
  Copy-Item (Join-Path $assets $name) (Join-Path $backup $name) -Force
}

$jobs = @(
  @{ sheet = Join-Path $runs "nyangsooni-empty-cdg68\walk\spritesheet.png"; prefix = "cat-walk-" },
  @{ sheet = Join-Path $runs "nyangsooni-tools-cdntg\walk\spritesheet.png"; prefix = "cat-tools-walk-" }
)
$pick = @(0, 2, 4, 6)
foreach ($job in $jobs) {
  Write-Host "slicing $($job.sheet)"
  for ($i = 0; $i -lt 4; $i++) {
    $out = Join-Path $assets ($job.prefix + ($i + 1) + ".png")
    [WalkSlice]::Extract($job.sheet, $out, $pick[$i], 5, 256, $true)
    Write-Host "  -> $(Split-Path -Leaf $out)"
  }
}

Add-Type -AssemblyName System.Drawing
foreach ($name in @("cat-walk-1.png","cat-tools-walk-1.png","cat-idle.png")) {
  $p = Join-Path $assets $name
  $bmp = New-Object System.Drawing.Bitmap($p)
  $c = $bmp.GetPixel(0, 0)
  $m = $bmp.GetPixel(128, 128)
  Write-Host ("{0} {1}x{2} corner A={3} mid A={4} R{5}G{6}B{7}" -f $name, $bmp.Width, $bmp.Height, $c.A, $m.A, $m.R, $m.G, $m.B)
  $bmp.Dispose()
}
