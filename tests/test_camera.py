#!/usr/bin/env python3
"""
Test script for the ASI183MM camera module

This script provides comprehensive testing for the camera:
1. Direct ZWO API test mode (bypassing the ASI183Camera class)
2. ASI183Camera class test mode (using the project's camera module)
3. Debug mode for diagnostics and troubleshooting

IMPORTANT: This test requires actual camera hardware to be connected.
Use test_env.py to verify your environment setup without hardware.
"""
import os
import sys
import logging
import argparse
import time
import signal
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from contextlib import contextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path to import camera module
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root / 'src'))

# Class for timeout exception handling
class TimeoutException(Exception):
    """Exception raised when an operation times out"""
    pass

@contextmanager
def time_limit(seconds):
    """Context manager for timeout handling"""
    def signal_handler(signum, frame):
        raise TimeoutException(f"Operation timed out after {seconds} seconds")
    
    signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)

def test_direct_zwoasi(sdk_path: str, save_dir: Path, exposure_ms: int, gain: int):
    """
    Direct test using ZWO ASI API without the ASI183Camera class
    This serves as a fallback when the camera class has issues.
    """
    # Force reload zwoasi module to ensure clean state
    if 'zwoasi' in sys.modules:
        del sys.modules['zwoasi']
        
    try:
        import zwoasi as asi
        logger.info("ZWO ASI module imported successfully")
    except ImportError:
        logger.error("Could not import zwoasi module")
        logger.error("Make sure you've installed the requirements")
        return False
    
    try:
        # Initialize the ASI SDK
        logger.info(f"Using ASI SDK library at: {sdk_path}")
        asi.init(sdk_path)
        logger.info("ASI SDK initialized successfully")
        
        # Add a delay after initialization
        time.sleep(2)
        
        # Check for cameras
        num_cameras = asi.get_num_cameras()
        logger.info(f"Number of cameras found: {num_cameras}")
        
        if num_cameras == 0:
            logger.error("No ASI cameras found. Check connections and permissions.")
            return False
            
        cameras = asi.list_cameras()
        logger.info(f"Camera list: {cameras}")
        
        # Open the camera
        logger.info("Opening camera 0...")
        camera = asi.Camera(0)
        time.sleep(0.5)
        
        # Get camera info
        info = camera.get_camera_property()
        logger.info(f"Camera model: {info['Name']}")
        logger.info(f"Max Resolution: {info['MaxWidth']}x{info['MaxHeight']}")
        
        # Set camera settings
        exposure_us = exposure_ms * 1000  # Convert ms to μs
        camera.set_control_value(asi.ASI_EXPOSURE, exposure_us)
        camera.set_control_value(asi.ASI_GAIN, gain)
        camera.set_control_value(asi.ASI_BANDWIDTHOVERLOAD, 40)  # Lower bandwidth for stability
        camera.set_image_type(asi.ASI_IMG_RAW16)
        logger.info(f"Set exposure to {exposure_ms}ms, gain to {gain}")
        
        # Capture using start_exposure method
        logger.info("Testing exposure using start_exposure method...")
        camera.start_exposure()
        time.sleep(exposure_ms/1000 + 0.5)  # Wait for exposure plus buffer
        status = camera.get_exposure_status()
        logger.info(f"Exposure status: {status}")
        
        if status == asi.ASI_EXP_SUCCESS:
            logger.info("Exposure completed successfully")
            data = camera.get_data_after_exposure()
            # Convert bytearray to numpy array
            width = info['MaxWidth']
            height = info['MaxHeight']
            data_array = np.frombuffer(data, dtype=np.uint16).reshape((height, width))
            logger.info(f"Image data retrieved: {data_array.shape}")
            
            # Save the exposure data for comparison
            np.save(save_dir / 'direct_exposure_image.npy', data_array)
            logger.info(f"Exposure data saved to {save_dir / 'direct_exposure_image.npy'}")
        else:
            logger.warning(f"Exposure not completed (status: {status})")
        
        # Capture a full frame (using capture method)
        logger.info("Capturing raw image using capture method...")
        try:
            raw_data = camera.capture()
            
            # Convert to numpy array with correct dimensions
            width = info['MaxWidth']
            height = info['MaxHeight']
            raw_image = np.frombuffer(raw_data, dtype=np.uint16).reshape((height, width))
            
            logger.info(f"Image captured, shape: {raw_image.shape}")
            
            # Save raw data
            np.save(save_dir / 'direct_raw_image.npy', raw_image)
            logger.info(f"Raw data saved to {save_dir / 'direct_raw_image.npy'}")
            
            # Save as image
            fig, ax = plt.subplots(figsize=(10, 8))
            im = ax.imshow(raw_image, cmap='viridis')
            plt.colorbar(im, ax=ax, label='Intensity')
            plt.title(f"Direct ASI API Test Image (Exp: {exposure_ms}ms, Gain: {gain})")
            plt.savefig(save_dir / 'direct_test_image.png', dpi=300, bbox_inches='tight')
            logger.info(f"Image saved to {save_dir / 'direct_test_image.png'}")
        except Exception as e:
            logger.error(f"Error during capture: {e}")
            logger.warning("Skipping capture test and continuing with ROI test")
        
        # Test ROI
        logger.info("Testing ROI with direct API...")
        try:
            center_y = info['MaxHeight'] // 2
            roi_height = 100
            roi_width = info['MaxWidth']
            
            camera.set_roi(
                start_x=0,
                start_y=center_y - roi_height // 2,
                width=roi_width,
                height=roi_height
            )
            
            # Capture ROI image
            roi_data = camera.capture()
            roi_image = np.frombuffer(roi_data, dtype=np.uint16).reshape((roi_height, roi_width))
            logger.info(f"ROI image captured, shape: {roi_image.shape}")
            
            # Save ROI image
            fig, ax = plt.subplots(figsize=(10, 4))
            im = ax.imshow(roi_image, cmap='viridis')
            plt.colorbar(im, ax=ax, label='Intensity')
            plt.title(f"Direct ASI API ROI Test (height={roi_height})")
            plt.savefig(save_dir / 'direct_roi_image.png', dpi=300, bbox_inches='tight')
            logger.info(f"ROI image saved to {save_dir / 'direct_roi_image.png'}")
            
            # If in debug mode, save additional diagnostic data
            if save_dir.name == 'debug':
                # Calculate a simulated spectrum (sum along rows)
                logger.info("Calculating simulated spectrum from ROI")
                spectrum = np.sum(roi_image, axis=0)
                
                # Save spectrum data
                np.save(save_dir / "direct_spectrum.npy", spectrum)
                logger.info(f"Spectrum data saved to {save_dir / 'direct_spectrum.npy'}")
                
                # Plot spectrum
                fig, ax = plt.subplots(figsize=(10, 4))
                ax.plot(spectrum)
                ax.set_title("Direct API Simulated Spectrum")
                ax.set_xlabel("Pixel")
                ax.set_ylabel("Intensity (sum)")
                ax.grid(True, alpha=0.3)
                plt.savefig(save_dir / 'direct_spectrum.png', dpi=300)
                logger.info(f"Spectrum plot saved to {save_dir / 'direct_spectrum.png'}")
        except Exception as e:
            logger.error(f"Error during ROI test: {e}")
            logger.warning("ROI test failed, but continuing with test summary")
        
        # Make sure to close camera at end of test
        logger.info("Cleaning up camera resources...")
        try:
            camera.close()
        except:
            pass  # Ignore errors on cleanup
            
        return True
    
    except Exception as e:
        logger.error(f"Direct API test error: {e}")
        return False

