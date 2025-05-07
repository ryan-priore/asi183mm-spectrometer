 #!/usr/bin/env python3
"""Simple test script for the ASI183MM camera module"""
import os
import sys
import argparse
from pathlib import Path

# Add parent directory to path to import camera module
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root / 'src'))

def test_camera(sdk_path: str):
    """Test basic camera functionality"""
    try:
        from camera import ASI183Camera
    except ImportError as e:
        print(f"✗ Failed to import camera module: {e}")
        return False

    camera = None
    try:
        # Initialize camera
        print("\nInitializing camera...")
        camera = ASI183Camera(sdk_path=sdk_path)
        
        # Connect to camera
        print("Connecting to camera...")
        if not camera.connect():
            print("✗ Failed to connect to camera")
            return False
            
        # Get camera info
        camera_info = camera.get_camera_info()
        print(f"✓ Camera: {camera_info['name']}")
        print(f"✓ Resolution: {camera_info['max_width']}x{camera_info['max_height']}")
        
        # Test basic settings
        print("\nTesting camera settings...")
        camera.set_exposure(100)  # 100ms exposure
        print("✓ Set exposure to 100ms")
        camera.set_gain(0)  # 0 gain
        print("✓ Set gain to 0")
        
        # Test image capture
        print("\nTesting image capture...")
        image = camera.capture_raw()
        print(f"✓ Captured image: {image.shape}")
        
        # Clean up
        print("\nCleaning up...")
        camera.disconnect()
        print("✓ Camera disconnected")
        
        return True
        
    except Exception as e:
        print(f"✗ Test error: {e}")
        if camera:
            try:
                camera.disconnect()
            except:
                pass
        return False

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Test ASI183MM camera functionality")
    parser.add_argument('--sdk-path', type=str, default=None, 
                       help="Path to ZWO ASI SDK library (.so or .dll)")
    args = parser.parse_args()
    
    # Find SDK path if not provided
    sdk_path = args.sdk_path
    if not sdk_path:
        sdk_path = os.getenv('ZWO_ASI_LIB')
    
    if not sdk_path or not os.path.exists(sdk_path):
        print("✗ SDK library not found. Please provide the --sdk-path argument or set ZWO_ASI_LIB environment variable.")
        return 1
    
    # Run test
    print("\nStarting camera test...")
    success = test_camera(sdk_path)
    
    # Print summary
    print("\n--- TEST SUMMARY ---")
    status = "SUCCESS" if success else "FAILED"
    print(f"Camera Test: {status}")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())