param(
  [switch]$CpuOnly,
  [switch]$SkipBrowser
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "Syncing uv project (project root: $ProjectRoot)" -ForegroundColor Yellow

# Check if uv is available
try {
    $uvVersion = uv --version 2>&1
    Write-Host "uv version: $uvVersion" -ForegroundColor Cyan
} catch {
    Write-Error "uv is not installed or not in PATH. See https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
}

Write-Host "Running uv sync" -ForegroundColor Yellow
uv sync
if ($LASTEXITCODE -ne 0) {
    Write-Error "uv sync failed"
    exit 1
}
Write-Host "Environment ready" -ForegroundColor Green

# Set environment variables
$env:UVICORN_WORKERS = '1'
$env:PYTHONUNBUFFERED = '1'

Write-Host "=== Starting legal-mcp server ===" -ForegroundColor Green

# Always use port 8000 - kill any existing process on this port
$port = 8000
Write-Host "Using port: $port" -ForegroundColor Green
Write-Host "Server will be available at: http://127.0.0.1:$port" -ForegroundColor Cyan

# Kill any process using port 8000
$portProcesses = netstat -ano | Select-String ":$port " | ForEach-Object {
    if ($_ -match '\s+(\d+)$') {
        $matches[1]
    }
}

if ($portProcesses) {
    Write-Host "Killing existing processes on port $port" -ForegroundColor Yellow
    foreach ($processId in $portProcesses) {
        try {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "Killing process $processId ($($process.ProcessName))" -ForegroundColor Red
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Host "Could not kill process $processId" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 2  # Wait for processes to fully terminate
}

# Start the server directly in this window to see debug output
Write-Host "Starting uvicorn server" -ForegroundColor Yellow
Write-Host "Server will run in this window - you'll see all debug output" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow

# Open browser unless skipped
if (-not $SkipBrowser) {
    Write-Host "Opening browser" -ForegroundColor Yellow
    
    # Try browsers in order of preference
    $browsers = @(
        @{ Name = "Microsoft Edge"; Path = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" },
        @{ Name = "Microsoft Edge"; Path = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe" },
        @{ Name = "Google Chrome"; Path = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" },
        @{ Name = "Google Chrome"; Path = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe" },
        @{ Name = "Mozilla Firefox"; Path = "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe" },
        @{ Name = "Mozilla Firefox"; Path = "${env:ProgramFiles}\Mozilla Firefox\firefox.exe" }
    )
    
    $browserFound = $false
    foreach ($browser in $browsers) {
        if (Test-Path $browser.Path) {
            Write-Host "Opening with $($browser.Name)" -ForegroundColor Cyan
            Start-Process $browser.Path "http://127.0.0.1:$port"
            $browserFound = $true
            break
        }
    }
    
    if (-not $browserFound) {
        Write-Host "No preferred browser found, using default" -ForegroundColor Yellow
        Start-Process "http://127.0.0.1:$port"
    }
}

# Start server directly - this will show all output in this window
try {
    uv run uvicorn app:app --host 127.0.0.1 --port $port --reload
} catch {
    Write-Error "Failed to start server: $_"
    exit 1
}
