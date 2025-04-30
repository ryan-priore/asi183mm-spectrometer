#!/usr/bin/env python3
"""
REST API for the ASI183MM spectrometer
"""
import os
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import base64
from io import BytesIO

import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query, Body
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from spectrometer import Spectrometer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create output directory for spectra
SPECTRA_DIR = Path("./spectra")
SPECTRA_DIR.mkdir(exist_ok=True)

# Initialize the app
app = FastAPI(
    title="ASI183MM Spectrometer API",
    description="REST API for controlling the ASI183MM-based spectrometer",
    version="0.1.0"
)

# Add CORS middleware for web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton spectrometer instance
spectrometer: Optional[Spectrometer] = None

# Data models
class ROISettings(BaseModel):
    """Settings for Region of Interest"""
    start_x: int = Field(0, description="Starting X position")
    start_y: int = Field(0, description="Starting Y position")
    width: Optional[int] = Field(None, description="Width of ROI (pixels)")
    height: Optional[int] = Field(None, description="Height of ROI (pixels)")
    binning: int = Field(1, description="Binning factor")

class ExposureSettings(BaseModel):
    """Exposure settings"""
    exposure_ms: int = Field(..., description="Exposure time in milliseconds")
    gain: Optional[int] = Field(None, description="Gain value")

class WavelengthCalibration(BaseModel):
    """Wavelength calibration coefficients"""
    coefficients: List[float] = Field(
        ..., 
        description="Polynomial coefficients [c0, c1, c2, ...] for converting pixel to wavelength"
    )

class ProcessingSettings(BaseModel):
    """Spectrum processing settings"""
    subtract_dark: Optional[bool] = Field(None, description="Whether to subtract dark frame")
    use_max: Optional[bool] = Field(None, description="Whether to use maximum instead of mean for spectrum extraction")

class SpectrumResponse(BaseModel):
    """Response model for spectrum data"""
    wavelengths: List[float] = Field(..., description="Wavelength values")
    intensities: List[float] = Field(..., description="Intensity values")
    timestamp: float = Field(..., description="Acquisition timestamp")
    exposure_ms: int = Field(..., description="Exposure time used")
    gain: int = Field(..., description="Gain value used")
    image_data: Optional[str] = Field(None, description="Base64 encoded image data")

# Helper functions
def get_spectrometer() -> Spectrometer:
    """Get or initialize the spectrometer instance"""
    global spectrometer
    if spectrometer is None:
        # Get SDK path from environment variable or use default
        sdk_path = os.getenv("ZWO_ASI_LIB")
        spectrometer = Spectrometer(sdk_path)
        
    if not spectrometer.connected:
        if not spectrometer.connect():
            raise HTTPException(status_code=500, detail="Failed to connect to spectrometer")
    
    return spectrometer

# API Routes
@app.get("/", tags=["General"])
async def root():
    """API root endpoint"""
    return {"message": "ASI183MM Spectrometer API", "status": "online"}

@app.get("/status", tags=["General"])
async def get_status(spectrometer: Spectrometer = Depends(get_spectrometer)):
    """Get spectrometer status"""
    camera_info = spectrometer.camera.get_camera_info()
    settings = spectrometer.camera.get_settings()
    
    return {
        "connected": spectrometer.connected,
        "camera_info": camera_info,
        "settings": settings,
        "roi": spectrometer.roi_settings,
        "calibration": {
            "coefficients": spectrometer._wavelength_coeffs
        },
        "processing": {
            "subtract_dark": spectrometer.subtract_dark,
            "use_max": spectrometer.use_max
        }
    }

@app.post("/connect", tags=["Control"])
async def connect_spectrometer(background_tasks: BackgroundTasks):
    """Connect to the spectrometer"""
    global spectrometer
    
    if spectrometer is None:
        sdk_path = os.getenv("ZWO_ASI_LIB")
        spectrometer = Spectrometer(sdk_path)
    
    if spectrometer.connected:
        return {"message": "Already connected"}
    
    if spectrometer.connect():
        return {"message": "Connected successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to connect to spectrometer")

