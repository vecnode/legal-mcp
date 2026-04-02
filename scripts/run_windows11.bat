@echo off
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "run_windows11.ps1"
pause
