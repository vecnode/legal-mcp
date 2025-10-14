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

# Check if PyTorch is already installed
$torchInstalled = pip show torch 2>$null
if ($torchInstalled) {
    Write-Host "PyTorch already installed, skipping" -ForegroundColor Green
} else {
    # Install PyTorch based on CUDA availability
    if ($CpuOnly) {
        Write-Host 'Installing CPU-only PyTorch' -ForegroundColor Yellow
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    } else {
        Write-Host 'Installing CUDA-enabled PyTorch (cu121) for RTX 3090' -ForegroundColor Yellow
        pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install PyTorch"
        exit 1
    }
}

# Check if requirements are already installed
if (Test-Path requirements.txt) {
    # Check if key packages are already installed
    $fastapiInstalled = pip show fastapi 2>$null
    $uvicornInstalled = pip show uvicorn 2>$null
    $pypdfInstalled = pip show pypdf 2>$null
    
    if ($fastapiInstalled -and $uvicornInstalled -and $pypdfInstalled) {
        Write-Host "Project requirements already installed, skipping" -ForegroundColor Green
    } else {
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

# Find an available port starting from 8000
$port = 8000
$maxAttempts = 10
$attempt = 0

do {
    $portInUse = netstat -an | Select-String ":$port"
    if ($portInUse) {
        Write-Host "Port $port is in use, trying next port" -ForegroundColor Yellow
        $port++
        $attempt++
    } else {
        break
    }
} while ($attempt -lt $maxAttempts)

if ($attempt -eq $maxAttempts) {
    Write-Error "Could not find an available port after $maxAttempts attempts"
    exit 1
}

Write-Host "Using port: $port" -ForegroundColor Green
Write-Host "Server will be available at: http://127.0.0.1:$port" -ForegroundColor Cyan

# Start the server first
Write-Host "Starting uvicorn server" -ForegroundColor Yellow
try {
    # Start server in background using Start-Process
    $serverProcess = Start-Process -FilePath "uvicorn" -ArgumentList "app:app --host 127.0.0.1 --port $port --reload" -PassThru -WindowStyle Hidden
    
    # Wait a moment for server to start
    Write-Host "Waiting for server to start" -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Check if server is actually running
    $portCheck = netstat -an | Select-String ":$port"
    if (-not $portCheck) {
        Write-Warning "Server may not have started properly. Trying to open browser anyway..."
    } else {
        Write-Host "Server confirmed running on port $port" -ForegroundColor Green
    }
    
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
    
    # Wait for server process to complete
    Write-Host "Server is running. Press Ctrl+C to stop." -ForegroundColor Green
    Write-Host "Server process ID: $($serverProcess.Id)" -ForegroundColor Cyan
    $serverProcess.WaitForExit()
    
} catch {
    Write-Error "Failed to start server: $_"
    exit 1
}
