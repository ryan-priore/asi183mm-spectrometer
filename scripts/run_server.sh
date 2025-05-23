#!/bin/bash
# Script to run the spectrometer API server

# Navigate to the project root directory
cd "$(dirname "$0")/.."

# Check if the virtual environment exists
if [ ! -d ".venv" ]; then
    echo "Error: Virtual environment not found."
    echo "Please run the installation script first: ./scripts/install.sh"
    exit 1
fi

# Activate the virtual environment
source .venv/bin/activate

# Check if the SDK path is set
if [ -z "$ZWO_ASI_LIB" ]; then
    echo "Warning: ZWO_ASI_LIB environment variable is not set."
    echo "The server may not be able to connect to the camera."
    echo ""
    
    # Try to find the library in common locations
    ASI_LIB_PATHS=(
        "/usr/local/lib/libASICamera2.so"
        "/usr/lib/libASICamera2.so"
        "$HOME/ASI_SDK/libASICamera2.so"
    )
    
    for path in "${ASI_LIB_PATHS[@]}"; do
        if [ -f "$path" ]; then
            export ZWO_ASI_LIB="$path"
            echo "Found ASI SDK library at: $path"
            echo "Using this library for this session."
            break
        fi
    done
fi

# Create directories if they don't exist
mkdir -p spectra
mkdir -p logs

# Default parameters
HOST="0.0.0.0"
PORT="8000"
DEBUG=0

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --host=*)
            HOST="${1#*=}"
            shift
            ;;
        --port=*)
            PORT="${1#*=}"
            shift
            ;;
        --debug)
            DEBUG=1
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--host=HOST] [--port=PORT] [--debug]"
            exit 1
            ;;
    esac
done

# Set up log file
LOG_FILE="logs/server_$(date +%Y%m%d_%H%M%S).log"

echo "Starting ASI183MM Spectrometer API server..."
echo "Host: $HOST"
echo "Port: $PORT"
echo "Log file: $LOG_FILE"

# Run the server
if [ $DEBUG -eq 1 ]; then
    echo "Debug mode enabled"
    python src/main.py --host "$HOST" --port "$PORT" --debug 2>&1 | tee "$LOG_FILE"
else
    python src/main.py --host "$HOST" --port "$PORT" 2>&1 | tee "$LOG_FILE"
fi 

# Deactivate the virtual environment when done
deactivate 