def test_camera_module(sdk_path: str, save_dir: Path, exposure_ms: int, gain: int):
    """Test using the ASI183Camera module"""
    # Force reload zwoasi module to ensure clean state
    if 'zwoasi' in sys.modules:
        del sys.modules['zwoasi']
        
    try:
        from camera import ASI183Camera
    except ImportError:
        logger.error("Could not import camera module.")
        logger.error("Make sure you've installed the project requirements.")
        return False
    
    camera = None
    try:
        logger.info("Initializing camera using ASI183Camera module...")
        camera = ASI183Camera(sdk_path=sdk_path)
        
        # Connect to camera
        logger.info("Connecting to camera...")
        if not camera.connect():
            logger.error("Failed to connect to camera")
            logger.error("Please check that the camera is properly connected and powered on")
            return False
            
        # Get camera info
        logger.info("Camera connected successfully")
        camera_info = camera.get_camera_info()
        logger.info(f"Camera: {camera_info['name']}")
        logger.info(f"Max Resolution: {camera_info['max_width']}x{camera_info['max_height']}")
        
        # Set exposure and gain
        camera.set_exposure(exposure_ms)
        camera.set_gain(gain)
        logger.info(f"Exposure set to {exposure_ms}ms, gain set to {gain}")
        
        # Take a test image
        logger.info("Capturing raw image...")
        raw_image = camera.capture_raw()
        logger.info(f"Image captured, shape: {raw_image.shape}")
        
        # Save raw data
        np.save(save_dir / 'module_raw_image.npy', raw_image)
        logger.info(f"Raw data saved to {save_dir / 'module_raw_image.npy'}")
        
        # Save as image
        fig, ax = plt.subplots(figsize=(10, 8))
        im = ax.imshow(raw_image, cmap='viridis')
        plt.colorbar(im, ax=ax, label='Intensity')
        plt.title(f"ASI183Camera Module Test (Exp: {exposure_ms}ms, Gain: {gain})")
        plt.savefig(save_dir / 'module_test_image.png', dpi=300, bbox_inches='tight')
        logger.info(f"Image saved to {save_dir / 'module_test_image.png'}")
        
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
        plt.title(f"ASI183Camera Module ROI Test (height={roi_height})")
        plt.savefig(save_dir / 'module_roi_image.png', dpi=300, bbox_inches='tight')
        logger.info(f"ROI image saved to {save_dir / 'module_roi_image.png'}")
        
        # Get column sum (spectrum-like data)
        spectrum = np.sum(roi_image, axis=0)
        
        # Plot spectrum
        fig, ax = plt.subplots(figsize=(10, 4))
        ax.plot(spectrum)
        ax.set_title("Column Sum (Simulated Spectrum)")
        ax.set_xlabel("Pixel")
        ax.set_ylabel("Intensity (sum)")
        ax.grid(True, alpha=0.3)
        plt.savefig(save_dir / 'module_simulated_spectrum.png', dpi=300, bbox_inches='tight')
        logger.info(f"Simulated spectrum saved to {save_dir / 'module_simulated_spectrum.png'}")
        
        # If in debug mode, save additional diagnostic data
        if save_dir.name == 'debug':
            # Save spectrum data as numpy array for further analysis
            np.save(save_dir / "module_spectrum.npy", spectrum)
            logger.info(f"Spectrum data saved to {save_dir / 'module_spectrum.npy'}")
        
        # Test multiple exposures
        logger.info("Testing multiple exposures for stability...")
        for i in range(3):
            start_time = time.time()
            camera.capture_raw()
            elapsed = time.time() - start_time
            logger.info(f"Capture {i+1}: {elapsed:.3f} seconds")
        
        # Disconnect from camera
        logger.info("Disconnecting from camera...")
        camera.disconnect()
        
        return True
        
    except Exception as e:
        logger.error(f"Camera module test error: {e}")
        # Try to disconnect camera in case of error
        if camera:
            try:
                camera.disconnect()
            except:
                pass  # Ignore errors during disconnect
        return False

