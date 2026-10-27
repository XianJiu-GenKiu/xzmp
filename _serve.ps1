$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8123
$guestbookFile = Join-Path $root 'guestbook.json'
$maxStored = 200
$maxReturned = 50
$maxMessageLength = 280
$maxNameLength = 24
$postCooldownSeconds = 5
$lastPostByIp = @{}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Serving $root at http://localhost:$port/"

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.mjs'  = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webp' = 'image/webp'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.webm' = 'video/webm'
  '.mp4'  = 'video/mp4'
  '.md'   = 'text/markdown; charset=utf-8'
  '.ico'  = 'image/x-icon'
}

function Send-Json {
  param($Response, [int]$Status, $Payload)
  $json = ConvertTo-Json -InputObject $Payload -Depth 8 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $Response.StatusCode = $Status
  $Response.ContentType = 'application/json; charset=utf-8'
  $Response.Headers.Add('Cache-Control', 'no-store')
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Response.OutputStream.Close()
}

function Read-Guestbook {
  if (-not (Test-Path -LiteralPath $script:guestbookFile)) { return @() }
  try {
    $raw = [IO.File]::ReadAllText($script:guestbookFile, [Text.Encoding]::UTF8)
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
    $data = $raw | ConvertFrom-Json
    if ($null -eq $data) { return @() }
    if ($data -is [array]) { return $data }
    return @($data)
  } catch {
    Write-Host "Guestbook read error: $($_.Exception.Message)"
    return @()
  }
}

function Write-Guestbook {
  param($Messages)
  $json = ConvertTo-Json -InputObject @($Messages) -Depth 8
  $temp = $script:guestbookFile + '.tmp'
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($temp, $json, $utf8)
  Move-Item -LiteralPath $temp -Destination $script:guestbookFile -Force
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

    if ($path -eq '/api/messages') {
      try {
        if ($req.HttpMethod -eq 'GET') {
          $all = @(Read-Guestbook)
          $total = $all.Count
          $latest = New-Object System.Collections.ArrayList
          $start = [Math]::Max(0, $total - $maxReturned)
          for ($i = $total - 1; $i -ge $start; $i--) {
            [void]$latest.Add($all[$i])
          }
          Send-Json -Response $res -Status 200 -Payload @{ messages = @($latest.ToArray()); total = $total }
          continue
        }

        if ($req.HttpMethod -eq 'POST') {
          $length = 0
          try { $length = [int]$req.ContentLength64 } catch { $length = 0 }
          if ($length -le 0) {
            Send-Json -Response $res -Status 400 -Payload @{ error = 'bad_json' }
            continue
          }
          if ($length -gt 8192) {
            Send-Json -Response $res -Status 400 -Payload @{ error = 'too_long' }
            continue
          }

          $ip = 'local'
          if ($null -ne $req.RemoteEndPoint) { $ip = $req.RemoteEndPoint.Address.ToString() }
          $now = [DateTime]::UtcNow
          if ($lastPostByIp.ContainsKey($ip)) {
            $elapsed = ($now - $lastPostByIp[$ip]).TotalSeconds
            if ($elapsed -lt $postCooldownSeconds) {
              $retry = [int][Math]::Ceiling($postCooldownSeconds - $elapsed)
              Send-Json -Response $res -Status 429 -Payload @{ error = 'rate_limited'; retryAfter = $retry }
              continue
            }
          }

          $reader = New-Object System.IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
          $body = $reader.ReadToEnd()
          $reader.Dispose()

          $payload = $null
          try {
            $payload = $body | ConvertFrom-Json
          } catch {
            Send-Json -Response $res -Status 400 -Payload @{ error = 'bad_json' }
            continue
          }
          if ($null -eq $payload -or $payload -is [array]) {
            Send-Json -Response $res -Status 400 -Payload @{ error = 'bad_json' }
            continue
          }

          $name = ''
          if ($null -ne $payload.name) { $name = [string]$payload.name }
          $name = $name.Trim()
          $name = [regex]::Replace($name, '[\u0000-\u001F\u007F]', '')
          if ($name.Length -gt $maxNameLength) {
            Send-Json -Response $res -Status 400 -Payload @{ error = 'too_long' }
            continue
          }

          $message = ''
          if ($null -ne $payload.message) { $message = [string]$payload.message }
          $message = $message.Trim()
          $message = [regex]::Replace($message, '[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]', '')
          $message = $message -replace "`r`n", "`n"
          $message = $message -replace "`r", "`n"
          $message = [regex]::Replace($message, "`n{3,}", "`n`n")
          if ($message.Length -eq 0) {
            Send-Json -Response $res -Status 400 -Payload @{ error = 'empty' }
            continue
          }
          if ($message.Length -gt $maxMessageLength) {
            Send-Json -Response $res -Status 400 -Payload @{ error = 'too_long' }
            continue
          }

          $entry = [pscustomobject][ordered]@{
            id = [Guid]::NewGuid().ToString('N').Substring(0, 12)
            name = $name
            message = $message
            createdAt = $now.ToString('o')
          }

          $all = @(Read-Guestbook)
          $all += $entry
          if ($all.Count -gt $maxStored) {
            $all = @($all[($all.Count - $maxStored)..($all.Count - 1)])
          }
          Write-Guestbook -Messages $all
          $lastPostByIp[$ip] = [DateTime]::UtcNow
          Send-Json -Response $res -Status 201 -Payload @{ message = $entry; total = $all.Count }
          continue
        }

        Send-Json -Response $res -Status 405 -Payload @{ error = 'method_not_allowed' }
        continue
      } catch {
        Write-Host "Guestbook API error: $($_.Exception.Message)"
        try { Send-Json -Response $res -Status 500 -Payload @{ error = 'server_error' } } catch {}
        continue
      }
    }

    if ($path -eq '/') { $path = '/index.html' }
    $file = Join-Path $root ($path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar))
    if ($path -eq '/demo.html') {
      $shim = '<script>(function(){var o=window.matchMedia;window.matchMedia=function(q){return /prefers-reduced-motion/.test(q)?{matches:false,media:q,onchange:null,addListener:function(){},removeListener:function(){},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return false}}:o.call(window,q)}})();</script>'
      $shim += '<style>@media (prefers-reduced-motion:reduce){.letter,.hit{animation:letter-bob 2.7s cubic-bezier(.45,0,.55,1) infinite!important;animation-delay:var(--bob-delay,0s)!important}.sticker{display:block!important}}</style>'
      $doc = [IO.File]::ReadAllText((Join-Path $root 'index.html'))
      $doc = $doc -replace '(?=<script[^>]*src="app\.js")', $shim
      $res.ContentType = 'text/html; charset=utf-8'
      $res.Headers.Add('Cache-Control', 'no-store')
      $bytes2 = [Text.Encoding]::UTF8.GetBytes($doc)
      $res.ContentLength64 = $bytes2.Length
      $res.OutputStream.Write($bytes2, 0, $bytes2.Length)
      $res.OutputStream.Close()
      continue
    }
    if (Test-Path -LiteralPath $file -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ct = $types[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $res.ContentType = $ct
      $res.Headers.Add('Cache-Control', 'no-cache')
      $bytes = [IO.File]::ReadAllBytes($file)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $res.ContentLength64 = $msg.Length
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.OutputStream.Close()
  } catch {
    Write-Host "Request error: $($_.Exception.Message)"
    try { $res.OutputStream.Close() } catch {}
  }
}
