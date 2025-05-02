#!/usr/bin/env python3
"""
Main entry point for the ASI183MM spectrometer backend
"""
import os
import sys
import logging
import argparse
import uvicorn
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_environment():
    """Check if the environment is properly set up"""
    # Check if ZWO_ASI_LIB environment variable is set
    asi_lib = os.getenv('ZWO_ASI_LIB')
    if not asi_lib:
        logger.warning("ZWO_ASI_LIB environment variable not set")
        logger.warning("Please set it to the path of the ASI SDK library file")
        
        # Try to find the library in common locations
        common_paths = [
            '/usr/local/lib/libASICamera2.so',  # Linux
            '/usr/lib/libASICamera2.so',        # Linux alternative
            'C:\\Program Files\\ZWO\\ASI SDK\\ASICamera2.dll',  # Windows
            str(Path.home() / 'ASI_SDK' / 'libASICamera2.so'),  # User home dir
        ]
        
        for path in common_paths:
            if os.path.exists(path):
                logger.info(f"Found ASI SDK library at: {path}")
                logger.info(f"You can set ZWO_ASI_LIB={path}")
                break
        else:
            logger.warning("Could not find ASI SDK library in common locations")
    else:
        if os.path.exists(asi_lib):
            logger.info(f"ASI SDK library found at: {asi_lib}")
        else:
            logger.error(f"ASI SDK library not found at specified path: {asi_lib}")
            return False
            
    # Create directories needed for operation
    Path("./spectra").mkdir(exist_ok=True)
    Path("./config").mkdir(exist_ok=True)
            
    return True

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='ASI183MM Spectrometer Backend')
    parser.add_argument('--host', type=str, default='0.0.0.0',
                        help='Host to run the API server (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=8000,
                        help='Port to run the API server (default: 8000)')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug mode')
    parser.add_argument('--sdk-path', type=str, default=None,
                        help='Path to the ASI SDK library file (overrides ZWO_ASI_LIB)')
    parser.add_argument('--reset-settings', action='store_true',
                        help='Reset settings to defaults')
    
    args = parser.parse_args()
    
    # Set SDK path from arguments if provided
    if args.sdk_path:
        os.environ['ZWO_ASI_LIB'] = args.sdk_path
        
    # Set log level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        
    # Check environment
    if not check_environment():
        logger.error("Environment check failed. Please fix the issues and try again.")
        return 1
    
    # Initialize settings manager
    logger.info("Initializing settings manager...")
    from settings_manager import settings_manager
    
    # Reset settings if requested
    if args.reset_settings:
        logger.info("Resetting settings to defaults...")
        if settings_manager.reset_to_defaults():
            logger.info("Settings reset successfully")
        else:
            logger.error("Failed to reset settings")
    
    # Get server settings
    server_settings = settings_manager.get_setting('server', {})
    host = args.host or server_settings.get('host', '0.0.0.0')
    port = args.port or server_settings.get('port', 8000)
    debug = args.debug or server_settings.get('debug', False)
        
    # Import the API module here to avoid initializing the camera before environment check
    logger.info("Initializing API...")
    import api
    
    # Start the API server
    logger.info(f"Starting ASI183MM Spectrometer API on {host}:{port}")
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=debug
    )
    
    return 0

if __name__ == "__main__":
    sys.exit(main())