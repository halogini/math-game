param(
  [int]$Port = 8010,
  [string]$Root = $PSScriptRoot
)

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $Root at $prefix"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".htm"  = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".gif"  = "image/gif"
  ".mp4"  = "video/mp4"
  ".webm" = "video/webm"
  ".woff" = "font/woff"
  ".woff2"= "font/woff2"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $rel = $rel -replace "/", [IO.Path]::DirectorySeparatorChar
    $filePath = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    if (-not $filePath.StartsWith([IO.Path]::GetFullPath($Root))) {
      $res.StatusCode = 403
    } elseif (Test-Path -LiteralPath $filePath -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $ct = $mime[$ext]
      if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [IO.File]::ReadAllBytes($filePath)
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.AddHeader("Accept-Ranges", "bytes")
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    Write-Host "ERR $($_.Exception.Message)"
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
