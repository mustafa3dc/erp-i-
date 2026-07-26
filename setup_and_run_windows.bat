@echo off
title M MOBILE System Setup & Runner
cd /d "%~dp0"
echo ==============================================
echo   M MOBILE SYSTEM SETUP & RUNNER FOR WINDOWS
echo ==============================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not added to PATH.
    echo Please install Python 3.10+ and make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

if not exist venv (
    echo [1/2] Creating virtual environment...
    python -m venv venv
)

echo [2/2] Installing dependencies...
python -m pip install -r backend\requirements.txt

echo.
echo Starting application...
python run_desktop.py

pause
