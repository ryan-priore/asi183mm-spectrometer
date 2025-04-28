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

1. Clone this repository:
   ```
   git clone https://github.com/your-username/asi183mm-spectrometer.git
   cd asi183mm-spectrometer
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Set up the ZWO ASI SDK:
   - Download and install the appropriate SDK for your platform
   - Set the environment variable: `export ZWO_ASI_LIB=/path/to/asi/library.so`

## Usage

1. Start the backend server:
   ```
   python src/main.py
   ```

2. Access the API at `http://localhost:8000`

## Project Structure

- `src/`: Source code
- `config/`: Configuration files
- `docs/`: Documentation
- `tests/`: Test files
- `scripts/`: Utility scripts

## License

MIT 