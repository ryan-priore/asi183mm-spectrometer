#!/usr/bin/env python3
"""
Settings manager for handling default and current settings
"""
import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Union

logger = logging.getLogger(__name__)

# Default paths
DEFAULT_SETTINGS_PATH = Path("config/default_settings.json")
CURRENT_SETTINGS_PATH = Path("config/current_settings.json")

class SettingsManager:
    """
    Manager for loading, saving, and merging default and current settings
    """
    def __init__(
        self,
        default_path: Union[str, Path] = DEFAULT_SETTINGS_PATH,
        current_path: Union[str, Path] = CURRENT_SETTINGS_PATH
    ):
        """
        Initialize the settings manager
        
        Args:
            default_path: Path to the default settings JSON file
            current_path: Path to the current settings JSON file
        """
        self.default_path = Path(default_path)
        self.current_path = Path(current_path)
        
        # Initialize settings dictionary
        self.settings = {}
        
        # Load the settings
        self.load_settings()
    
    def load_settings(self) -> Dict[str, Any]:
        """
        Load settings from both default and current settings files
        
        Returns:
            Dictionary of merged settings
        """
        # Load default settings
        default_settings = {}
        if self.default_path.exists():
            try:
                with open(self.default_path, 'r') as f:
                    default_settings = json.load(f)
                logger.info(f"Loaded default settings from {self.default_path}")
            except Exception as e:
                logger.error(f"Error loading default settings: {e}")
        else:
            logger.warning(f"Default settings file not found at {self.default_path}")
        
        # Load current settings
        current_settings = {}
        if self.current_path.exists():
            try:
                with open(self.current_path, 'r') as f:
                    current_settings = json.load(f)
                logger.info(f"Loaded current settings from {self.current_path}")
            except Exception as e:
                logger.error(f"Error loading current settings: {e}")
        else:
            logger.info(f"Current settings file not found at {self.current_path}. Will create on first save.")
            
            # If current settings file doesn't exist, create directory and copy default settings
            self.current_path.parent.mkdir(exist_ok=True)
            current_settings = default_settings.copy()
            self.save_current_settings(current_settings)
        
        # Merge settings with current overriding default
        self.settings = self._deep_merge(default_settings, current_settings)
        
        return self.settings
    
    def _deep_merge(self, default_dict: Dict[str, Any], override_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deep merge two dictionaries with override_dict taking precedence
        
        Args:
            default_dict: Default dictionary
            override_dict: Dictionary with override values
            
        Returns:
            Merged dictionary
        """
        result = default_dict.copy()
        
        for k, v in override_dict.items():
            if k in result and isinstance(result[k], dict) and isinstance(v, dict):
                result[k] = self._deep_merge(result[k], v)
            else:
                result[k] = v
                
        return result
    
    def get_settings(self) -> Dict[str, Any]:
        """
        Get the current merged settings
        
        Returns:
            Dictionary of settings
        """
        return self.settings
    
    def get_setting(self, path: str, default: Any = None) -> Any:
        """
        Get a specific setting by dot-separated path
        
        Args:
            path: Dot-separated path to the setting (e.g., "camera.roi.width")
            default: Default value to return if setting not found
            
        Returns:
            Setting value or default if not found
        """
        keys = path.split('.')
        value = self.settings
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
                
        return value
    
    def update_setting(self, path: str, value: Any) -> bool:
        """
        Update a specific setting by dot-separated path
        
        Args:
            path: Dot-separated path to the setting (e.g., "camera.roi.width")
            value: New value for the setting
            
        Returns:
            True if successful, False otherwise
        """
        keys = path.split('.')
        
        # Navigate to the right level
        current = self.settings
        for i, key in enumerate(keys[:-1]):
            if key not in current:
                current[key] = {}
            current = current[key]
        
        # Update the value
        current[keys[-1]] = value
        
        # Save the updated settings
        return self.save_current_settings(self.settings)
    
    def update_settings(self, new_settings: Dict[str, Any], category: Optional[str] = None) -> bool:
        """
        Update multiple settings at once
        
        Args:
            new_settings: Dictionary of new settings
            category: Optional category to update (e.g., "camera", "calibration")
            
        Returns:
            True if successful, False otherwise
        """
        if category:
            if category not in self.settings:
                self.settings[category] = {}
            self.settings[category].update(new_settings)
        else:
            self.settings.update(new_settings)
            
        # Save the updated settings
        return self.save_current_settings(self.settings)
    
    def save_current_settings(self, settings: Dict[str, Any]) -> bool:
        """
        Save the current settings to the current settings file
        
        Args:
            settings: Dictionary of settings to save
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with open(self.current_path, 'w') as f:
                json.dump(settings, f, indent=4)
            logger.info(f"Saved current settings to {self.current_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving current settings: {e}")
            return False
            
    def save_as_default_settings(self) -> bool:
        """
        Save current settings as defaults
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get current settings from the settings manager
            current_settings = self.settings.copy()
            
            # Save them to the default settings file
            with open(self.default_path, 'w') as f:
                json.dump(current_settings, f, indent=4)
                
            logger.info(f"Current settings saved as defaults to {self.default_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving current settings as defaults: {e}")
            return False
    
    def reset_to_defaults(self) -> bool:
        """
        Reset current settings to defaults
        
        Returns:
            True if successful, False otherwise
        """
        # Load default settings
        default_settings = {}
        if self.default_path.exists():
            try:
                with open(self.default_path, 'r') as f:
                    default_settings = json.load(f)
            except Exception as e:
                logger.error(f"Error loading default settings: {e}")
                return False
        else:
            logger.warning(f"Default settings file not found at {self.default_path}")
            return False
        
        # Update settings
        self.settings = default_settings.copy()
        
        # Save the updated settings
        return self.save_current_settings(self.settings)
        
    def load_default_settings(self, spectrometer) -> bool:
        """
        Load default settings and apply them to the spectrometer
        
        Args:
            spectrometer: Spectrometer instance to update
            
        Returns:
            True if successful, False otherwise
        """
        # First reset to defaults
        if not self.reset_to_defaults():
            return False
        
        # Ensure settings are saved to the current_settings.json file
        if not self.save_current_settings(self.settings):
            logger.error("Failed to save default settings to current settings file")
            return False
            
        # Apply settings to the spectrometer if it's connected
        if spectrometer.connected:
            try:
                # Apply camera settings
                camera_settings = self.settings.get('camera', {})
                spectrometer.set_exposure(camera_settings.get('exposure_ms', 100))
                spectrometer.set_gain(camera_settings.get('gain', 0))
                
                # Apply ROI settings
                roi_settings = camera_settings.get('roi', {})
                spectrometer.set_roi(
                    start_x=roi_settings.get('start_x', 0),
                    start_y=roi_settings.get('start_y', 0),
                    width=roi_settings.get('width', None),
                    height=roi_settings.get('height', 100),
                    binning=roi_settings.get('binning', 1)
                )
                
                # Apply calibration settings
                calibration_settings = self.settings.get('calibration', {})
                spectrometer.set_wavelength_calibration(
                    calibration_settings.get('wavelength_coefficients', [400.0, 0.5])
                )
                spectrometer.set_laser_wavelength(
                    calibration_settings.get('laser_wavelength', 445.0)
                )
                
                # Apply processing settings
                processing_settings = self.settings.get('processing', {})
                spectrometer.set_processing_settings(
                    use_max=processing_settings.get('use_max', False),
                    baseline_correction=processing_settings.get('baseline_correction', 'none'),
                    polynomial_degree=processing_settings.get('polynomial_degree', 4)
                )
                
                # Apply spectrometer settings
                spectrometer_settings = self.settings.get('spectrometer', {})
                spectrometer.subtract_dark = spectrometer_settings.get('subtract_dark', False)
                
            except Exception as e:
                logger.error(f"Error applying settings to spectrometer: {e}")
                return False
                
        return True


# Global instance for easy access
settings_manager = SettingsManager()

def get_settings_manager() -> SettingsManager:
    """
    Get the global settings manager instance
    
    Returns:
        SettingsManager instance
    """
    return settings_manager 