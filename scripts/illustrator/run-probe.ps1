# Illustrator oracle runner (Phase 6 evidence, see docs/PHASE6_REA_CHECKLIST.md).
#
# Black-box behaviour observation only: it drives the installed application through its own
# ExtendScript automation, records the version with every fixture, and never reads Adobe binaries.
#
#   pwsh -File scripts/illustrator/run-probe.ps1 -Probe point-text
#   pwsh -File scripts/illustrator/run-probe.ps1 -Probe point-text -Out tests/fixtures/illustrator/point-text.json
#
# A modal dialog or a hung instance is killed and retried once, then recorded as a failed probe.

param(
  [Parameter(Mandatory = $true)][string]$Probe,
  [string]$Out = "",
  [int]$TimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$probePath = Join-Path $PSScriptRoot "probes/$Probe.jsx"
if (-not (Test-Path $probePath)) {
  Write-Error "no probe at $probePath"
  exit 1
}
$code = Get-Content -Raw $probePath

function Invoke-Probe {
  $job = Start-Job -ArgumentList $code -ScriptBlock {
    param($jsx)
    $application = New-Object -ComObject Illustrator.Application
    try {
      $name = $application.Name
      $version = $application.Version
      $raw = $application.DoJavaScript($jsx)
      return [pscustomobject]@{ name = $name; version = $version; raw = [string]$raw }
    } finally {
      try { $application.Quit() } catch { }
    }
  }
  $completed = Wait-Job $job -Timeout $TimeoutSeconds
  if (-not $completed) {
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
    Get-Process Illustrator -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    return $null
  }
  $result = Receive-Job $job
  Remove-Job $job -Force -ErrorAction SilentlyContinue
  return $result
}

$result = Invoke-Probe
if ($null -eq $result) {
  Write-Error "probe $Probe timed out after $TimeoutSeconds s; Illustrator was killed"
  $result = Invoke-Probe
  if ($null -eq $result) {
    Write-Error "probe $Probe failed twice"
    exit 2
  }
}

$payload = [ordered]@{
  probe       = $Probe
  recordedAt  = (Get-Date).ToUniversalTime().ToString("o")
  illustrator = [ordered]@{ name = $result.name; version = $result.version }
  # Points, as Illustrator reports them. Consumers convert to CSS pixels (1pt = 4/3px) explicitly.
  raw         = $result.raw
}

if ($Out -ne "") {
  $outPath = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $repoRoot $Out }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outPath) | Out-Null
  $json = $payload | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($outPath, $json, (New-Object System.Text.UTF8Encoding($false)))
  Write-Output "oracle: wrote $outPath (Illustrator $($result.version))"
} else {
  $payload | ConvertTo-Json -Depth 6
}
