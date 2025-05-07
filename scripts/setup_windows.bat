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

:: Check for ZWO ASI SDK
echo Checking for ZWO ASI SDK...

set SDK_ARCHIVE=ASI_Camera_SDK\ASI_Windows_SDK_V1.36.zip
set ASI_LIB_FOUND=false
set TEMP_DIR=%TEMP%\ASI_SDK_TEMP

if exist "%SDK_ARCHIVE%" (
  echo Found bundled ASI SDK archive.
  echo.
  echo The ASI Camera SDK needs to be installed to operate the camera.
  echo.
  echo Available installation options:
  echo 1. Manual installation (recommended)
  echo 2. Temporary extraction for this session only
  echo.
  
  set /p INSTALL_OPTION="Select installation method (1 or 2): "
  
  if "%INSTALL_OPTION%"=="1" (
    echo.
    echo Manual Installation Steps:
    echo 1. Extract the file %SDK_ARCHIVE% using Windows Explorer or a tool like 7-Zip
    echo 2. For 64-bit systems, copy ASICamera2.dll from the x64 folder to C:\Windows\System32
    echo    For 32-bit systems, copy ASICamera2.dll from the x86 folder to C:\Windows\System32
    echo 3. Restart your application
    echo.
    echo After installation, you need to set the ZWO_ASI_LIB environment variable:
    echo   set ZWO_ASI_LIB=C:\Windows\System32\ASICamera2.dll
    echo.
    
    set /p MANUAL_CONFIRM="Press Enter after you've completed these steps or Ctrl+C to cancel..."
    echo Continuing setup...
    
    :: Check common system locations
    if exist "C:\Windows\System32\ASICamera2.dll" (
      echo Found ASI SDK library at: C:\Windows\System32\ASICamera2.dll
      set ASI_LIB_FOUND=true
      set ZWO_ASI_LIB=C:\Windows\System32\ASICamera2.dll
      setx ZWO_ASI_LIB "C:\Windows\System32\ASICamera2.dll" >nul
      echo ZWO_ASI_LIB environment variable has been set to: %ZWO_ASI_LIB%
    ) else (
      echo ASICamera2.dll not found in system directory. Please check installation.
    )
    
  ) else if "%INSTALL_OPTION%"=="2" (
    echo Extracting SDK to temporary location...
    
    :: Create temp directory
    if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
    mkdir "%TEMP_DIR%"
    
    :: Check if PowerShell is available
    powershell -Command "exit" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
      :: Extract the SDK using PowerShell
      powershell -Command "Expand-Archive -Path '%SDK_ARCHIVE%' -DestinationPath '%TEMP_DIR%' -Force"
      
      if %ERRORLEVEL% equ 0 (
        :: Check architecture to determine correct DLL
        if exist "%PROGRAMFILES(X86)%" (
          set ARCH=x64
        ) else (
          set ARCH=x86
        )
        
        :: Set the path to the library
        set LIB_PATH=%TEMP_DIR%\ASI_Windows_SDK_V1.36\%ARCH%\ASICamera2.dll
        
        if exist "%LIB_PATH%" (
          echo Found ASI SDK library at: %LIB_PATH%
          echo Note: This is a temporary setup and will be lost when you restart your computer.
          echo For permanent installation, please follow the manual instructions.
          echo.
          
          set ASI_LIB_FOUND=true
          set ZWO_ASI_LIB=%LIB_PATH%
          setx ZWO_ASI_LIB "%LIB_PATH%" >nul
          
          echo ZWO_ASI_LIB environment variable has been set to: %ZWO_ASI_LIB%
        ) else (
          echo Could not find appropriate library for your system in the extracted SDK.
        )
      ) else (
        echo Failed to extract ASI SDK archive.
      )
    ) else (
      echo PowerShell not available. Cannot extract the SDK.
      echo Please follow the manual installation instructions.
    )
  ) else (
    echo Invalid option selected.
  )
) else (
  echo ASI SDK archive not found in ASI_Camera_SDK folder.
)

:: If SDK was not found, check common paths
if "%ASI_LIB_FOUND%"=="false" (
  echo Checking for ASI SDK in common system locations...
  
  :: List of common SDK locations
  set PATHS=C:\Windows\System32\ASICamera2.dll;C:\Program Files\ZWO\ASI SDK\ASICamera2.dll;C:\Program Files (x86)\ZWO\ASI SDK\ASICamera2.dll
  
  for %%p in (%PATHS%) do (
    if exist "%%p" (
      echo Found ASI SDK library at: %%p
      set ASI_LIB_FOUND=true
      
      :: Set environment variable for current process
      set ZWO_ASI_LIB=%%p
      
      :: Set environment variable permanently
      setx ZWO_ASI_LIB "%%p" >nul
      
      echo ZWO_ASI_LIB environment variable has been set to: %%p
      goto :found
    )
  )
  
  :found
)

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

if "%ASI_LIB_FOUND%"=="true" (
  echo ZWO ASI SDK library is set to: %ZWO_ASI_LIB%
) else (
  echo Warning: ASI SDK library not found.
  echo.
  echo Please follow these steps to install the ZWO ASI SDK:
  echo 1. Extract the file %SDK_ARCHIVE% using Windows Explorer or a tool like 7-Zip
  echo 2. For 64-bit systems, copy ASICamera2.dll from the x64 folder to C:\Windows\System32
  echo    For 32-bit systems, copy ASICamera2.dll from the x86 folder to C:\Windows\System32
  echo 3. Restart your application
  echo.
  echo After installation, set the ZWO_ASI_LIB environment variable:
  echo   set ZWO_ASI_LIB=C:\Windows\System32\ASICamera2.dll
)
echo.

pause 