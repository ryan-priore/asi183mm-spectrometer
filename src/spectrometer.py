#!/usr/bin/env python3
"""
Spectrometer module for processing camera data into spectra
"""
import os
import logging
import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, Tuple, List, Optional, Any, Union
from scipy import signal
from scipy import interpolate
from PIL import Image

from camera import ASI183Camera

logger = logging.getLogger(__name__)

class Spectrometer:
    """
    Spectrometer class that controls the ASI183MM camera and processes
    the raw data into calibrated spectra
    """
    
    def __init__(self, sdk_path: Optional[str] = None):
        """
        Initialize the spectrometer
        
        Args:
            sdk_path: Path to the ASI SDK library file (.so or .dll)
                     If None, will try to use ZWO_ASI_LIB environment variable
        """
        self.camera = ASI183Camera(sdk_path)
        self.connected = False
        
        # Default calibration (wavelength vs. pixel position)
        # This should be loaded from a calibration file
        self._wavelength_coeffs = [0.0, 1.0]  # Linear calibration as placeholder
        
        # ROI settings for spectroscopy
        self.roi_settings = {
            "start_x": 0,
            "start_y": 0,
            "width": None,  # Will use max width when connected
            "height": None,  # Will use a reasonable default when connected
            "binning": 1
        }
        
        # Background and dark frames
        self.dark_frame = None
        
        # Processing settings
        self.subtract_dark = False
    
    def connect(self) -> bool:
        """
        Connect to the camera and initialize the spectrometer
        
        Returns:
            True if connection successful
        """
        if self.camera.connect():
            self.connected = True
            
            # Set default ROI for spectroscopy
            # For a spectrometer, we typically want a thin horizontal strip
            # in the center of the sensor
            camera_info = self.camera.get_camera_info()
            max_height = camera_info["max_height"]
            max_width = camera_info["max_width"]
            
            # Use full width, but only a portion of height centered on the sensor
            # This assumes the spectrum is projected horizontally across the sensor
            spectrum_height = min(100, max_height // 4)  # Reasonable default
            start_y = (max_height - spectrum_height) // 2
            
            self.roi_settings = {
                "start_x": 0,
                "start_y": start_y,
                "width": max_width,
                "height": spectrum_height,
                "binning": 1
            }
            
            # Apply ROI settings
            self.set_roi(**self.roi_settings)
            
            return True
        return False
    
    def set_roi(self, start_x: int = 0, start_y: int = 0, 
                width: Optional[int] = None, height: Optional[int] = None,
                binning: int = 1) -> None:
        """
        Set the Region of Interest for spectroscopy
        
        Args:
            start_x: Starting X position
            start_y: Starting Y position
            width: Width of ROI
            height: Height of ROI
            binning: Pixel binning factor
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        # Update stored settings
        self.roi_settings = {
            "start_x": start_x,
            "start_y": start_y,
            "width": width,
            "height": height,
            "binning": binning
        }
        
        # Apply to camera
        self.camera.set_roi(start_x, start_y, width, height, binning)
    
    def set_exposure(self, exposure_ms: int) -> None:
        """
        Set camera exposure time
        
        Args:
            exposure_ms: Exposure time in milliseconds
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        self.camera.set_exposure(exposure_ms)
    
    def set_gain(self, gain: int) -> None:
        """
        Set camera gain
        
        Args:
            gain: Gain value
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        self.camera.set_gain(gain)
    
    def acquire_dark_frame(self) -> np.ndarray:
        """
        Acquire a dark frame (with shutter closed or light blocked)
        
        Returns:
            Dark frame as NumPy array
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        # Acquire dark frame
        self.dark_frame = self.camera.capture_raw()
        return self.dark_frame
    
    def acquire_spectrum(self, 
                         subtract_dark: Optional[bool] = None,
                         smoothing: Optional[bool] = False,  # Set default to False
                         return_raw: bool = False
                        ) -> Union[Tuple[np.ndarray, np.ndarray], np.ndarray]:
        """
        Acquire a spectrum from the camera
        
        Args:
            subtract_dark: Whether to subtract dark frame (None uses default setting)
            smoothing: No longer used, kept for backward compatibility
            return_raw: If True, returns the raw 2D image instead of processed spectrum
            
        Returns:
            Tuple of (wavelengths, intensities) as NumPy arrays, or raw image if return_raw=True
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        # Use instance defaults if not specified
        if subtract_dark is None:
            subtract_dark = self.subtract_dark
            
        # Acquire raw image
        raw_image = self.camera.capture_raw()
        
        if return_raw:
            return raw_image
            
        # Apply dark frame correction if needed
        if subtract_dark and self.dark_frame is not None:
            if raw_image.shape == self.dark_frame.shape:
                raw_image = raw_image - self.dark_frame
                raw_image = np.clip(raw_image, 0, None)  # Prevent negative values
            else:
                logger.warning("Dark frame shape mismatch, skipping subtraction")
                
        # Get maximum value of each column for full ADC range (optimized version)
        spectrum = np.max(raw_image, axis=0)
            
        # Create wavelength mapping just once (more efficient than per-pixel conversion)
        pixel_positions = np.arange(len(spectrum))
        wavelengths = self.pixel_to_wavelength(pixel_positions)
        
        return wavelengths, spectrum
    
    def set_wavelength_calibration(self, coefficients: List[float]) -> None:
        """
        Set wavelength calibration coefficients
        
        Args:
            coefficients: Polynomial coefficients [c0, c1, c2, ...] for converting
                        pixel position to wavelength: 
                        wavelength = c0 + c1*x + c2*x^2 + ...
        """
        self._wavelength_coeffs = coefficients
    
    def pixel_to_wavelength(self, pixel_positions: np.ndarray) -> np.ndarray:
        """
        Convert pixel positions to wavelengths using calibration
        
        Args:
            pixel_positions: Array of pixel positions
            
        Returns:
            Array of corresponding wavelengths
        """
        # Apply polynomial calibration
        wavelengths = np.zeros_like(pixel_positions, dtype=float)
        for i, coef in enumerate(self._wavelength_coeffs):
            wavelengths += coef * (pixel_positions ** i)
            
        return wavelengths
    
    def wavelength_to_pixel(self, wavelengths: np.ndarray) -> np.ndarray:
        """
        Convert wavelengths to nearest pixel positions
        
        Args:
            wavelengths: Array of wavelengths
            
        Returns:
            Array of nearest corresponding pixel positions
        """
        if len(self._wavelength_coeffs) <= 1:
            raise ValueError("Wavelength calibration not set properly")
            
        # For simple linear calibration
        if len(self._wavelength_coeffs) == 2:
            # wavelength = c0 + c1 * pixel
            # pixel = (wavelength - c0) / c1
            pixels = (wavelengths - self._wavelength_coeffs[0]) / self._wavelength_coeffs[1]
            return np.round(pixels).astype(int)
            
        # For higher-order calibrations, we need to use interpolation
        # Create a dense mapping of pixel positions to wavelengths
        dense_pixels = np.arange(0, self.roi_settings["width"] or 1000)
        dense_wavelengths = self.pixel_to_wavelength(dense_pixels)
        
        # Create interpolator from wavelength to pixel
        interpolator = interpolate.interp1d(dense_wavelengths, dense_pixels, 
                                          bounds_error=False, fill_value="extrapolate")
        
        return np.round(interpolator(wavelengths)).astype(int)
    
    def save_spectrum(self, filename: str, 
                     wavelengths: np.ndarray, 
                     intensities: np.ndarray) -> None:
        """
        Save spectrum data to a CSV file
        
        Args:
            filename: Output filename
            wavelengths: Array of wavelengths
            intensities: Array of intensity values
        """
        output_data = np.column_stack((wavelengths, intensities))
        np.savetxt(filename, output_data, delimiter=',', 
                  header='Wavelength,Intensity', comments='')
        logger.info(f"Spectrum saved to {filename}")
    
    def plot_spectrum(self, wavelengths: np.ndarray, 
                     intensities: np.ndarray,
                     title: str = "Spectrum",
                     xlabel: str = "Wavelength (nm)",
                     ylabel: str = "Intensity (counts)",
                     output_file: Optional[str] = None) -> None:
        """
        Plot spectrum data
        
        Args:
            wavelengths: Array of wavelengths
            intensities: Array of intensity values
            title: Plot title
            xlabel: X-axis label
            ylabel: Y-axis label
            output_file: If provided, save plot to this file
        """
        plt.figure(figsize=(10, 6))
        plt.plot(wavelengths, intensities)
        plt.title(title)
        plt.xlabel(xlabel)
        plt.ylabel(ylabel)
        plt.grid(True, alpha=0.3)
        
        if output_file:
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
            logger.info(f"Plot saved to {output_file}")
        else:
            plt.show()
            
        plt.close()
    
    def disconnect(self) -> None:
        """Disconnect from the camera"""
        if self.connected:
            self.camera.disconnect()
            self.connected = False 