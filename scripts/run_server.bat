@echo off
:: Script to run the spectrometer API server on Windows

:: Navigate to the project root directory
cd %~dp0\..

:: Check if the virtual environment exists
if not exist .venv (
  echo Error: Virtual environment not found.
  echo Please run the installation script first: scripts\setup_windows.bat
  exit /b 1
)

:: Activate the virtual environment
call .venv\Scripts\activate.bat

:: Check if the SDK path is set
if "%ZWO_ASI_LIB%"=="" (
  echo Warning: ZWO_ASI_LIB environment variable is not set.
  echo The server may not be able to connect to the camera.
  echo.
  
  :: Try to find the library in common locations
  set "ASI_LOCATIONS=C:\Program Files\ZWO\ASI SDK\ASICamera2.dll;C:\ASI_SDK\ASICamera2.dll"
  
  for %%i in (%ASI_LOCATIONS%) do (
    if exist "%%i" (
      set ZWO_ASI_LIB=%%i
      echo Found ASI SDK library at: %%i
      echo Using this library for this session.
      goto :found_sdk
    )
  )
  
  :found_sdk
)

:: Create directories if they don't exist
if not exist spectra mkdir spectra
if not exist logs mkdir logs

:: Default parameters
set HOST=0.0.0.0
set PORT=8000
set DEBUG=0

:: Parse command line arguments
:parse_args
if "%~1"=="" goto :start_server

if "%~1"=="--host" (
  set HOST=%~2
  shift
  shift
  goto :parse_args
)

if "%~1"=="--port" (
  set PORT=%~2
  shift
  shift
  goto :parse_args
)

if "%~1"=="--debug" (
  set DEBUG=1
  shift
  goto :parse_args
)

echo Unknown option: %~1
echo Usage: %0 [--host HOST] [--port PORT] [--debug]
exit /b 1

:start_server
:: Set up log file
set LOG_FILE=logs\server_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%.log
set LOG_FILE=%LOG_FILE: =0%

echo Starting ASI183MM Spectrometer API server...
echo Host: %HOST%
echo Port: %PORT%
echo Log file: %LOG_FILE%

:: Run the server
if %DEBUG%==1 (
  echo Debug mode enabled
  python src\main.py --host "%HOST%" --port "%PORT%" --debug > %LOG_FILE% 2>&1
) else (
  python src\main.py --host "%HOST%" --port "%PORT%" > %LOG_FILE% 2>&1
)

:: Deactivate the virtual environment when done
call deactivate 