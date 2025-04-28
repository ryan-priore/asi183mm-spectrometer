#!/usr/bin/env python3
"""
Test script for the ASI183MM camera module

IMPORTANT: This test requires actual camera hardware to be connected.
Use test_env.py in the project root to verify your environment setup without hardware.
"""
import os
import sys
import logging
import argparse
import time
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

# Add parent directory to path to import camera module
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root / 'src'))

try:
    from camera import ASI183Camera
except ImportError:
    print("ERROR: Could not import camera module.")
    print("Make sure you've installed the project requirements.")
    print("Try running: python test_env.py in the project root first.")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main test function"""
    parser = argparse.ArgumentParser(description='Test ASI183MM camera')
    parser.add_argument('--sdk-path', type=str, default=None,
                        help='Path to ASI SDK library (overrides ZWO_ASI_LIB)')
    parser.add_argument('--save-dir', type=str, default='test_images',
                        help='Directory to save test images')
    parser.add_argument('--exposure', type=int, default=100,
                        help='Exposure time in milliseconds')
    parser.add_argument('--gain', type=int, default=0,
                        help='Gain value')
    
    args = parser.parse_args()
    
    # Set SDK path from arguments if provided
    if args.sdk_path:
        os.environ['ZWO_ASI_LIB'] = args.sdk_path
    
    # Create save directory (use absolute path for clarity)
    save_dir = project_root / args.save_dir
    save_dir.mkdir(exist_ok=True)
    logger.info(f"Saving test results to: {save_dir}")
    
    # Check if ZWO_ASI_LIB is set
    if 'ZWO_ASI_LIB' not in os.environ:
        logger.warning("ZWO_ASI_LIB environment variable not set")
        logger.warning("Please set it to the path of the ASI SDK library file")
        logger.warning("Example: export ZWO_ASI_LIB=/path/to/libASICamera2.so")
    else:
        sdk_path = os.environ['ZWO_ASI_LIB']
        if not os.path.exists(sdk_path):
            logger.warning(f"ASI SDK library not found at: {sdk_path}")
        else:
            logger.info(f"Using ASI SDK library at: {sdk_path}")
    
    # Initialize camera
    try:
        logger.info("Initializing camera...")
        camera = ASI183Camera()
        
        # Connect to camera
        logger.info("Connecting to camera...")
        if not camera.connect():
            logger.error("Failed to connect to camera")
            logger.error("Please check that the camera is properly connected and powered on")
            return 1
            
        # Get camera info
        logger.info("Camera connected successfully")
        camera_info = camera.get_camera_info()
        logger.info(f"Camera: {camera_info['name']}")
        logger.info(f"Max Resolution: {camera_info['max_width']}x{camera_info['max_height']}")
        
        # Set exposure and gain
        camera.set_exposure(args.exposure)
        camera.set_gain(args.gain)
        logger.info(f"Exposure set to {args.exposure}ms, gain set to {args.gain}")
        
        # Take a test image
        logger.info("Capturing raw image...")
        raw_image = camera.capture_raw()
        logger.info(f"Image captured, shape: {raw_image.shape}")
        
        # Save raw data
        np.save(save_dir / 'raw_image.npy', raw_image)
        logger.info(f"Raw data saved to {save_dir / 'raw_image.npy'}")
        
        # Save as image
        fig, ax = plt.subplots(figsize=(10, 8))
        im = ax.imshow(raw_image, cmap='viridis')
        plt.colorbar(im, ax=ax, label='Intensity')
        plt.title(f"ASI183MM Test Image (Exposure: {args.exposure}ms, Gain: {args.gain})")
        plt.savefig(save_dir / 'test_image.png', dpi=300, bbox_inches='tight')
        logger.info(f"Image saved to {save_dir / 'test_image.png'}")
        
        # Take multiple exposures to test stability
        logger.info("Testing multiple exposures...")
        for i in range(5):
            start_time = time.time()
            camera.capture_raw()
            elapsed = time.time() - start_time
            logger.info(f"Capture {i+1}: {elapsed:.3f} seconds")
            
        # Test ROI
        logger.info("Testing ROI...")
        center_y = camera_info['max_height'] // 2
        roi_height = 100
        
        camera.set_roi(
            start_x=0,
            start_y=center_y - roi_height // 2,
            width=camera_info['max_width'],
            height=roi_height,
            binning=1
        )
        
        roi_image = camera.capture_raw()
        logger.info(f"ROI image captured, shape: {roi_image.shape}")
        
        # Save ROI image
        fig, ax = plt.subplots(figsize=(10, 4))
        im = ax.imshow(roi_image, cmap='viridis')
        plt.colorbar(im, ax=ax, label='Intensity')
        plt.title(f"ASI183MM ROI Test (height={roi_height})")
        plt.savefig(save_dir / 'roi_image.png', dpi=300, bbox_inches='tight')
        logger.info(f"ROI image saved to {save_dir / 'roi_image.png'}")
        
        # Get column sum (spectrum-like data)
        spectrum = np.sum(roi_image, axis=0)
        
        # Plot spectrum
        fig, ax = plt.subplots(figsize=(10, 4))
        ax.plot(spectrum)
        ax.set_title("Column Sum (Simulated Spectrum)")
        ax.set_xlabel("Pixel")
        ax.set_ylabel("Intensity (sum)")
        ax.grid(True, alpha=0.3)
        plt.savefig(save_dir / 'simulated_spectrum.png', dpi=300, bbox_inches='tight')
        logger.info(f"Simulated spectrum saved to {save_dir / 'simulated_spectrum.png'}")
        
        # Disconnect from camera
        logger.info("Disconnecting from camera...")
        camera.disconnect()
        logger.info("Test completed successfully")
        
        return 0
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        logger.error("If this is an SDK error, make sure the ASI SDK is properly installed")
        logger.error("and the ZWO_ASI_LIB environment variable is correctly set")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 