@app.post("/disconnect", tags=["Control"])
async def disconnect_spectrometer(background_tasks: BackgroundTasks):
    """Disconnect from the spectrometer"""
    global spectrometer
    
    if spectrometer is None or not spectrometer.connected:
        return {"message": "Not connected"}
    
    spectrometer.disconnect()
    return {"message": "Disconnected successfully"}

@app.post("/roi", tags=["Settings"])
async def set_roi(
    roi: ROISettings,
    spectrometer: Spectrometer = Depends(get_spectrometer)
):
    """Set the Region of Interest"""
    try:
        spectrometer.set_roi(
            start_x=roi.start_x,
            start_y=roi.start_y,
            width=roi.width,
            height=roi.height,
            binning=roi.binning
        )
        return {"message": "ROI set successfully", "roi": roi}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set ROI: {str(e)}")

@app.post("/exposure", tags=["Settings"])
async def set_exposure(
    settings: ExposureSettings,
    spectrometer: Spectrometer = Depends(get_spectrometer)
):
    """Set exposure and gain settings"""
    try:
        spectrometer.set_exposure(settings.exposure_ms)
        if settings.gain is not None:
            spectrometer.set_gain(settings.gain)
        
        return {"message": "Exposure settings updated", "settings": settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set exposure: {str(e)}")

@app.post("/calibration", tags=["Calibration"])
async def set_calibration(
    calibration: WavelengthCalibration,
    spectrometer: Spectrometer = Depends(get_spectrometer)
):
    """Set wavelength calibration coefficients"""
    try:
        spectrometer.set_wavelength_calibration(calibration.coefficients)
        return {"message": "Calibration updated", "calibration": calibration}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set calibration: {str(e)}")

@app.post("/processing", tags=["Settings"])
async def set_processing(
    settings: ProcessingSettings,
    spectrometer: Spectrometer = Depends(get_spectrometer)
):
    """Set processing settings"""
    try:
        if settings.subtract_dark is not None:
            spectrometer.subtract_dark = settings.subtract_dark
            
        if settings.use_max is not None:
            spectrometer.use_max = settings.use_max
            
        return {
            "message": "Processing settings updated",
            "settings": {
                "subtract_dark": spectrometer.subtract_dark,
                "use_max": spectrometer.use_max
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set processing settings: {str(e)}")

@app.post("/acquire/dark", tags=["Acquisition"])
async def acquire_dark(spectrometer: Spectrometer = Depends(get_spectrometer)):
    """Acquire a dark frame"""
    try:
        dark_frame = spectrometer.acquire_dark_frame()
        return {"message": "Dark frame acquired", "shape": list(dark_frame.shape)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to acquire dark frame: {str(e)}")

@app.get("/acquire/spectrum", tags=["Acquisition"], response_model=SpectrumResponse)
async def acquire_spectrum(
    subtract_dark: Optional[bool] = Query(None, description="Whether to subtract dark frame"),
    use_max: Optional[bool] = Query(None, description="Whether to use maximum instead of mean for spectrum extraction"),
    include_image: Optional[bool] = Query(True, description="Whether to include base64-encoded image data"),
    spectrometer: Spectrometer = Depends(get_spectrometer)
):
    """Acquire a spectrum"""
    try:
        # Get current settings before acquisition
        settings = spectrometer.camera.get_settings()
        
        # Acquire raw image data first
        raw_image = spectrometer.acquire_spectrum(return_raw=True)
        
        # Process the spectrum using the raw image
        wavelengths, intensities = spectrometer.process_spectrum(
            raw_image,
            subtract_dark=subtract_dark,
            use_max=use_max
        )
        
        # Convert to lists for JSON serialization
        response_data = {
            "wavelengths": wavelengths.tolist(),
            "intensities": intensities.tolist(),
            "timestamp": time.time(),
            "exposure_ms": settings.get("Exposure", 0),
            "gain": settings.get("Gain", 0),
            "image_data": None
        }
        
        # Include image data if requested
        if include_image:
            # Convert the raw image to a displayable format
            # Create a PIL Image from the raw data
            img_min = np.min(raw_image)
            img_max = np.max(raw_image)
            if img_max > img_min:
                img_norm = ((raw_image - img_min) / (img_max - img_min) * 255).astype(np.uint8)
            else:
                img_norm = np.zeros_like(raw_image, dtype=np.uint8)
            
            # Convert to PIL image and save as JPEG
            from PIL import Image
            img_pil = Image.fromarray(img_norm)
            
            # Save as JPEG to buffer
            buffer = BytesIO()
            img_pil.save(buffer, format="JPEG", quality=85)
            buffer.seek(0)
            
            # Encode as base64
            image_base64 = base64.b64encode(buffer.read()).decode("utf-8")
            response_data["image_data"] = f"data:image/jpeg;base64,{image_base64}"
        
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to acquire spectrum: {str(e)}")

@app.get("/acquire/image", tags=["Acquisition"])
async def acquire_raw_image(spectrometer: Spectrometer = Depends(get_spectrometer)):
    """Acquire a raw 2D image and return it as a base64-encoded PNG with ROI overlay"""
    try:
        # Acquire raw image
        raw_image = spectrometer.acquire_spectrum(return_raw=True)
        
        # Normalize to 8-bit for display
        img_min = np.min(raw_image)
        img_max = np.max(raw_image)
        if img_max > img_min:
            img_norm = ((raw_image - img_min) / (img_max - img_min) * 255).astype(np.uint8)
        else:
            img_norm = np.zeros_like(raw_image, dtype=np.uint8)
        
        # Convert to RGB for overlay
        from PIL import Image, ImageDraw
        img_rgb = Image.fromarray(img_norm).convert('RGB')
        
        # Get current ROI settings
        roi = spectrometer.roi_settings
        
        # Draw ROI rectangle
        draw = ImageDraw.Draw(img_rgb)
        
        # Define rectangle coordinates
        left = roi["start_x"]
        top = roi["start_y"]
        right = left + (roi["width"] or 0) 
        bottom = top + (roi["height"] or 0)
        
        # Draw red rectangle with 2px width
        draw.rectangle([left, top, right-1, bottom-1], outline=(255, 0, 0), width=2)
        
        # Convert to PNG
        buffer = BytesIO()
        img_rgb.save(buffer, format="PNG")
        buffer.seek(0)
        
        # Return as streaming response
        return StreamingResponse(buffer, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to acquire image: {str(e)}")

@app.get("/roi", tags=["Settings"])
async def get_roi(spectrometer: Spectrometer = Depends(get_spectrometer)):
    """Get the current ROI settings"""
    try:
        return {
            "roi": spectrometer.roi_settings,
            "camera_info": spectrometer.camera.get_camera_info()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get ROI settings: {str(e)}")

@app.post("/save/spectrum", tags=["Data"])
async def save_spectrum_data(
    filename: str = Query(..., description="Filename for the spectrum data"),
    use_max: Optional[bool] = Query(None, description="Whether to use maximum instead of mean for spectrum extraction"),
    spectrometer: Spectrometer = Depends(get_spectrometer)
):
    """Acquire and save a spectrum to a CSV file"""
    try:
        # Make sure filename only has valid characters
        clean_filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
        if not clean_filename.endswith(".csv"):
            clean_filename += ".csv"
            
        filepath = SPECTRA_DIR / clean_filename
        
        # Acquire spectrum
        wavelengths, intensities = spectrometer.acquire_spectrum(use_max=use_max)
        
        # Save to file
        spectrometer.save_spectrum(str(filepath), wavelengths, intensities)
        
        return {
            "message": "Spectrum saved successfully",
            "filename": clean_filename,
            "path": str(filepath)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save spectrum: {str(e)}")

@app.get("/spectra", tags=["Data"])
async def list_spectra():
    """List all saved spectra"""
    spectra_files = list(SPECTRA_DIR.glob("*.csv"))
    return {
        "spectra": [
            {
                "filename": f.name,
                "path": str(f),
                "size": f.stat().st_size,
                "created": f.stat().st_mtime
            }
            for f in spectra_files
        ]
    }

@app.get("/spectra/{filename}", tags=["Data"])
async def get_spectrum_file(filename: str):
    """Get a saved spectrum file"""
    # Sanitize filename
    clean_filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
    filepath = SPECTRA_DIR / clean_filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"Spectrum file {filename} not found")
    
    return FileResponse(str(filepath), filename=clean_filename) 