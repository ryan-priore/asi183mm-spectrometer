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

# Get the actual user's home directory, even when running with sudo
if [ "$(id -u)" -eq 0 ]; then
    # If running as root, get the original user's home directory
    REAL_USER=$(logname 2>/dev/null || echo ${SUDO_USER:-${USER}})
    REAL_HOME=$(eval echo ~$REAL_USER)
else
    REAL_HOME="$HOME"
fi

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

# Install system dependencies
echo -e "${GREEN}Installing system dependencies...${NC}"
if [ "$(id -u)" -eq 0 ]; then
    apt-get update
    apt-get install -y python3-dev python3-venv
else
    echo -e "${YELLOW}Not running as root, skipping system package installation${NC}"
    echo -e "${YELLOW}If installation fails, run: sudo apt-get install python3-dev python3-venv${NC}"
fi

# Setup virtual environment
echo -e "${GREEN}Setting up Python virtual environment...${NC}"
# Navigate to the project root
cd "$(dirname "$0")/.."

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo -e "${GREEN}Created virtual environment in .venv directory${NC}"
else
    echo -e "${GREEN}Using existing virtual environment in .venv directory${NC}"
fi

# Activate virtual environment
echo -e "${GREEN}Activating virtual environment...${NC}"
source .venv/bin/activate

# Install Python dependencies
echo -e "${GREEN}Installing Python dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

# Extract and install SDK
echo -e "${GREEN}Setting up ZWO ASI SDK...${NC}"
SDK_ARCHIVE="ASI_Camera_SDK/ASI_linux_mac_SDK_V1.36.tar.bz2"
if [ ! -f "$SDK_ARCHIVE" ]; then
    echo -e "${RED}Error: ASI SDK archive not found at $SDK_ARCHIVE${NC}"
    exit 1
fi

TEMP_DIR=$(mktemp -d)
echo -e "${GREEN}Extracting SDK to temporary directory...${NC}"
tar -xf "$SDK_ARCHIVE" -C "$TEMP_DIR"

# Copy library based on architecture
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
    if [ "$(id -u)" -eq 0 ]; then
        cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/armv8/libASICamera2.so.1.36" /usr/local/lib/libASICamera2.so
    else
        sudo cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/armv8/libASICamera2.so.1.36" /usr/local/lib/libASICamera2.so
    fi
elif [ "$ARCH" = "x86_64" ]; then
    if [ "$(id -u)" -eq 0 ]; then
        cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/x64/libASICamera2.so.1.36" /usr/local/lib/libASICamera2.so
    else
        sudo cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/x64/libASICamera2.so.1.36" /usr/local/lib/libASICamera2.so
    fi
elif [ "$ARCH" = "i686" ] || [ "$ARCH" = "i386" ]; then
    if [ "$(id -u)" -eq 0 ]; then
        cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/x86/libASICamera2.so.1.36" /usr/local/lib/libASICamera2.so
    else
        sudo cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/x86/libASICamera2.so.1.36" /usr/local/lib/libASICamera2.so
    fi
elif [[ "$ARCH" == arm* ]]; then
    if [ "$(id -u)" -eq 0 ]; then
        cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/armv7/libASICamera2.so.1.36" /usr/local/lib/libASICamera2.so
    else
        sudo cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/armv7/libASICamera2.so.1.36" /usr/local/lib/libASICamera2.so
    fi
else
    echo -e "${RED}Error: Unsupported architecture: $ARCH${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Install udev rules
if [ "$(id -u)" -eq 0 ]; then
    echo -e "${GREEN}Installing udev rules...${NC}"
    cp "$TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/asi.rules" /lib/udev/rules.d/
    udevadm control --reload-rules
    udevadm trigger
else
    echo -e "${YELLOW}Not running as root, skipping udev rules installation${NC}"
    echo -e "${YELLOW}Install them manually with:${NC}"
    echo -e "${YELLOW}  sudo cp $TEMP_DIR/ASI_linux_mac_SDK_V1.36/lib/asi.rules /lib/udev/rules.d/${NC}"
    echo -e "${YELLOW}  sudo udevadm control --reload-rules${NC}"
    echo -e "${YELLOW}  sudo udevadm trigger${NC}"
fi

