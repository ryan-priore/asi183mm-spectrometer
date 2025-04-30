#!/usr/bin/env python3
"""
ASI183MM Camera Interface module for spectrometer application
"""
import os
import time
import logging
import zwoasi as asi
import numpy as np
from typing import Dict, Tuple, Optional, Any, List

logger = logging.getLogger(__name__)

class ASI183Camera:
    """Interface for the ASI183MM camera used in the spectrometer"""
    
    def __init__(self, sdk_path: Optional[str] = None):
        """
        Initialize the camera interface
        
        Args:
            sdk_path: Path to the ASI SDK library file (.so or .dll)
                     If None, will try to use ZWO_ASI_LIB environment variable
        """
        self.camera = None
        self.camera_info = None
        self.connected = False
        
        # Initialize the ASI SDK
        env_path = os.getenv('ZWO_ASI_LIB')
        if sdk_path:
            asi.init(sdk_path)
        elif env_path:
            asi.init(env_path)
        else:
            raise ValueError("SDK path not provided and ZWO_ASI_LIB environment variable not set")
        
        # Add a short delay after initialization to let the driver stabilize
        time.sleep(1)
            
        # Check for cameras
        num_cameras = asi.get_num_cameras()
        if num_cameras == 0:
            raise RuntimeError("No ASI cameras found")
            
        self.cameras_found = asi.list_cameras()
        logger.info(f"Found {num_cameras} camera(s): {', '.join(self.cameras_found)}")
    
    def connect(self, camera_id: int = 0) -> bool:
        """
        Connect to the camera
        
        Args:
            camera_id: Camera ID to connect to (default 0)
            
        Returns:
            True if connection successful
        """
        try:
            # Make sure SDK is initialized
            if len(self.cameras_found) == 0:
                logger.error("No cameras found during initialization")
                return False
                
            # Use the same approach that works in test_asi.py
            logger.debug(f"Opening camera {camera_id}")
            try:
                self.camera = asi.Camera(camera_id)
                logger.debug(f"Successfully created camera object for ID {camera_id}")
            except Exception as e:
                logger.error(f"Failed to create camera object: {e}")
                return False
            
            # Add delay after creating camera object
            logger.debug("Waiting after camera creation...")
            time.sleep(1.0)
            
            # Get camera info
            logger.debug("Getting camera properties")
            try:
                self.camera_info = self.camera.get_camera_property()
                logger.debug(f"Camera properties: {self.camera_info['Name']}, {self.camera_info['MaxWidth']}x{self.camera_info['MaxHeight']}")
            except Exception as e:
                logger.error(f"Failed to get camera properties: {e}")
                return False
            
            # Additional delay
            logger.debug("Waiting after getting properties...")
            time.sleep(0.5)
            
            # Set some default settings appropriate for spectroscopy
            logger.debug("Setting up default parameters")
            try:
                self.setup_defaults()
                logger.debug("Default parameters set successfully")
            except Exception as e:
                logger.error(f"Failed to set default parameters: {e}")
                # Continue anyway - some cameras might work without setting defaults
                pass
            
            self.connected = True
            logger.info(f"Connected to {self.camera_info['Name']}")
            return True
        except Exception as e:
            logger.error(f"Error connecting to camera: {e}")
            self.connected = False
            return False
    
    def setup_defaults(self) -> None:
        """Set default camera settings optimized for spectroscopy"""
        if not self.camera:
            raise RuntimeError("Camera not initialized")
            
        logger.debug("Setting up default parameters for camera")
        
        try:
            # Use minimum USB bandwidth to avoid transfer issues
            logger.debug("Getting camera controls")
            controls = self.camera.get_controls()
            logger.debug(f"Available controls: {list(controls.keys())}")
            
            logger.debug("Setting bandwidth")
            self.camera.set_control_value(
                asi.ASI_BANDWIDTHOVERLOAD, 
                controls['BandWidth']['MinValue']
            )
            logger.debug("Bandwidth set successfully")
            
            # Set for monochrome imaging
            logger.debug("Setting image type to RAW16")
            self.camera.set_image_type(asi.ASI_IMG_RAW16)  # 16-bit for better dynamic range
            logger.debug("Image type set successfully")
            
            # Default settings - these should be configurable via the API
            logger.debug("Setting basic camera parameters")
            
            # Set each parameter in a separate try block to continue even if one fails
            try:
                self.camera.set_control_value(asi.ASI_GAIN, 0)  # Minimum gain for less noise
                logger.debug("Gain set successfully")
            except Exception as e:
                logger.warning(f"Failed to set gain: {e}")
                
            try:
                self.camera.set_control_value(asi.ASI_EXPOSURE, 100000)  # 100ms exposure
                logger.debug("Exposure set successfully")
            except Exception as e:
                logger.warning(f"Failed to set exposure: {e}")
                
            try:
                self.camera.set_control_value(asi.ASI_GAMMA, 50)
                logger.debug("Gamma set successfully")
            except Exception as e:
                logger.warning(f"Failed to set gamma: {e}")
                
            try:
                self.camera.set_control_value(asi.ASI_BRIGHTNESS, 50)
                logger.debug("Brightness set successfully")
            except Exception as e:
                logger.warning(f"Failed to set brightness: {e}")
                
            try:
                self.camera.set_control_value(asi.ASI_FLIP, 0)
                logger.debug("Flip set successfully")
            except Exception as e:
                logger.warning(f"Failed to set flip: {e}")
            
            # Disable auto settings
            try:
                logger.debug("Disabling dark subtract")
                self.camera.disable_dark_subtract()
                logger.debug("Dark subtract disabled")
            except Exception as e:
                logger.warning(f"Failed to disable dark subtract: {e}")
            
            # Add a small delay after applying settings
            logger.debug("Waiting after setting parameters")
            time.sleep(0.1)
            
            logger.debug("Default setup completed successfully")
            
        except Exception as e:
            logger.error(f"Error in setup_defaults: {e}")
            raise
    
    def get_camera_info(self) -> Dict[str, Any]:
        """
        Get camera information and settings
        
        Returns:
            Dictionary of camera information
        """
        if not self.connected or not self.camera:
            raise RuntimeError("Camera not connected")
            
        info = {
            "name": self.camera_info['Name'],
            "camera_id": self.camera_info['CameraID'],
            "max_height": self.camera_info['MaxHeight'],
            "max_width": self.camera_info['MaxWidth'],
            "is_color_cam": self.camera_info['IsColorCam'],
            "pixel_size": self.camera_info['PixelSize'],
            "mechanical_shutter": self.camera_info['MechanicalShutter'],
            "supported_bins": self.camera_info['SupportedBins'],
            "supported_video_formats": self.camera_info['SupportedVideoFormat'],
            "current_settings": self.get_settings()
        }
        
        return info
    
    def get_settings(self) -> Dict[str, Any]:
        """
        Get current camera settings
        
        Returns:
            Dictionary of current settings
        """
        if not self.connected or not self.camera:
            raise RuntimeError("Camera not connected")
            
        return self.camera.get_control_values()
    
    def set_exposure(self, exposure_ms: int) -> None:
        """
        Set camera exposure time
        
        Args:
            exposure_ms: Exposure time in milliseconds
        """
        if not self.connected or not self.camera:
            raise RuntimeError("Camera not connected")
        
        # ASI cameras need exposure in microseconds    
        exposure_us = exposure_ms * 1000
        logger.debug(f"Setting exposure to {exposure_ms}ms ({exposure_us}μs)")
        
        # Get current exposure to compare
        try:
            current_exposure = self.camera.get_control_value(asi.ASI_EXPOSURE)[0]
            logger.debug(f"Current exposure before setting: {current_exposure/1000:.2f}ms")
        except Exception as e:
            logger.warning(f"Failed to get current exposure: {e}")
            
        # Set new exposure
        try:
            self.camera.set_control_value(asi.ASI_EXPOSURE, exposure_us)
            logger.debug(f"Exposure set to {exposure_ms}ms ({exposure_us}μs)")
            
            # Verify if the exposure was set correctly
            new_exposure = self.camera.get_control_value(asi.ASI_EXPOSURE)[0]
            logger.debug(f"Current exposure after setting: {new_exposure/1000:.2f}ms")
            
            # Check if there's a significant difference
            if abs(new_exposure - exposure_us) > 1000:  # Difference of more than 1ms
                logger.warning(f"Exposure might not be set correctly: requested {exposure_us}μs, got {new_exposure}μs")
        except Exception as e:
            logger.error(f"Failed to set exposure: {e}")
            raise
    
    def set_gain(self, gain: int) -> None:
        """
        Set camera gain
        
        Args:
            gain: Gain value (typically 0-500)
        """
        if not self.connected or not self.camera:
            raise RuntimeError("Camera not connected")
            
        self.camera.set_control_value(asi.ASI_GAIN, gain)
        logger.debug(f"Set gain to {gain}")
    
    def set_roi(self, start_x: int = 0, start_y: int = 0, 
                width: Optional[int] = None, height: Optional[int] = None,
                binning: int = 1) -> None:
        """
        Set the Region of Interest (ROI) for the camera
        
        Args:
            start_x: Starting X position (default 0)
            start_y: Starting Y position (default 0)
            width: Width of ROI (default: max width)
            height: Height of ROI (default: max height)
            binning: Pixel binning factor (default 1)
        """
        if not self.connected or not self.camera:
            raise RuntimeError("Camera not connected")
            
        # Use max dimensions if not specified
        if width is None:
            width = self.camera_info['MaxWidth']
        if height is None:
            height = self.camera_info['MaxHeight']
            
        # Ensure binning is supported
        if binning not in self.camera_info['SupportedBins']:
            supported = self.camera_info['SupportedBins']
            raise ValueError(f"Binning {binning} not supported. Supported values: {supported}")
            
        self.camera.set_roi(start_x=start_x, start_y=start_y, 
                           width=width, height=height, bins=binning)
        logger.debug(f"Set ROI: x={start_x}, y={start_y}, w={width}, h={height}, bin={binning}")
    
    def capture_raw(self) -> np.ndarray:
        """
        Capture a raw frame from the camera
        
        Returns:
            NumPy array containing the raw image data
        """
        if not self.camera:
            raise RuntimeError("Camera not initialized")
            
        logger.debug("Beginning image capture process")
        
        try:
            # Get current exposure
            try:
                exposure = self.camera.get_control_value(asi.ASI_EXPOSURE)[0]
                logger.debug(f"Current exposure: {exposure/1000:.2f}ms")
            except Exception as e:
                logger.warning(f"Failed to get exposure value: {e}")
                exposure = 100000  # Default to 100ms if can't get current value
                logger.debug(f"Using default exposure: {exposure/1000:.2f}ms")
            
            # Use capture method directly instead of start_exposure + get_data_after_exposure
            # This is more efficient as it handles timing internally in the SDK
            logger.debug(f"Capturing image with {exposure/1000:.2f}ms exposure")
            try:
                # Try to use the more efficient capture method
                data = self.camera.capture()
                logger.debug("Image captured using direct capture method")
            except Exception as e:
                logger.warning(f"Direct capture failed, using exposure sequence: {e}")
                # Fall back to manual exposure sequence
                self.camera.start_exposure()
                
                # Calculate wait time with a smaller buffer
                wait_time = (exposure / 1000.0) + 0.1  # Convert μs to s and add smaller buffer
                logger.debug(f"Waiting {wait_time:.2f}s for exposure to complete")
                time.sleep(wait_time)
                
                # Check status
                status = self.camera.get_exposure_status()
                logger.debug(f"Exposure status: {status}")
                
                if status != asi.ASI_EXP_SUCCESS:
                    logger.warning(f"Exposure not complete (status: {status}), waiting a bit longer")
                    time.sleep(0.3)  # Wait a bit longer, but not too long
                    status = self.camera.get_exposure_status()
                    logger.debug(f"Exposure status after additional wait: {status}")
                
                # Get data
                data = self.camera.get_data_after_exposure()
            
            # Convert data to numpy array with proper dimensions
            if isinstance(data, (bytes, bytearray)):
                logger.debug("Converting byte data to numpy array")
                
                # Determine dimensions based on camera info
                if hasattr(self, 'camera_info'):
                    width = self.camera_info['MaxWidth']
                    height = self.camera_info['MaxHeight']
                    
                    # Adjust for ROI if set
                    if hasattr(self.camera, 'get_roi'):
                        try:
                            roi = self.camera.get_roi()
                            width = roi[2]
                            height = roi[3]
                            logger.debug(f"Using ROI dimensions: {width}x{height}")
                        except:
                            logger.debug(f"Using default dimensions: {width}x{height}")
                    
                    # Convert bytes to numpy array
                    logger.debug("Converting to numpy array")
                    array_data = np.frombuffer(data, dtype=np.uint16).reshape((height, width))
                    
                    return array_data
                else:
                    logger.warning("Camera info not available, returning raw data")
                    return data
            else:
                # If already a numpy array, just return it
                logger.debug(f"Data is already a numpy array with shape {data.shape}")
                return data
            
        except Exception as e:
            logger.error(f"Error capturing image: {e}")
            raise
    
    def capture_spectrum(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Capture a spectrum (integrating along columns)
        
        Returns:
            Tuple of (positions, intensities) as NumPy arrays
        """
        # Capture raw image
        img = self.capture_raw()
        
        # Sum along columns (axis 0) to get the spectrum
        spectrum = np.sum(img, axis=0)
        
        # Create position array
        positions = np.arange(len(spectrum))
        
        return positions, spectrum
    
    def disconnect(self) -> None:
        """Close the camera connection"""
        self.connected = False
        self.camera = None
        logger.info("Camera disconnected")
        
    def __del__(self):
        """Destructor to ensure camera is closed properly"""
        if self.connected and self.camera:
            self.disconnect() 