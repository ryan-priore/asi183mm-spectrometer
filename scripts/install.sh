#!/bin/bash
# Installation script for ASI183MM Spectrometer

# Exit on error
set -e

# Define colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Installing ASI183MM Spectrometer Backend...${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Python version
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    echo -e "${GREEN}Found Python $PYTHON_VERSION${NC}"
    
    # Check if version is at least 3.7
    MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
    
    if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 7 ]); then
        echo -e "${RED}Error: Python 3.7 or higher is required${NC}"
        exit 1
    fi
else
    echo -e "${RED}Error: Python 3 not found${NC}"
    echo -e "${YELLOW}Please install Python 3.7 or higher${NC}"
    exit 1
fi

# Check pip
if ! command_exists pip3; then
    echo -e "${RED}Error: pip3 not found${NC}"
    echo -e "${YELLOW}Please install pip for Python 3${NC}"
    exit 1
fi

# Check for ZWO ASI SDK
ASI_LIB_PATHS=(
    "/usr/local/lib/libASICamera2.so"
    "/usr/lib/libASICamera2.so"
    "$HOME/ASI_SDK/libASICamera2.so"
)

ASI_LIB_FOUND=false
for path in "${ASI_LIB_PATHS[@]}"; do
    if [ -f "$path" ]; then
        echo -e "${GREEN}Found ASI SDK library at: $path${NC}"
        ASI_LIB_FOUND=true
        
        # Set environment variable
        echo "export ZWO_ASI_LIB=$path" >> ~/.bashrc
        export ZWO_ASI_LIB="$path"
        
        break
    fi
done

if [ "$ASI_LIB_FOUND" = false ]; then
    echo -e "${YELLOW}Warning: ASI SDK library not found in common locations${NC}"
    echo -e "${YELLOW}Please download and install the ZWO ASI SDK from:${NC}"
    echo -e "${YELLOW}https://astronomy-imaging-camera.com/software-drivers${NC}"
    echo -e "${YELLOW}After installation, set the ZWO_ASI_LIB environment variable to the library path${NC}"
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
pip3 install -r ../requirements.txt

# Create necessary directories
mkdir -p ../spectra
mkdir -p ../logs

# Set permissions
chmod +x ../src/main.py

echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo -e "${GREEN}To start the spectrometer backend:${NC}"
echo -e "cd ../src && python3 main.py"
echo ""
echo -e "${GREEN}For help and options:${NC}"
echo -e "python3 main.py --help"
echo ""

if [ "$ASI_LIB_FOUND" = true ]; then
    echo -e "${GREEN}ZWO ASI SDK library is set to: ${YELLOW}$ZWO_ASI_LIB${NC}"
else
    echo -e "${YELLOW}Don't forget to set the ZWO_ASI_LIB environment variable!${NC}"
fi

exit 0 