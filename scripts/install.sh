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

# Check for and install ZWO ASI SDK
echo -e "${GREEN}Checking for ZWO ASI SDK...${NC}"

ASI_LIB_FOUND=false
TMP_DIR=$(mktemp -d)

# First, try to install from the bundled SDK
SDK_ARCHIVE="ASI_Camera_SDK/ASI_linux_mac_SDK_V1.36.tar.bz2"
if [ -f "$SDK_ARCHIVE" ]; then
    echo -e "${GREEN}Found bundled ASI SDK archive. Extracting...${NC}"
    
    # Check if tar command exists
    if command_exists tar; then
        # Extract the SDK to the temporary directory
        tar -xjf "$SDK_ARCHIVE" -C "$TMP_DIR"
        
        # Check if extraction was successful
        if [ $? -eq 0 ]; then
            # Check platform and architecture
            PLATFORM=$(uname)
            ARCH=$(uname -m)
            
            # Determine the appropriate library path
            if [ "$PLATFORM" = "Linux" ]; then
                if [ "$ARCH" = "x86_64" ]; then
                    LIB_DIR="$TMP_DIR/lib/x64"
                elif [ "$ARCH" = "i686" ] || [ "$ARCH" = "i386" ]; then
                    LIB_DIR="$TMP_DIR/lib/x86"
                elif [[ "$ARCH" == arm* ]] || [[ "$ARCH" == aarch64* ]]; then
                    # For ARM architectures (Raspberry Pi, etc)
                    if [ "$ARCH" = "aarch64" ]; then
                        LIB_DIR="$TMP_DIR/lib/armv8"
                    else
                        LIB_DIR="$TMP_DIR/lib/armv7"
                    fi
                fi
                
                # Library and target names
                if [ "$PLATFORM" = "Linux" ]; then
                    LIB_NAME="libASICamera2.so.1.36"
                    TARGET_LIB="/usr/local/lib/libASICamera2.so"
                elif [ "$PLATFORM" = "Darwin" ]; then
                    LIB_DIR="$TMP_DIR/lib/mac"
                    LIB_NAME="libASICamera2.dylib"
                    TARGET_LIB="/usr/local/lib/libASICamera2.dylib"
                fi
                
                if [ -f "$LIB_DIR/$LIB_NAME" ]; then
                    echo -e "${GREEN}Found ASI SDK library at: $LIB_DIR/$LIB_NAME${NC}"
                    
                    # Install udev rules if Linux
                    if [ "$PLATFORM" = "Linux" ] && [ -f "$TMP_DIR/lib/asi.rules" ]; then
                        echo -e "${GREEN}Installing udev rules for camera access...${NC}"
                        if [ "$(id -u)" -eq 0 ]; then
                            cp "$TMP_DIR/lib/asi.rules" /lib/udev/rules.d/
                            echo -e "${GREEN}Copied asi.rules to /lib/udev/rules.d/${NC}"
                        else
                            echo -e "${YELLOW}Not running as root, skipping udev rules installation${NC}"
                            echo -e "${YELLOW}You can install them manually with:${NC}"
                            echo -e "${YELLOW}  sudo cp $TMP_DIR/lib/asi.rules /lib/udev/rules.d/${NC}"
                        fi
                    fi
                    
                    # Copy library to system location
                    if [ "$(id -u)" -eq 0 ]; then
                        cp "$LIB_DIR/$LIB_NAME" "$TARGET_LIB"
                        echo -e "${GREEN}Copied $LIB_NAME to $TARGET_LIB${NC}"
                        
                        # Update library cache if on Linux
                        if [ "$PLATFORM" = "Linux" ]; then
                            ldconfig
                            echo -e "${GREEN}Updated library cache with ldconfig${NC}"
                        fi
                        
                        # Set environment variable
                        export ZWO_ASI_LIB="$TARGET_LIB"
                        echo "export ZWO_ASI_LIB=$TARGET_LIB" >> ~/.bashrc
                        echo -e "${GREEN}Set ZWO_ASI_LIB environment variable to $TARGET_LIB${NC}"
                        echo -e "${GREEN}Added ZWO_ASI_LIB to ~/.bashrc${NC}"
                        
                        ASI_LIB_FOUND=true
                    else
                        echo -e "${YELLOW}Not running as root, skipping library installation${NC}"
                        echo -e "${YELLOW}To install the ASI Camera SDK manually:${NC}"
                        echo -e "${YELLOW}  1. Copy $LIB_DIR/$LIB_NAME to $TARGET_LIB:${NC}"
                        echo -e "${YELLOW}     sudo cp $LIB_DIR/$LIB_NAME $TARGET_LIB${NC}"
                        echo -e "${YELLOW}  2. Update library cache:${NC}"
                        echo -e "${YELLOW}     sudo ldconfig${NC}"
                        echo -e "${YELLOW}  3. Set environment variable:${NC}"
                        echo -e "${YELLOW}     export ZWO_ASI_LIB=$TARGET_LIB${NC}"
                        echo -e "${YELLOW}     echo \"export ZWO_ASI_LIB=$TARGET_LIB\" >> ~/.bashrc${NC}"
                    fi
                else
                    echo -e "${YELLOW}Could not find appropriate library for your system in the extracted SDK${NC}"
                fi
            fi
        else
            echo -e "${RED}Failed to extract ASI SDK archive${NC}"
        fi
    else
        echo -e "${RED}The 'tar' command is not available. Cannot extract the SDK.${NC}"
    fi
