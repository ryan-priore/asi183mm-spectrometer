# ASI183MM Spectrometer Control Interface

This example provides a complete web interface to control the ASI183MM spectrometer API. It demonstrates how to interact with all of the spectrometer's features through a user-friendly interface.

## Features

- Full control of the spectrometer through a modern web interface
- Setting exposure time and gain
- Configuring Region of Interest (ROI) with binning options
- Wavelength calibration
- Dark frame and background acquisition
- Continuous acquisition mode with adjustable update interval
- Real-time spectrum display with basic statistics
- Saving and copying spectral data
- Detailed logging of operations

## Usage

1. **Start the spectrometer server** (in another terminal):
   ```
   ./scripts/run_server.sh
   ```

2. **Serve the example files** (using Python's built-in HTTP server):
   ```
   cd example
   python -m http.server 8080
   ```

3. **Open the interface** in your web browser:
   [http://localhost:8080](http://localhost:8080)

4. **Connect to the spectrometer** by clicking the "Connect" button.

5. **Configure settings** as needed:
   - Set exposure time and gain
   - Configure ROI (Region of Interest)
   - Set wavelength calibration coefficients

6. **Acquire data**:
   - Take dark frame for background correction
   - Take background frame if needed
   - Acquire spectrum (single or continuous mode)
   - View real-time results on the graph

7. **Save or copy data** using the buttons below the graph.

## Continuous Acquisition Mode

The interface supports continuous acquisition with these steps:

1. Set your desired update interval (in milliseconds)
2. Check the "Continuous Mode" checkbox
3. The system will automatically acquire spectra at the specified interval
4. Uncheck the checkbox to stop continuous acquisition

## API Endpoints Used

This example demonstrates integration with these API endpoints:

- `/api/spectrometer/connect` - Connect to the spectrometer
- `/api/spectrometer/disconnect` - Disconnect from the spectrometer
- `/api/spectrometer/exposure` - Get/set exposure settings
- `/api/spectrometer/roi` - Get/set ROI settings
- `/api/spectrometer/calibration` - Get/set wavelength calibration
- `/api/spectrometer/dark` - Acquire dark frame
- `/api/spectrometer/background` - Acquire background frame
- `/api/spectrometer/spectrum` - Acquire spectrum

## Customization

You can modify the interface to meet your specific needs:

- Adjust the default ROI in index.html
- Change the default exposure settings
- Modify the wavelength calibration coefficients
- Add additional features as needed

## Troubleshooting

- Check the log panel at the bottom of the interface for error messages
- Ensure the spectrometer server is running and accessible
- Verify that the camera is properly connected and recognized
- If CORS issues occur, make sure the API server has CORS enabled for your web client

## Extending

This example can be extended in various ways:

- Add additional visualization options
- Implement peak detection and analysis
- Add real-time processing of spectra
- Create presets for common configurations
- Build in report generation capabilities 