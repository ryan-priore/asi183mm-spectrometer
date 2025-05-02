#!/usr/bin/env python3
"""
Spectrometer module for processing camera data into spectra
"""
import os
import logging
import numpy as np
from typing import Dict, Tuple, List, Optional, Any, Union
from scipy import signal
from scipy import interpolate
from PIL import Image

from camera import ASI183Camera
from settings_manager import settings_manager

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
        
        # Load settings from settings manager
        settings = settings_manager.get_settings()
        
        # Calibration settings
        calibration_settings = settings.get('calibration', {})
        self._wavelength_coeffs = calibration_settings.get('wavelength_coefficients', [0.0, 1.0])
        self.laser_wavelength = calibration_settings.get('laser_wavelength', 445.0)
        
        # ROI settings
        roi_settings = settings.get('camera', {}).get('roi', {})
        self.roi_settings = {
            "start_x": roi_settings.get('start_x', 0),
            "start_y": roi_settings.get('start_y', 0),
            "width": roi_settings.get('width', None),  # Will use max width when connected
            "height": roi_settings.get('height', 100),  # Default to a reasonable value
            "binning": roi_settings.get('binning', 1)
        }
        
        # Camera settings
        camera_settings = settings.get('camera', {})
        self.exposure_ms = camera_settings.get('exposure_ms', 100)
        self.gain = camera_settings.get('gain', 0)
        
        # Background and dark frames
        self.dark_frame = None
        
        # Processing settings
        processing_settings = settings.get('processing', {})
        spectrometer_settings = settings.get('spectrometer', {})
        
        self.subtract_dark = spectrometer_settings.get('subtract_dark', False)
        
        # Get readout mode from settings
        self.use_max = False
        if 'readout_mode' in processing_settings:
            self.use_max = (processing_settings.get('readout_mode') == 'maximum')
            
        self.baseline_correction = processing_settings.get('baseline_correction', 'none')
        self.polynomial_degree = processing_settings.get('polynomial_degree', 4)
    
    def connect(self) -> bool:
        """
        Connect to the camera and initialize the spectrometer
        
        Returns:
            True if connection successful
        """
        if self.camera.connect():
            self.connected = True
            
            # Set default ROI for spectroscopy based on camera info
            camera_info = self.camera.get_camera_info()
            max_height = camera_info["max_height"]
            max_width = camera_info["max_width"]
            
            # Update ROI width if not set
            if self.roi_settings["width"] is None:
                self.roi_settings["width"] = max_width
                
            # Update ROI height if using default value
            if self.roi_settings["height"] == 100:
                # Use full width, but only a portion of height centered on the sensor
                spectrum_height = min(100, max_height // 4)  # Reasonable default
                start_y = (max_height - spectrum_height) // 2
                self.roi_settings["start_y"] = start_y
                self.roi_settings["height"] = spectrum_height
            
            # Apply ROI settings
            self.set_roi(**self.roi_settings)
            
            # Apply exposure and gain settings
            self.set_exposure(self.exposure_ms)
            self.set_gain(self.gain)
            
            # Save updated settings
            self._save_settings()
            
            return True
        return False
    
    def _save_settings(self) -> None:
        """
        Save current settings to the settings manager
        """
        # Update ROI settings
        settings_manager.update_settings({
            'roi': {
                'start_x': self.roi_settings['start_x'],
                'start_y': self.roi_settings['start_y'],
                'width': self.roi_settings['width'],
                'height': self.roi_settings['height'],
                'binning': self.roi_settings['binning']
            },
            'exposure_ms': self.exposure_ms,
            'gain': self.gain
        }, 'camera')
        
        # Update calibration settings
        settings_manager.update_settings({
            'wavelength_coefficients': self._wavelength_coeffs,
            'laser_wavelength': self.laser_wavelength
        }, 'calibration')
        
        # Update processing settings
        settings_manager.update_settings({
            'readout_mode': 'maximum' if self.use_max else 'average',
            'baseline_correction': self.baseline_correction,
            'polynomial_degree': self.polynomial_degree
        }, 'processing')
        
        # Update spectrometer settings
        settings_manager.update_settings({
            'subtract_dark': self.subtract_dark,
            'subtract_background': False  # Keeping for compatibility
        }, 'spectrometer')
        
        # We don't have direct access to the display mode here, but we can ensure
        # the pixels_range is properly set based on the current ROI
        if self.roi_settings['width'] is not None:
            settings_manager.update_settings({
                'pixels_range': [0, self.roi_settings['width'] - 1]
            }, 'display')
    
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
        
        # Save updated settings
        self._save_settings()
    
    def set_exposure(self, exposure_ms: int, skip_save: bool = False) -> None:
        """
        Set camera exposure time
        
        Args:
            exposure_ms: Exposure time in milliseconds
            skip_save: If True, don't save settings after setting exposure
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        self.exposure_ms = exposure_ms
        self.camera.set_exposure(exposure_ms)
        
        # Save updated settings unless skipped
        if not skip_save:
            self._save_settings()
    
    def set_gain(self, gain: int, skip_save: bool = False) -> None:
        """
        Set camera gain
        
        Args:
            gain: Gain value
            skip_save: If True, don't save settings after setting gain
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        self.gain = gain
        self.camera.set_gain(gain)
        
        # Save updated settings unless skipped
        if not skip_save:
            self._save_settings()
    
    def set_processing_settings(self, use_max: Optional[bool] = None, 
                                readout_mode: Optional[str] = None,
                                baseline_correction: Optional[str] = None,
                                polynomial_degree: Optional[int] = None) -> None:
        """
        Update processing settings
        
        Args:
            use_max: Whether to use maximum instead of mean for spectrum extraction
            readout_mode: Readout mode: 'average' or 'maximum' (takes precedence over use_max if both provided)
            baseline_correction: Baseline correction method ('none', 'linear', 'polynomial')
            polynomial_degree: Degree for polynomial baseline correction
        """
        # Handle readout_mode parameter (preferred) or use_max
        if readout_mode is not None:
            self.use_max = (readout_mode == 'maximum')
        elif use_max is not None:
            self.use_max = use_max
        
        if baseline_correction is not None:
            self.baseline_correction = baseline_correction
            
        if polynomial_degree is not None:
            self.polynomial_degree = polynomial_degree
            
        # Save updated settings
        self._save_settings()
    
    def set_wavelength_calibration(self, coefficients: List[float]) -> None:
        """
        Set the wavelength calibration coefficients
        
        Args:
            coefficients: List of polynomial coefficients [c0, c1, c2, ...]
                         For converting pixel to wavelength:
                         wavelength = c0 + c1*pixel + c2*pixel^2 + ...
        """
        self._wavelength_coeffs = list(coefficients)
        
        # Save updated settings
        self._save_settings()
    
    def set_laser_wavelength(self, wavelength: float) -> None:
        """
        Set the laser wavelength for Raman shift calculations
        
        Args:
            wavelength: Laser wavelength in nm
        """
        self.laser_wavelength = wavelength
        
        # Save updated settings
        self._save_settings()
    
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
                         return_raw: bool = False,
                         readout_mode: Optional[str] = None
                        ) -> Union[Tuple[np.ndarray, np.ndarray], np.ndarray]:
        """
        Acquire a spectrum from the camera
        
        Args:
            subtract_dark: Whether to subtract dark frame (None uses default setting)
            smoothing: No longer used, kept for backward compatibility
            return_raw: If True, returns the raw 2D image instead of processed spectrum
            readout_mode: 'average' or 'maximum' (None uses default setting)
            
        Returns:
            Tuple of (wavelengths, intensities) as NumPy arrays, or raw image if return_raw=True
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        # Use instance defaults if not specified
        if subtract_dark is None:
            subtract_dark = self.subtract_dark
            
        # Convert readout_mode to use_max for internal processing
        use_max = self.use_max
        if readout_mode is not None:
            use_max = (readout_mode == 'maximum')
            
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
                
        # Extract spectrum based on user preference
        if use_max:
            # Get maximum value of each column for full ADC range
            spectrum = np.max(raw_image, axis=0)
        else:
            # Get mean value of each column (default)
            spectrum = np.mean(raw_image, axis=0)
        
        # Create wavelength mapping just once (more efficient than per-pixel conversion)
        pixel_positions = np.arange(len(spectrum))
        wavelengths = self.pixel_to_wavelength(pixel_positions)
        
        return wavelengths, spectrum
    
    def process_spectrum(self, raw_image: np.ndarray, 
                       subtract_dark: Optional[bool] = None,
                       readout_mode: Optional[str] = None) -> Tuple[np.ndarray, np.ndarray]:
        """
        Process a raw image into a spectrum
        
        Args:
            raw_image: Raw 2D image data
            subtract_dark: Whether to subtract dark frame (None uses default setting)
            readout_mode: 'average' or 'maximum' (None uses default setting)
            
        Returns:
            Tuple of (wavelengths, intensities) as NumPy arrays
        """
        if not self.connected:
            raise RuntimeError("Spectrometer not connected")
            
        # Use instance defaults if not specified
        if subtract_dark is None:
            subtract_dark = self.subtract_dark
            
        # Convert readout_mode to use_max for internal processing
        use_max = self.use_max
        if readout_mode is not None:
            use_max = (readout_mode == 'maximum')
            
        # Apply dark frame correction if needed
        if subtract_dark and self.dark_frame is not None:
            if raw_image.shape == self.dark_frame.shape:
                raw_image = raw_image - self.dark_frame
                raw_image = np.clip(raw_image, 0, None)  # Prevent negative values
            else:
                logger.warning("Dark frame shape mismatch, skipping subtraction")
                
        # Extract spectrum based on user preference
        if use_max:
            # Get maximum value of each column for full ADC range
            spectrum = np.max(raw_image, axis=0)
        else:
            # Get mean value of each column (default)
            spectrum = np.mean(raw_image, axis=0)
            
        # Create wavelength mapping just once (more efficient than per-pixel conversion)
        pixel_positions = np.arange(len(spectrum))
        wavelengths = self.pixel_to_wavelength(pixel_positions)
        
        return wavelengths, spectrum
    
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
        Save spectrum data to file (plotting functionality removed)
        
        Args:
            wavelengths: Array of wavelengths
            intensities: Array of intensity values
            title: Title (not used, kept for compatibility)
            xlabel: X-axis label (not used, kept for compatibility)
            ylabel: Y-axis label (not used, kept for compatibility)
            output_file: If provided, save data to this file
        """
        if output_file:
            # Just save the data to CSV instead of plotting
            csv_file = os.path.splitext(output_file)[0] + ".csv"
            self.save_spectrum(csv_file, wavelengths, intensities)
            logger.info(f"Spectrum data saved to {csv_file}")
        else:
            logger.info("No output file specified, spectrum not saved")
    
    def disconnect(self) -> None:
        """Disconnect from the camera"""
        if self.connected:
            self.camera.disconnect()
            self.connected = False 