else
    echo -e "${YELLOW}ASI SDK archive not found in ASI_Camera_SDK folder${NC}"
fi

# Clean up temporary directory
rm -rf "$TMP_DIR"

# If SDK was not found or installation failed, check common system paths
if [ "$ASI_LIB_FOUND" = false ]; then
    ASI_LIB_PATHS=(
        "/usr/local/lib/libASICamera2.so"
        "/usr/lib/libASICamera2.so"
        "$HOME/ASI_SDK/libASICamera2.so"
    )

    for path in "${ASI_LIB_PATHS[@]}"; do
        if [ -f "$path" ]; then
            echo -e "${GREEN}Found ASI SDK library at: $path${NC}"
            ASI_LIB_FOUND=true
            
            # Set environment variable
            export ZWO_ASI_LIB="$path"
            echo "export ZWO_ASI_LIB=$path" >> ~/.bashrc
            echo -e "${GREEN}Set ZWO_ASI_LIB environment variable to $path${NC}"
            echo -e "${GREEN}Added ZWO_ASI_LIB to ~/.bashrc${NC}"
            
            break
        fi
    done
fi

# If still not found, inform the user
if [ "$ASI_LIB_FOUND" = false ]; then
    echo -e "${YELLOW}Warning: ASI SDK library not found${NC}"
    echo -e "${YELLOW}Please download and install the ZWO ASI SDK from:${NC}"
    echo -e "${YELLOW}https://astronomy-imaging-camera.com/software-drivers${NC}"
    echo -e "${YELLOW}After installation, set the ZWO_ASI_LIB environment variable to the library path${NC}"
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

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

# Add a section for udev rules installation
install_udev_rules() {
    echo "Installing udev rules for camera access..."
    
    # Check if we're running as root (needed for udev rules)
    if [ "$EUID" -ne 0 ]; then
        echo "Skipping udev rules installation - not running as root"
        echo "You can install them manually with:"
        echo "  sudo cp config/udev/99-asi-cameras.rules /etc/udev/rules.d/"
        echo "  sudo udevadm control --reload-rules && sudo udevadm trigger"
        return
    fi
    
    # Copy rules file
    cp config/udev/99-asi-cameras.rules /etc/udev/rules.d/
    
    # Reload rules and trigger
    udevadm control --reload-rules
    udevadm trigger
    
    echo "udev rules installed successfully"
}

# Add this function call to the appropriate place in the script, 
# likely after SDK installation but before finishing
install_udev_rules

echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo -e "${GREEN}To run the test script to verify your environment:${NC}"
echo -e "source .venv/bin/activate && python tests/test_env.py"
echo ""
echo -e "${GREEN}To start the spectrometer backend:${NC}"
echo -e "scripts/run_server.sh"
echo ""

if [ "$ASI_LIB_FOUND" = true ]; then
    echo -e "${GREEN}ZWO ASI SDK library is set to: ${YELLOW}$ZWO_ASI_LIB${NC}"
else
    echo -e "${YELLOW}Don't forget to set the ZWO_ASI_LIB environment variable!${NC}"
fi

exit 0 