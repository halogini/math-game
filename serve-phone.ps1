param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

function Get-Mime([string]$ext) {
  switch ($ext.ToLower()) {
    '.html' { 'text/html; charset=utf-8' }
    '.css'  { 'text/css' }
    '.js'   { 'application/javascript' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.webp' { 'image/webp' }
    '.mp4'  { 'video/mp4' }
    '.svg'  { 'image/svg+xml' }
    '.json' { 'application/json' }
    default { 'application/octet-stream' }
  }
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Sort-Object InterfaceMetric |
  Select-Object -First 1 -ExpandProperty IPAddress)

if (-not $ip) { $ip = '127.0.0.1' }

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()

Write-Host ""
Write-Host "=== Prism Tycoon phone test server ===" -ForegroundColor Cyan
Write-Host "PC folder : $Root"
Write-Host "Phone URL : http://${ip}:$Port/games/prism-tycoon/index.html" -ForegroundColor Green
Write-Host "Local URL : http://127.0.0.1:$Port/games/prism-tycoon/index.html"
Write-Host "Stop with Ctrl+C"
Write-Host ""

while ($true) {
  $client = $listener.AcceptTcpClient()
  $stream = $client.GetStream()
  $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 8192, $true)

  $requestLine = $reader.ReadLine()
  if (-not $requestLine) { $client.Close(); continue }

  while ($true) {
    $line = $reader.ReadLine()
    if ($null -eq $line -or $line -eq '') { break }
  }

  $parts = $requestLine.Split(' ')
  $path = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
  $path = [System.Uri]::UnescapeDataString($path.Split('?')[0].TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }

  $file = Join-Path $Root ($path -replace '/', [IO.Path]::DirectorySeparatorChar)
  $writer = New-Object System.IO.StreamWriter($stream, [Text.Encoding]::ASCII, 8192, $true)
  $writer.NewLine = "`r`n"

  if (Test-Path $file -PathType Leaf) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $writer.WriteLine("HTTP/1.1 200 OK")
    $writer.WriteLine("Content-Type: $(Get-Mime ([IO.Path]::GetExtension($file)))")
    $writer.WriteLine("Content-Length: $($bytes.Length)")
    $writer.WriteLine("Connection: close")
    $writer.WriteLine("")
    $writer.Flush()
    $stream.Write($bytes, 0, $bytes.Length)
    Write-Host "200 $path"
  } else {
    $body = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
    $writer.WriteLine("HTTP/1.1 404 Not Found")
    $writer.WriteLine("Content-Type: text/plain; charset=utf-8")
    $writer.WriteLine("Content-Length: $($body.Length)")
    $writer.WriteLine("Connection: close")
    $writer.WriteLine("")
    $writer.Flush()
    $stream.Write($body, 0, $body.Length)
    Write-Host "404 $path" -ForegroundColor Yellow
  }

  $writer.Dispose()
  $client.Close()
}
