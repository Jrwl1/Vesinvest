$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-GitBashPath {
  $candidates = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files\Git\usr\bin\bash.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw "Git Bash not found. Install Git for Windows or update scripts/deploy-prod.ps1."
}

function Convert-ToBashPath {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  $normalized = $PathValue -replace "\\", "/"
  if ($normalized -match "^([A-Za-z]):") {
    $drive = $matches[1].ToLower()
    return "/$drive$($normalized.Substring(2))"
  }
  return $normalized
}

function Get-PlaintextPassphrase {
  if ($env:SSH_KEY_PASSPHRASE) {
    return $env:SSH_KEY_PASSPHRASE
  }

  $secure = Read-Host "SSH key passphrase" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }
}

$gitBash = Get-GitBashPath
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$keyPath = if ($env:DEPLOY_SSH_KEY_PATH) { $env:DEPLOY_SSH_KEY_PATH } else { Join-Path $env:USERPROFILE ".ssh\id_ed25519" }

if (-not (Test-Path $keyPath)) {
  throw "SSH key not found at $keyPath"
}

$askpassPath = Join-Path $env:TEMP ("deploy-askpass-" + [guid]::NewGuid().ToString() + ".sh")
$bootstrapPath = Join-Path $env:TEMP ("deploy-bootstrap-" + [guid]::NewGuid().ToString() + ".sh")
$passphrase = Get-PlaintextPassphrase
$env:SSH_KEY_PASSPHRASE = $passphrase

try {
  Set-Content -Path $askpassPath -Encoding ascii -Value @'
#!/usr/bin/env bash
printf '%s\n' "$SSH_KEY_PASSPHRASE"
'@

  $bashAskpassPath = Convert-ToBashPath -PathValue $askpassPath
  $bashBootstrapPath = Convert-ToBashPath -PathValue $bootstrapPath
  $bashRepoRoot = Convert-ToBashPath -PathValue $repoRoot
  $bashKeyPath = Convert-ToBashPath -PathValue $keyPath

  Set-Content -Path $bootstrapPath -Encoding ascii -Value @"
#!/usr/bin/env bash
set -euo pipefail
ASKPASS_SCRIPT="$bashAskpassPath"
DEPLOY_SSH_KEY_PATH="$bashKeyPath"
REPO_ROOT="$bashRepoRoot"
cleanup() {
  rm -f "$ASKPASS_SCRIPT" >/dev/null 2>&1 || true
  if [ -n "${SSH_AGENT_PID:-}" ]; then
    ssh-agent -k >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
chmod 700 "$ASKPASS_SCRIPT"
cd "$REPO_ROOT"
eval "$(ssh-agent -s)" >/dev/null
SSH_ASKPASS="$ASKPASS_SCRIPT" SSH_ASKPASS_REQUIRE=force DISPLAY=:0 ssh-add "$DEPLOY_SSH_KEY_PATH" </dev/null >/dev/null
bash ./scripts/deploy-prod.sh
"@

  & $gitBash $bashBootstrapPath
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Remove-Item $askpassPath -ErrorAction SilentlyContinue
  Remove-Item $bootstrapPath -ErrorAction SilentlyContinue
  Remove-Item Env:SSH_KEY_PASSPHRASE -ErrorAction SilentlyContinue
}
