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
            self.camera = asi.Camera(camera_id)
            self.camera_info = self.camera.get_camera_property()
            
            # Set some default settings appropriate for spectroscopy
            self.setup_defaults()
            
            self.connected = True
            logger.info(f"Connected to {self.camera_info['Name']}")
            return True
        except Exception as e:
            logger.error(f"Error connecting to camera: {e}")
            self.connected = False
            return False
    
    def setup_defaults(self) -> None:
        """Set default camera settings optimized for spectroscopy"""
        if not self.connected or not self.camera:
            raise RuntimeError("Camera not connected")
            
        # Use minimum USB bandwidth to avoid transfer issues
        controls = self.camera.get_controls()
        self.camera.set_control_value(
            asi.ASI_BANDWIDTHOVERLOAD, 
            controls['BandWidth']['MinValue']
        )
        
        # Set for monochrome imaging
        self.camera.set_image_type(asi.ASI_IMG_RAW16)  # 16-bit for better dynamic range
        
        # Default settings - these should be configurable via the API
        self.camera.set_control_value(asi.ASI_GAIN, 0)  # Minimum gain for less noise
        self.camera.set_control_value(asi.ASI_EXPOSURE, 100000)  # 100ms exposure
        self.camera.set_control_value(asi.ASI_GAMMA, 50)
        self.camera.set_control_value(asi.ASI_BRIGHTNESS, 50)
        self.camera.set_control_value(asi.ASI_FLIP, 0)
        
        # Disable auto settings
        self.camera.disable_dark_subtract()
    
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
            
        self.camera.set_control_value(asi.ASI_EXPOSURE, exposure_ms)
        logger.debug(f"Set exposure to {exposure_ms}ms")
    
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
        if not self.connected or not self.camera:
            raise RuntimeError("Camera not connected")
            
        # Stop any ongoing video capture
        try:
            self.camera.stop_video_capture()
        except:
            pass
        
        # Set timeout based on exposure time
        exposure = self.camera.get_control_value(asi.ASI_EXPOSURE)[0]
        timeout = (exposure / 1000) * 2 + 500  # 2x exposure + 500ms buffer
        
        # Capture the frame
        return self.camera.capture()
    
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