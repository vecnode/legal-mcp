param(
  [switch]$CpuOnly,
  [switch]$SkipBrowser
)

$ErrorActionPreference = 'Stop'

Write-Host "=== legal-atlas setup ===" -ForegroundColor Green
Write-Host "Setting up local virtual environment" -ForegroundColor Yellow

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python version: $pythonVersion" -ForegroundColor Cyan
} catch {
    Write-Error "Python is not installed or not in PATH. Please install Python 3.10+ first."
    exit 1
}

# Create virtual environment if it doesn't exist
if (-not (Test-Path .venv)) {
    Write-Host "Creating virtual environment" -ForegroundColor Yellow
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create virtual environment"
        exit 1
    }
} else {
    Write-Host "Virtual environment already exists" -ForegroundColor Green
}

# Activate virtual environment
$venvActivate = Join-Path (Resolve-Path .venv) 'Scripts\Activate.ps1'
Write-Host "Activating virtual environment" -ForegroundColor Yellow
. $venvActivate

# Check if requirements are already installed
if (Test-Path requirements.txt) {
    # Check if key packages are already installed
    try {
        # Check if packages are installed without showing warnings
        $fastapiInstalled = pip show fastapi --disable-pip-version-check 2>$null
        $uvicornInstalled = pip show uvicorn --disable-pip-version-check 2>$null
        $pypdfInstalled = pip show pypdf --disable-pip-version-check 2>$null
        $easyocrInstalled = pip show easyocr --disable-pip-version-check 2>$null
        
        if ($fastapiInstalled -and $uvicornInstalled -and $pypdfInstalled -and $easyocrInstalled) {
            Write-Host "Project requirements already installed, skipping" -ForegroundColor Green
        } else {
            throw "Requirements not found"
        }
    } catch {
        Write-Host "Installing missing project requirements" -ForegroundColor Yellow
        pip install -r requirements.txt
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Some requirements may not have installed properly, continuing"
        } else {
            Write-Host "Requirements installed successfully" -ForegroundColor Green
        }
    }
} else {
    Write-Warning "requirements.txt not found, skipping dependency installation"
}

# Set environment variables
$env:UVICORN_WORKERS = '1'
$env:PYTHONUNBUFFERED = '1'

Write-Host "=== Starting legal-atlas server ===" -ForegroundColor Green

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
    uvicorn app:app --host 127.0.0.1 --port $port --reload
} catch {
    Write-Error "Failed to start server: $_"
    exit 1
}
