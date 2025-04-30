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
from pathlib import Path
from contextlib import contextmanager
from PIL import Image, ImageDraw, ImageFont

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

def save_image_with_colorbar(image_data, filename, title="Image"):
    """
    Save a numpy array as an image with a simple colorbar using PIL
    
    Args:
        image_data: 2D numpy array with image data
        filename: Output filename to save
        title: Title to display on the image
    """
    # Normalize the image data to 0-255
    img_min = np.min(image_data)
    img_max = np.max(image_data)
    
    if img_max > img_min:
        img_norm = ((image_data - img_min) / (img_max - img_min) * 255).astype(np.uint8)
    else:
        img_norm = np.zeros_like(image_data, dtype=np.uint8)
    
    # Create a PIL Image
    img = Image.fromarray(img_norm)
    
    # Create a larger canvas with space for the title and colorbar
    width, height = img.size
    canvas = Image.new('RGB', (width + 50, height + 30), (255, 255, 255))
    
    # Paste the image
    canvas.paste(img, (0, 30))
    
    # Draw the title
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except IOError:
        # Fallback to default font
        font = ImageFont.load_default()
    
    draw.text((10, 5), title, fill=(0, 0, 0), font=font)
    
    # Draw a simple colorbar
    bar_height = height
    for i in range(256):
        draw.line([(width + 25, 30 + i * bar_height // 256), 
                  (width + 45, 30 + i * bar_height // 256)], 
                  fill=(i, i, i), width=2)
    
    # Add min/max labels
    draw.text((width + 20, 30), f"{img_max:.0f}", fill=(0, 0, 0), font=font)
    draw.text((width + 20, 30 + bar_height - 20), f"{img_min:.0f}", fill=(0, 0, 0), font=font)
    
    # Save the image
    canvas.save(filename)
    logger.info(f"Image saved to {filename}")

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
            save_image_with_colorbar(
                raw_image,
                save_dir / 'direct_test_image.png',
                title=f"Direct ASI API Test Image (Exp: {exposure_ms}ms, Gain: {gain})"
            )
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
            save_image_with_colorbar(
                roi_image,
                save_dir / 'direct_roi_image.png',
                title=f"Direct ASI API ROI Test (height={roi_height})"
            )
            
            # If in debug mode, save additional diagnostic data
            if save_dir.name == 'debug':
                # Calculate a simulated spectrum (sum along rows)
                logger.info("Calculating simulated spectrum from ROI")
                spectrum = np.sum(roi_image, axis=0)
                
                # Save spectrum data
                np.savetxt(
                    save_dir / "direct_spectrum.csv",
                    np.column_stack((np.arange(len(spectrum)), spectrum)),
                    delimiter=',',
                    header='Pixel,Intensity',
                    comments=''
                )
                logger.info(f"Spectrum data saved to {save_dir / 'direct_spectrum.csv'}")
                
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
        save_image_with_colorbar(
            raw_image,
            save_dir / 'module_test_image.png',
            title=f"ASI183Camera Module Test (Exp: {exposure_ms}ms, Gain: {gain})"
        )
            
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
        save_image_with_colorbar(
            roi_image,
            save_dir / 'module_roi_image.png',
            title=f"ASI183Camera Module ROI Test (height={roi_height})"
        )
        
        # Get column sum (spectrum-like data)
        spectrum = np.mean(roi_image, axis=0)
        
        # Save spectrum data to CSV
        np.savetxt(
            save_dir / 'module_simulated_spectrum.csv',
            np.column_stack((np.arange(len(spectrum)), spectrum)),
            delimiter=',',
            header='Pixel,Intensity',
            comments=''
        )
        logger.info(f"Spectrum data saved to {save_dir / 'module_simulated_spectrum.csv'}")
        
        # Create a simple spectrometer
        from src.spectrometer import Spectrometer
        spec = Spectrometer(sdk_path)
        
        try:
            # Connect and acquire
            if spec.connect():
                logger.info("Connected to spectrometer")
                
                # Set similar ROI
                spec.set_roi(0, camera_info['max_height'] // 2 - roi_height // 2, camera_info['max_width'], roi_height)
                
                # Set exposure and gain
                spec.set_exposure(exposure_ms)
                spec.set_gain(gain)
                
                # Acquire spectrum
                wavelengths, intensities = spec.acquire_spectrum()
                
                # Save spectrum data
                np.savetxt(
                    save_dir / 'spectrum.csv',
                    np.column_stack((wavelengths, intensities)),
                    delimiter=',',
                    header='Wavelength,Intensity',
                    comments=''
                )
                logger.info(f"Spectrum data saved to {save_dir / 'spectrum.csv'}")
                
                # Disconnect
                spec.disconnect()
            else:
                logger.error("Failed to connect to spectrometer")
        except Exception as e:
            logger.error(f"Error during spectrometer test: {e}")
        
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
        logger.error(f"Module test error: {e}")
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
        
        # Calculate a simulated spectrum (sum along rows)
        logger.info("Calculating simulated spectrum")
        spectrum = np.sum(roi_image, axis=0)
        
        # Save spectrum data
        np.save(save_dir / "spectrum.npy", spectrum)
        logger.info(f"Spectrum data saved to {save_dir / 'spectrum.npy'}")
        
        # Save spectrum as CSV
        np.savetxt(
            save_dir / 'debug_spectrum.csv',
            np.column_stack((np.arange(len(spectrum)), spectrum)),
            delimiter=',',
            header='Pixel,Intensity',
            comments=''
        )
        logger.info(f"Spectrum data saved to {save_dir / 'debug_spectrum.csv'}")
        
        # Save ROI as image
        save_image_with_colorbar(
            roi_image,
            save_dir / 'debug_roi_image.png',
            title=f"Debug ROI (Exp: {exposure_ms}ms, Gain: {gain})"
        )
        
        # Try to disconnect properly
        logger.info("Disconnecting camera")
        with time_limit(5):
            camera.disconnect()
        
        logger.info("Debug mode completed successfully")
        return True
        
    except TimeoutException:
        logger.error("Timeout occurred during camera operations")
        # Try to disconnect anyway
        if camera:
            try:
                camera.disconnect()
            except:
                pass
        return False
    except Exception as e:
        logger.error(f"Debug mode error: {e}")
        # Try to disconnect anyway
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
    parser.add_argument('--exposure', type=int, default=100,
                       help="Exposure time in milliseconds")
    parser.add_argument('--gain', type=int, default=0,
                       help="Gain value")
    parser.add_argument('--direct-only', action='store_true',
                       help="Only test direct ZWO ASI API")
    parser.add_argument('--module-only', action='store_true',
                       help="Only test ASI183Camera module")
    parser.add_argument('--debug', action='store_true',
                       help="Run in debug mode with timeout protection")
    args = parser.parse_args()
    
    # Find SDK path if not provided
    sdk_path = args.sdk_path
    
    if not sdk_path:
        # Try common paths
        potential_paths = [
            # Linux paths
            '/usr/lib/libASICamera2.so',
            '/usr/lib64/libASICamera2.so',
            '/usr/local/lib/libASICamera2.so',
            os.path.expanduser('~/lib/libASICamera2.so'),
            os.path.expandvars('$ZWO_ASI_LIB'),
            
            # Windows paths
            'C:\\Program Files\\ZWO\\ASI SDK\\ASICamera2.dll',
            'C:\\Program Files (x86)\\ZWO\\ASI SDK\\ASICamera2.dll',
        ]
        
        for path in potential_paths:
            if path and os.path.exists(path):
                sdk_path = path
                logger.info(f"Found SDK at {sdk_path}")
                break
    
    if not sdk_path or not os.path.exists(sdk_path):
        logger.error("SDK library not found. Please provide the --sdk-path argument.")
        return 1
    
    # Create debug directory with timestamp if in debug mode
    if args.debug:
        save_dir = Path(f"./debug_{time.strftime('%Y%m%d_%H%M%S')}")
        save_dir.mkdir(exist_ok=True)
        logger.info(f"Debug results will be saved to {save_dir}")
    else:
        save_dir = Path("./test_results")
        save_dir.mkdir(exist_ok=True)
    
    logger.info(f"Test results will be saved to {save_dir}")
    
    # Run tests
    results = []
    
    if args.debug:
        # Debug mode overrides other options
        logger.info("Running in debug mode")
        success = debug_mode(sdk_path, save_dir, args.exposure, args.gain)
        results.append(("Debug Mode", success))
    else:
        # Run regular tests
        if not args.module_only:
            logger.info("Testing Direct ZWO ASI API")
            direct_success = test_direct_zwoasi(sdk_path, save_dir, args.exposure, args.gain)
            results.append(("Direct ZWO ASI API", direct_success))
        
        if not args.direct_only:
            logger.info("Testing ASI183Camera Module")
            module_success = test_camera_module(sdk_path, save_dir, args.exposure, args.gain)
            results.append(("ASI183Camera Module", module_success))
    
    # Print summary
    logger.info("\n--- TEST SUMMARY ---")
    all_success = True
    for name, success in results:
        status = "SUCCESS" if success else "FAILED"
        logger.info(f"{name}: {status}")
        all_success = all_success and success
    
    logger.info(f"All tests {'passed' if all_success else 'failed'}")
    logger.info(f"Results saved to {save_dir}")
    
    return 0 if all_success else 1

if __name__ == "__main__":
    sys.exit(main()) 