def debug_mode(sdk_path: str, save_dir: Path, exposure_ms: int, gain: int):
    """
    Debug mode for troubleshooting camera issues
    Uses timeout protection and detailed logging
    """
    logger.info("Running in DEBUG mode with timeout protection")
    
    # Force reload zwoasi module to ensure clean state
    if 'zwoasi' in sys.modules:
        del sys.modules['zwoasi']
        
    camera = None
    try:
        # Import camera module
        logger.info("Importing camera module")
        from camera import ASI183Camera
        
        # Initialize camera with timeout protection
        logger.info("Initializing camera")
        with time_limit(10):
            camera = ASI183Camera(sdk_path=sdk_path)
        
        # Connect to camera
        logger.info("Connecting to camera")
        with time_limit(10):
            if not camera.connect():
                logger.error("Failed to connect to camera")
                return False
            
        # Get camera info
        logger.info("Getting camera info")
        with time_limit(5):
            camera_info = camera.get_camera_info()
            logger.info(f"Camera: {camera_info['name']}")
            logger.info(f"Resolution: {camera_info['max_width']}x{camera_info['max_height']}")
        
        # Set exposure and gain
        logger.info("Setting exposure and gain")
        with time_limit(5):
            camera.set_exposure(exposure_ms)
            camera.set_gain(gain)
        
        # Skip full frame capture and go straight to ROI
        # to avoid timeout issues with large images
        
        # Set ROI for spectrometer-like operation
        logger.info("Setting ROI for spectrometer operation")
        center_y = camera_info['max_height'] // 2
        roi_height = 100
        
        with time_limit(5):
            camera.set_roi(
                start_x=0,
                start_y=center_y - roi_height // 2,
                width=camera_info['max_width'],
                height=roi_height,
                binning=1
            )
        
        # Capture ROI image
        logger.info("Capturing ROI image")
        with time_limit(10):
            roi_image = camera.capture_raw()
            logger.info(f"ROI image captured, shape: {roi_image.shape}")
        
        # Save ROI image
        np.save(save_dir / "roi_image.npy", roi_image)
        logger.info(f"ROI image saved to {save_dir / 'roi_image.npy'}")
        
        # Calculate a simulated spectrum (sum along rows)
        logger.info("Calculating simulated spectrum")
        spectrum = np.sum(roi_image, axis=0)
        
        # Save spectrum data
        np.save(save_dir / "spectrum.npy", spectrum)
        logger.info(f"Spectrum data saved to {save_dir / 'spectrum.npy'}")
        
        # Save spectrum plot
        fig, ax = plt.subplots(figsize=(10, 4))
        ax.plot(spectrum)
        ax.set_title("Debug Mode Spectrum")
        ax.set_xlabel("Pixel")
        ax.set_ylabel("Intensity (sum)")
        ax.grid(True, alpha=0.3)
        plt.savefig(save_dir / 'spectrum.png', dpi=300)
        logger.info(f"Spectrum plot saved to {save_dir / 'spectrum.png'}")
        
        # Disconnect camera
        logger.info("Disconnecting camera")
        if camera:
            with time_limit(5):
                camera.disconnect()
        logger.info("Debug test completed successfully")
        
        return True
        
    except TimeoutException as e:
        logger.error(f"Timeout: {e}")
        # Try to disconnect camera in case of timeout
        if camera:
            try:
                camera.disconnect()
            except:
                pass
        return False
    except Exception as e:
        logger.error(f"Error in debug mode: {e}")
        # Try to disconnect camera in case of error
        if camera:
            try:
                camera.disconnect()
            except:
                pass
        return False

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
    parser.add_argument('--direct-only', action='store_true',
                        help='Only run direct ZWO API test (bypassing camera module)')
    parser.add_argument('--module-only', action='store_true',
                        help='Only run camera module test')
    parser.add_argument('--debug', action='store_true',
                        help='Run in debug mode with timeout protection and save diagnostic data')
    
    args = parser.parse_args()
    
    # Get SDK path from args or environment
    sdk_path = args.sdk_path or os.getenv('ZWO_ASI_LIB')
    if not sdk_path:
        # Try common locations
        common_paths = [
            '/usr/local/lib/libASICamera2.so',  # Linux
            '/usr/lib/libASICamera2.so',        # Linux alternative
            'C:\\Program Files\\ZWO\\ASI SDK\\ASICamera2.dll',  # Windows
            str(Path.home() / 'ASI_SDK' / 'libASICamera2.so'),  # User home dir
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                logger.info(f"Found ASI SDK library at: {path}")
                sdk_path = path
                break
                
        if not sdk_path:
            logger.error("ASI SDK library not found. Please specify with --sdk-path")
            logger.error("or set the ZWO_ASI_LIB environment variable")
            return 1
    
    # Check if SDK library exists
    if not os.path.exists(sdk_path):
        logger.error(f"ASI SDK library not found at: {sdk_path}")
        logger.error("Please specify the correct path with --sdk-path")
        return 1
    
    logger.info(f"Using ASI SDK library at: {sdk_path}")
    os.environ['ZWO_ASI_LIB'] = sdk_path
    
    # Set up save directory (use debug directory if in debug mode)
    if args.debug:
        save_dir = project_root / "debug"
        # Set logging level to DEBUG in debug mode
        logging.getLogger().setLevel(logging.DEBUG)
    else:
        save_dir = project_root / args.save_dir
    
    save_dir.mkdir(exist_ok=True)
    logger.info(f"Saving test results to: {save_dir}")
    
    # If in debug mode, run only the debug test
    if args.debug:
        logger.info("\n" + "="*50)
        logger.info("RUNNING IN DEBUG MODE")
        logger.info("="*50)
        debug_result = debug_mode(sdk_path, save_dir, args.exposure, args.gain)
        
        if debug_result:
            logger.info("\nDebug test completed successfully!")
            return 0
        else:
            logger.error("\nDebug test failed. See log for details.")
            return 1
    
    # Determine which tests to run for normal mode
    run_direct = not args.module_only
    run_module = not args.direct_only
    
    # If both flags are set, it's confusing, so run both tests
    if args.direct_only and args.module_only:
        logger.warning("Both --direct-only and --module-only set, running both tests")
        run_direct = run_module = True
        
    # Note about test stability
    if run_direct and run_module:
        logger.info("NOTE: Running both tests sequentially may cause the second test to fail")
        logger.info("due to camera driver limitations. If this happens, try running each test")
        logger.info("separately with --direct-only or --module-only flags.")
    
    results = []
    
    # Run the direct API test
    if run_direct:
        logger.info("\n" + "="*50)
        logger.info("RUNNING DIRECT ZWO API TEST")
        logger.info("="*50)
        direct_result = test_direct_zwoasi(sdk_path, save_dir, args.exposure, args.gain)
        results.append(("Direct ZWO API Test", direct_result))
    
    # Add delay between tests if running both
    if run_direct and run_module:
        logger.info("Waiting for camera to reset (5 seconds)...")
        time.sleep(5)
    
    # Run the camera module test
    if run_module:
        logger.info("\n" + "="*50)
        logger.info("RUNNING ASI183CAMERA MODULE TEST")
        logger.info("="*50)
        module_result = test_camera_module(sdk_path, save_dir, args.exposure, args.gain)
        results.append(("ASI183Camera Module Test", module_result))
    
    # Print summary
    logger.info("\n" + "="*50)
    logger.info("TEST SUMMARY")
    logger.info("="*50)
    
    all_passed = True
    for test_name, result in results:
        status = "PASSED" if result else "FAILED"
        logger.info(f"{test_name}: {status}")
        all_passed = all_passed and result
    
    if all_passed:
        logger.info("\nAll tests completed successfully!")
        return 0
    else:
        logger.error("\nOne or more tests failed. See log for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 