# Set USB memory allocation to support the camera
echo -e "${GREEN}Setting USB memory allocation...${NC}"
if [ "$(id -u)" -eq 0 ]; then
    # Immediately set USB memory
    echo 200 > /sys/module/usbcore/parameters/usbfs_memory_mb
    
    # Make the setting persistent by adding to sysctl.conf
    if ! grep -q "fs.usb-storage.usbfs_memory_mb" "/etc/sysctl.conf"; then
        echo "fs.usb-storage.usbfs_memory_mb = 200" >> /etc/sysctl.conf
        echo -e "${GREEN}Added USB memory setting to /etc/sysctl.conf${NC}"
    else
        echo -e "${GREEN}USB memory setting already in sysctl.conf${NC}"
    fi
else
    # If not running as root, display instructions
    echo -e "${YELLOW}Not running as root, cannot set USB memory allocation${NC}"
    echo -e "${YELLOW}Run the following commands to set USB memory:${NC}"
    echo -e "${YELLOW}  sudo sh -c 'echo 200 > /sys/module/usbcore/parameters/usbfs_memory_mb'${NC}"
    echo -e "${YELLOW}  sudo sh -c 'echo \"fs.usb-storage.usbfs_memory_mb = 200\" >> /etc/sysctl.conf'${NC}"
    echo -e "${YELLOW}  sudo sysctl -p${NC}"
fi

# Set up environment
ASI_LIB_PATH="/usr/local/lib/libASICamera2.so"

# Run ldconfig to update library cache
if [ "$(id -u)" -eq 0 ]; then
    ldconfig
else
    sudo ldconfig
fi

# Set environment variable
echo -e "${GREEN}Setting up ZWO_ASI_LIB environment variable...${NC}"

# Set for current session
export ZWO_ASI_LIB="$ASI_LIB_PATH"
echo -e "${GREEN}Set ZWO_ASI_LIB for current session: $ZWO_ASI_LIB${NC}"

# Add to .bashrc if not already present
if ! grep -q "export ZWO_ASI_LIB=" "$REAL_HOME/.bashrc"; then
    # Add a newline and the export statement
    echo '' >> "$REAL_HOME/.bashrc"
    echo '# ZWO ASI Camera SDK Library Path' >> "$REAL_HOME/.bashrc"
    echo "export ZWO_ASI_LIB=$ASI_LIB_PATH" >> "$REAL_HOME/.bashrc"
    
    # Verify the write was successful
    if grep -q "export ZWO_ASI_LIB=$ASI_LIB_PATH" "$REAL_HOME/.bashrc"; then
        echo -e "${GREEN}Successfully added ZWO_ASI_LIB to $REAL_HOME/.bashrc${NC}"
        echo -e "${YELLOW}To apply changes, run: source $REAL_HOME/.bashrc${NC}"
    else
        echo -e "${RED}Failed to write to $REAL_HOME/.bashrc${NC}"
        echo -e "${YELLOW}Please manually add: export ZWO_ASI_LIB=$ASI_LIB_PATH to your ~/.bashrc${NC}"
    fi
else
    echo -e "${GREEN}ZWO_ASI_LIB already set in $REAL_HOME/.bashrc${NC}"
fi

# Verify the library exists
if [ ! -f "$ASI_LIB_PATH" ]; then
    echo -e "${RED}Warning: ASI SDK library not found at $ASI_LIB_PATH${NC}"
    echo -e "${YELLOW}Please ensure the library was copied correctly${NC}"
fi

# Clean up temporary directory
rm -rf "$TEMP_DIR"

# Ask about RPi.GPIO installation
read -p "Do you want to install RPi.GPIO for Raspberry Pi GPIO access? (y/n): " install_gpio
if [[ $install_gpio == "y" || $install_gpio == "Y" ]]; then
    echo -e "${GREEN}Installing RPi.GPIO...${NC}"
    pip install RPi.GPIO
fi

# Create necessary directories
mkdir -p spectra
mkdir -p logs

# Set permissions
chmod +x src/main.py
chmod +x scripts/run_server.sh
chmod +x tests/test_env.py
chmod +x tests/test_camera.py

echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo -e "${GREEN}To run the test script to verify your environment:${NC}"
echo -e "source .venv/bin/activate && python tests/test_env.py"
echo ""
echo -e "${GREEN}To start the spectrometer backend:${NC}"
echo -e "scripts/run_server.sh"
echo ""
echo -e "${GREEN}ZWO ASI SDK library is set to: ${YELLOW}$ZWO_ASI_LIB${NC}"

exit 0 