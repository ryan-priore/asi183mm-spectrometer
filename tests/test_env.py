#!/usr/bin/env python3
"""
Test script to verify that the Python environment is properly set up.
This script doesn't require the ASI camera to be connected.
"""
import sys
import os
import platform
from pathlib import Path

# Add the project root to path to help with imports
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

def check_package(package_name):
    """Check if a package is installed and return its version"""
    try:
        package = __import__(package_name)
        try:
            return package.__version__
        except AttributeError:
            return "installed (version unknown)"
    except ImportError:
        return None

def main():
    """Main function to test the environment"""
    print(f"Python version: {platform.python_version()}")
    print(f"Python executable: {sys.executable}")
    print(f"Running on: {platform.system()} {platform.release()}")
    print()
    
    # Check for virtual environment
    in_venv = sys.prefix != sys.base_prefix
    print(f"Running in virtual environment: {'Yes' if in_venv else 'No'}")
    
    # Check for ZWO ASI SDK
    asi_lib = os.getenv('ZWO_ASI_LIB')
    print(f"ZWO_ASI_LIB environment variable: {'Set to ' + asi_lib if asi_lib else 'Not set'}")
    if asi_lib:
        print(f"ASI SDK file exists: {'Yes' if os.path.exists(asi_lib) else 'No'}")
    
    print("\nChecking required packages:")
    packages = [
        "numpy", "scipy", "fastapi", "uvicorn", "pydantic", 
        "plotly", "zwoasi", "PIL"
    ]
    
    all_good = True
    for pkg in packages:
        version = check_package(pkg)
        if version:
            print(f"✓ {pkg}: {version}")
        else:
            print(f"✗ {pkg}: Not installed")
            all_good = False
    
    # Check for RPi.GPIO if on Raspberry Pi
    if platform.system() == "Linux" and os.path.exists("/proc/device-tree/model"):
        with open("/proc/device-tree/model") as f:
            model = f.read()
        if "Raspberry Pi" in model:
            version = check_package("RPi.GPIO")
            if version:
                print(f"✓ RPi.GPIO: {version}")
            else:
                print(f"✗ RPi.GPIO: Not installed (required for GPIO access)")
                all_good = False
    
    # Check for project structure
    print("\nChecking project structure:")
    src_dir = project_root / 'src'
    required_files = [
        src_dir / 'main.py',
        src_dir / 'camera.py',
        src_dir / 'spectrometer.py',
        src_dir / 'api.py',
        project_root / 'requirements.txt'
    ]
    
    for file_path in required_files:
        if file_path.exists():
            print(f"✓ {file_path.relative_to(project_root)}: Found")
        else:
            print(f"✗ {file_path.relative_to(project_root)}: Missing")
            all_good = False
    
    print("\nEnvironment test completed.")
    if all_good:
        print("All required packages and files are installed!")
        return 0
    else:
        print("Some packages or files are missing. Please check the requirements.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 