@echo off
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "run.ps1"
pause
