# ASI183MM Spectrometer Backend

This project provides a backend control system for a spectrometer based on the ASI183MM camera, designed to run on a Raspberry Pi.

## Features

- Camera control and configuration for the ASI183MM
- Spectrometer data acquisition and processing
- RESTful API for remote control and data access
- Calibration and analysis tools

## Requirements

- Raspberry Pi (3 or newer recommended)
- ASI183MM camera
- ZWO ASI SDK
- Python 3.7+

## Installation

### Linux/Raspberry Pi:

```bash
# Clone the repository
git clone https://github.com/ryan-priore/asi183mm-spectrometer.git
cd asi183mm-spectrometer

# Run the installation script
sudo ./scripts/install.sh
```

### Windows:

```
# Clone the repository
git clone https://github.com/ryan-priore/asi183mm-spectrometer.git
cd asi183mm-spectrometer

# Run the Windows setup script
scripts\setup_windows.bat
```

### Manual Setup (Alternative)

1. Clone this repository:
   ```
   git clone https://github.com/ryan-priore/asi183mm-spectrometer.git
   cd asi183mm-spectrometer
   ```

2. Set up a virtual environment (recommended):
   ```
   # Install Python development headers (required for some dependencies)
   sudo apt-get update
   sudo apt-get install -y python3-dev

   # Create and activate a virtual environment
   python -m venv .venv
   source .venv/bin/activate  # On Linux/Mac
   # or
   # .venv\Scripts\activate   # On Windows
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

   Note: If running on Raspberry Pi and you need GPIO access, install RPi.GPIO separately:
   ```
   pip install RPi.GPIO
   ```

4. Set up the ZWO ASI SDK
   - Visit the official ZWO ASI Developer page: [ZWO SDK Download](https://www.zwoastro.com/software/)
   - Download the latest SDK: [ASI_Camera_SDK.zip](https://dl.zwoastro.com/software?app=DeveloperCameraSdk&platform=windows86&region=Overseas)
   - Extract the SDK
     ```
     unzip ASI_Camera_SDK.zip
     cd ASI_Camera_SDK
     tar -xf ASI_linux_mac_SDK_V1.36.tar.bz2
     cd ASI_linux_mac_SDK_V1.36/lib/
     sudo install asi.rules /lib/udev/rules.d
     ```
   - Copy SDK Files to System Libraries 
     ```
     cd armv8
     sudo cp libASICamera2.so.1.36 /usr/local/lib/libASICamera2.so  # Linux
     ```
   - Update the library cache
     ```
     sudo ldconfig
     export ZWO_ASI_LIB=/usr/local/lib/libASICamera2.so # Linux
     # It is recommended to add the above line to the end of ~/.bashrc file as well
     # or
     # set ZWO_ASI_LIB=C:\path\to\ASICamera2.dll        # Windows
     ```

### Setting up USB permissions (Linux only)

For Linux systems, you'll need to set up udev rules to allow non-root users to access the camera:

```bash
# Copy the udev rules file to the system
sudo cp config/udev/99-asi-cameras.rules /etc/udev/rules.d/

# Reload udev rules and trigger devices
sudo udevadm control --reload-rules && sudo udevadm trigger
```

These rules give non-root users the necessary permissions to access the ASI183MM camera.

## Testing

### Environment Testing (No Hardware Required)

To verify that your Python environment is set up correctly without requiring the camera hardware:

```bash
# Make sure your virtual environment is activated
python tests/test_env.py
```

This will check that all required packages are installed and the environment is configured correctly.

### Camera Testing (Hardware Required)

Once your environment is set up and the camera is connected, you can test the camera functionality:

```bash
# Linux/Raspberry Pi
source .venv/bin/activate
python tests/test_camera.py

# Windows
.venv\Scripts\activate.bat
python tests\test_camera.py
```

This comprehensive test will perform two types of tests:
1. Direct ZWO API test (bypassing the ASI183Camera class)
2. ASI183Camera module test (using the project's camera interface)

The test will capture images, test ROI settings, and save sample data to a `test_images` directory.

> **Note:** Due to limitations in the camera driver, running both tests sequentially may cause the second test to fail. If this happens, run each test separately using the `--direct-only` or `--module-only` flags.

#### Test Options

```bash
# Run only the direct ZWO API test (useful for debugging hardware issues)
python tests/test_camera.py --direct-only

# Run only the ASI183Camera module test
python tests/test_camera.py --module-only

# Set custom exposure (in milliseconds) and gain
python tests/test_camera.py --exposure 500 --gain 100

# Specify custom SDK path
python tests/test_camera.py --sdk-path /path/to/libASICamera2.so

# Run in debug mode with timeout protection and save diagnostic data
python tests/test_camera.py --debug
```

If you don't specify the SDK path, the test will try to find it in common locations or use the `ZWO_ASI_LIB` environment variable.

#### Debug Mode

The test script includes a special debug mode for troubleshooting camera issues. This mode:

- Uses timeout protection to prevent the test from hanging
- Captures only ROI images (avoiding large full-frame images)
- Saves raw data for offline analysis in the `debug/` directory 
- Sets more detailed logging output

It's designed for diagnostic and troubleshooting purposes, especially when the camera is behaving unexpectedly.

## Usage

### Linux/Raspberry Pi:

```bash
# Run the server
./scripts/run_server.sh

# Optional parameters:
./scripts/run_server.sh --host=192.168.1.100 --port=8080 --debug
```

### Windows:

```
# Run the server
scripts\run_server.bat

# Optional parameters:
scripts\run_server.bat --host 192.168.1.100 --port 8080 --debug
```

### API Access

Once the server is running, access the API at:
- http://localhost:8000 (or the configured host:port)
- API documentation: http://localhost:8000/docs

## Project Structure

- `src/`: Source code
  - `main.py`: Main entry point
  - `camera.py`: Camera interface for ASI183MM 
  - `spectrometer.py`: Spectrometer data processing
  - `api.py`: FastAPI REST endpoints
- `config/`: Configuration files
- `docs/`: Documentation
- `tests/`: Test files
  - `test_camera.py`: Comprehensive camera test suite (direct API and module tests)
  - `test_env.py`: Environment verification script (no hardware required)
- `scripts/`: Utility scripts
  - `install.sh`: Linux/Raspberry Pi installation script
  - `setup_windows.bat`: Windows setup script
  - `run_server.sh`: Linux/Raspberry Pi server runner
  - `run_server.bat`: Windows server runner
- `spectra/`: Directory for saved spectrum data
- `logs/`: Log files

## License

MIT 