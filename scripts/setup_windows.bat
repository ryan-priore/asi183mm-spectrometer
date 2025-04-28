@echo off
echo ASI183MM Spectrometer Backend Setup for Windows
echo =============================================

:: Check if Python is installed
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Python not found! Please install Python 3.7 or newer.
  exit /b 1
)

:: Navigate to project root
cd %~dp0\..

:: Create virtual environment
echo Creating Python virtual environment...
python -m venv .venv

:: Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat

:: Install dependencies
echo Installing Python dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

:: Create directories
echo Creating necessary directories...
if not exist spectra mkdir spectra
if not exist logs mkdir logs

echo.
echo Setup completed successfully!
echo.
echo To verify your environment:
echo   .venv\Scripts\activate.bat
echo   python tests\test_env.py
echo.
echo To start the spectrometer backend, run:
echo   scripts\run_server.bat
echo.
echo Don't forget to set the ZWO_ASI_LIB environment variable:
echo   set ZWO_ASI_LIB=C:\path\to\ASICamera2.dll
echo.

pause 