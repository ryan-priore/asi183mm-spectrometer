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
git clone https://github.com/your-username/asi183mm-spectrometer.git
cd asi183mm-spectrometer

# Run the installation script
sudo ./scripts/install.sh
```

### Windows:

```
# Clone the repository
git clone https://github.com/your-username/asi183mm-spectrometer.git
cd asi183mm-spectrometer

# Run the Windows setup script
scripts\setup_windows.bat
```

### Manual Setup (Alternative)

1. Clone this repository:
   ```
   git clone https://github.com/your-username/asi183mm-spectrometer.git
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

4. Set up the ZWO ASI SDK:
   - Download and install the appropriate SDK for your platform from [ZWO's website](https://astronomy-imaging-camera.com/software-drivers)
   - Set the environment variable: 
     ```
     export ZWO_ASI_LIB=/path/to/asi/library.so  # Linux
     # or
     # set ZWO_ASI_LIB=C:\path\to\ASICamera2.dll  # Windows
     ```

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

This test will capture images, test ROI settings, and save sample data to a `test_images` directory.

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
- `config/`: Configuration files
- `docs/`: Documentation
- `tests/`: Test files
  - `test_camera.py`: Tests camera connectivity and image acquisition
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