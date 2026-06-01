param(
  [int]$Port = 8010,
  [string]$Root = (Get-Location).Path
)

$listener = [System.Net.HttpListener]::new()
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".gltf" = "model/gltf+json; charset=utf-8"
  ".glb" = "model/gltf-binary"
  ".bin" = "application/octet-stream"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
}

Write-Output "Serving $Root at $prefix"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $safePath = Join-Path -Path $Root -ChildPath $requestPath
    if ((Test-Path $safePath) -and (Get-Item $safePath).PSIsContainer) {
      $safePath = Join-Path -Path $safePath -ChildPath "index.html"
    }

    if (-not (Test-Path $safePath)) {
      $context.Response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $context.Response.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($safePath).ToLowerInvariant()
    $context.Response.ContentType = $mimeTypes[$extension]
    $fileBytes = [System.IO.File]::ReadAllBytes($safePath)
    $context.Response.ContentLength64 = $fileBytes.Length
    $context.Response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
    $context.Response.Close()
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
