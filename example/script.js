/**
 * ASI183MM Spectrometer Control Interface
 * JavaScript controller for API interactions
 */

// Configuration
//const API_BASE_URL = 'http://localhost:8000';
const API_BASE_URL = `http://${window.location.hostname}:8000`;
const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

// State management
const appState = {
    connected: false,
    currentSpectrum: null,
    wavelengths: null,
    ramanShifts: null, // Added for Raman shift values
    plotLayout: null,
    imageData: null,  // Store the image data
    displayMode: 'wavelength', // 'wavelength' or 'raman'
    baselineCorrected: false, // Whether baseline correction has been applied
    originalSpectrum: null, // Store original spectrum for reverting corrections
};

// DOM elements
const elements = {
    // Status elements
    connectionStatus: document.getElementById('connection-status'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeIcon: document.getElementById('theme-icon'),
    
    // Camera settings
    exposureTime: document.getElementById('exposure-time'),
    setExposureBtn: document.getElementById('set-exposure-btn'),
    gain: document.getElementById('gain'),
    setGainBtn: document.getElementById('set-gain-btn'),
    
    // ROI settings
    roiStartX: document.getElementById('roi-start-x'),
    roiStartY: document.getElementById('roi-start-y'),
    roiWidth: document.getElementById('roi-width'),
    roiHeight: document.getElementById('roi-height'),
    setRoiBtn: document.getElementById('set-roi-btn'),
    
    // Display mode
    wavelengthModeBtn: document.getElementById('wavelength-mode-btn'),
    ramanModeBtn: document.getElementById('raman-mode-btn'),
    
    // Axis controls
    xMin: document.getElementById('x-min'),
    xMax: document.getElementById('x-max'),
    resetAxisBtn: document.getElementById('reset-axis-btn'),
    
    // Calibration
    laserWavelength: document.getElementById('laser-wavelength'),
    wavelengthA: document.getElementById('wavelength-a'),
    wavelengthB: document.getElementById('wavelength-b'),
    wavelengthC: document.getElementById('wavelength-c'),
    setCalibrationBtn: document.getElementById('set-calibration-btn'),
    
    // Processing settings
    useMax: document.getElementById('use-max'),
    baselineCorrection: document.getElementById('baseline-correction'),
    polynomialDegree: document.getElementById('polynomial-degree'),
    polynomialDegreeGroup: document.getElementById('polynomial-degree-group'),
    setProcessingBtn: document.getElementById('set-processing-btn'),
    
    // Acquisition
    acquireSpectrumBtn: document.getElementById('acquire-spectrum-btn'),
    acquisitionStatus: document.getElementById('acquisition-status'),
    
    // Spectrum display
    spectrumPlot: document.getElementById('spectrum-plot'),
    
    // Data export
    saveSpectrumBtn: document.getElementById('save-spectrum-btn'),
    copyDataBtn: document.getElementById('copy-data-btn'),
    
    // Image display
    cameraImage: document.getElementById('camera-image'),
    
    // ROI visualization
    roiCanvas: document.getElementById('roi-canvas'),
    roiDimensions: document.getElementById('roi-dimensions'),
    
    // Log
    logContainer: document.getElementById('log-container'),
    clearLogBtn: document.getElementById('clear-log-btn'),
};

// Initialize the application
function initApp() {
    // Set up event listeners
    elements.connectBtn.addEventListener('click', connectSpectrometer);
    elements.disconnectBtn.addEventListener('click', disconnectSpectrometer);
    elements.setExposureBtn.addEventListener('click', setExposure);
    elements.setGainBtn.addEventListener('click', setGain);
    elements.setRoiBtn.addEventListener('click', setRoi);
    elements.setCalibrationBtn.addEventListener('click', setCalibration);
    elements.acquireSpectrumBtn.addEventListener('click', acquireSpectrum);
    elements.saveSpectrumBtn.addEventListener('click', saveSpectrum);
    elements.copyDataBtn.addEventListener('click', copyData);
    elements.clearLogBtn.addEventListener('click', clearLog);
    
    // Set up display mode toggle
    elements.wavelengthModeBtn.addEventListener('click', () => setDisplayMode('wavelength'));
    elements.ramanModeBtn.addEventListener('click', () => setDisplayMode('raman'));
    
    // Set up axis controls
    elements.xMin.addEventListener('change', updateAxisRange);
    elements.xMax.addEventListener('change', updateAxisRange);
    elements.resetAxisBtn.addEventListener('click', resetAxisRange);
    
    // Set up baseline correction
    elements.baselineCorrection.addEventListener('change', toggleBaselineCorrectionOptions);
    
    // Set up processing settings
    elements.setProcessingBtn.addEventListener('click', setProcessingSettings);
    
    // Initialize tab interface
    initTabInterface();
    
    // Set up theme toggle
    setupThemeToggle();
    
    // Set default values
    elements.exposureTime.value = 100;
    elements.gain.value = 0;
    
    // Initialize default Plotly layout
    appState.plotLayout = {
        title: '',
        xaxis: {
            title: 'Wavelength (nm)',
            gridcolor: '#eee'
        },
        yaxis: {
            title: 'Intensity',
            gridcolor: '#eee',
            range: [0, 65535]  // Set default range to the full 16-bit ADC range
        },
        margin: { t: 30, l: 60, r: 30, b: 60 },
        plot_bgcolor: 'var(--plot-bg-color)',
        paper_bgcolor: 'var(--plot-bg-color)',
        hovermode: 'closest',
        font: {
            color: 'var(--text-color)'
        }
    };
    
    // Initialize default axis ranges
    resetAxisRange();
    
    // Initialize empty plot
    Plotly.newPlot('spectrum-plot', [], appState.plotLayout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
        displaylogo: false
    });
    
    // Log initialization
    logMessage('Interface initialized', 'info');
    logMessage('Connect to the spectrometer to begin', 'info');
}

// Initialize tab interface
function initTabInterface() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Activate corresponding tab pane
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// Toggle baseline correction options
function toggleBaselineCorrectionOptions() {
    const correctionMethod = elements.baselineCorrection.value;
    
    // Show/hide polynomial degree input based on selected method
    if (correctionMethod === 'polynomial') {
        elements.polynomialDegreeGroup.style.display = 'flex';
    } else {
        elements.polynomialDegreeGroup.style.display = 'none';
    }
}

// Set display mode (wavelength or Raman shift)
function setDisplayMode(mode) {
    if (mode === appState.displayMode) return;
    
    appState.displayMode = mode;
    
    // Update button states
    if (mode === 'wavelength') {
        elements.wavelengthModeBtn.classList.add('active');
        elements.ramanModeBtn.classList.remove('active');
    } else {
        elements.wavelengthModeBtn.classList.remove('active');
        elements.ramanModeBtn.classList.add('active');
    }
    
    // Update axis labels and ranges
    resetAxisRange();
    
    // Redraw the spectrum if we have data
    if (appState.wavelengths && appState.currentSpectrum) {
        drawSpectrum(appState.wavelengths, appState.currentSpectrum);
    }
    
    logMessage(`Display mode changed to ${mode === 'wavelength' ? 'Wavelength (nm)' : 'Raman Shift (cm⁻¹)'}`, 'info');
}

// Update axis range based on input values
function updateAxisRange() {
    const xMin = parseFloat(elements.xMin.value);
    const xMax = parseFloat(elements.xMax.value);
    
    if (isNaN(xMin) || isNaN(xMax) || xMin >= xMax) {
        logMessage('Invalid axis range values', 'warning');
        return;
    }
    
    // Update plot layout
    const layout = {
        xaxis: {
            range: [xMin, xMax]
        }
    };
    
    Plotly.relayout('spectrum-plot', layout);
    logMessage(`Axis range updated to [${xMin}, ${xMax}]`, 'info');
}

// Reset axis range to default values
function resetAxisRange() {
    let xMin, xMax;
    
    if (appState.displayMode === 'wavelength') {
        xMin = 400;
        xMax = 700;
        elements.xMin.value = xMin;
        elements.xMax.value = xMax;
        
        // Update plot layout for wavelength
        appState.plotLayout.xaxis.title = 'Wavelength (nm)';
    } else {
        xMin = 0;
        xMax = 3500;
        elements.xMin.value = xMin;
        elements.xMax.value = xMax;
        
        // Update plot layout for Raman shift
        appState.plotLayout.xaxis.title = 'Raman Shift (cm⁻¹)';
    }
    
    // Update plot layout
    const layout = {
        xaxis: {
            title: appState.plotLayout.xaxis.title,
            range: [xMin, xMax]
        }
    };
    
    Plotly.relayout('spectrum-plot', layout);
    logMessage(`Axis range reset to default values [${xMin}, ${xMax}]`, 'info');
}

// Calculate Raman shifts from wavelengths
function calculateRamanShifts(wavelengths) {
    const laserWavelength = parseFloat(elements.laserWavelength.value);
    
    if (isNaN(laserWavelength) || laserWavelength <= 0) {
        logMessage('Invalid laser wavelength', 'error');
        return null;
    }
    
    // Calculate Raman shifts using the formula: (1/laser_nm - 1/sample_nm) * 10^7
    return wavelengths.map(wavelength => {
        return Math.round((1/laserWavelength - 1/wavelength) * 10000000);
    });
}

// Apply baseline correction to spectrum
function applyBaselineCorrection(wavelengths, intensities) {
    const method = elements.baselineCorrection.value;
    
    if (method === 'none') {
        return [...intensities]; // Return a copy of the original data
    }
    
    // Store original data if not already stored
    if (!appState.originalSpectrum) {
        appState.originalSpectrum = [...intensities];
    }
    
    const correctedIntensities = [...intensities];
    
    if (method === 'linear') {
        // Simple linear baseline correction (connect endpoints)
        const firstPoint = intensities[0];
        const lastPoint = intensities[intensities.length - 1];
        const slope = (lastPoint - firstPoint) / (intensities.length - 1);
        
        for (let i = 0; i < intensities.length; i++) {
            const baseline = firstPoint + slope * i;
            correctedIntensities[i] = Math.max(0, intensities[i] - baseline);
        }
    } 
    else if (method === 'polynomial') {
        // Simplified polynomial fitting approach
        // This is a basic implementation - a more sophisticated approach would
        // identify baseline points and fit only to those
        const degree = parseInt(elements.polynomialDegree.value);
        
        // For now, we'll just approximate by reducing all values by a small percentage
        // This is a placeholder for a proper polynomial fitting algorithm
        const reduction = 0.1; // 10% reduction
        const min = Math.min(...intensities);
        
        for (let i = 0; i < intensities.length; i++) {
            correctedIntensities[i] = Math.max(0, intensities[i] - min * degree * 0.2);
        }
    }
    
    appState.baselineCorrected = true;
    return correctedIntensities;
}

// Set processing settings
async function setProcessingSettings() {
    const useMax = elements.useMax.checked;
    const baselineMethod = elements.baselineCorrection.value;
    const polynomialDegree = parseInt(elements.polynomialDegree.value);
    
    try {
        logMessage(`Setting processing options: Use Max=${useMax}, Baseline=${baselineMethod}`, 'info');
        
        await apiRequest('/processing', 'POST', { 
            use_max: useMax
        });
        
        // Apply baseline correction client-side if we have data
        if (appState.wavelengths && appState.currentSpectrum) {
            // If we're switching from baseline correction to none, restore original data
            if (baselineMethod === 'none' && appState.baselineCorrected) {
                appState.currentSpectrum = [...appState.originalSpectrum];
                appState.baselineCorrected = false;
                appState.originalSpectrum = null;
            } 
            // Otherwise apply the selected correction
            else if (baselineMethod !== 'none') {
                appState.currentSpectrum = applyBaselineCorrection(
                    appState.wavelengths, 
                    appState.originalSpectrum || appState.currentSpectrum
                );
            }
            
            // Redraw the spectrum with processed data
            drawSpectrum(appState.wavelengths, appState.currentSpectrum);
        }
        
        logMessage('Processing settings updated successfully', 'success');
    } catch (error) {
        logMessage(`Error setting processing options: ${error.message}`, 'error');
    }
}

// API Requests
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        const options = {
            method,
            headers: DEFAULT_HEADERS,
            credentials: 'same-origin'
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.detail || `API request failed with status ${response.status}`);
        }
        
        if (response.status === 204) {
            return null; // No content
        }
        
        return await response.json();
    } catch (error) {
        logMessage(`API Error: ${error.message}`, 'error');
        throw error;
    }
}

// Connect to the spectrometer
async function connectSpectrometer() {
    try {
        elements.connectionStatus.textContent = 'Connecting...';
        elements.connectionStatus.className = 'status connecting';
        
        logMessage('Connecting to spectrometer...', 'info');
        await apiRequest('/connect', 'POST');
        
        appState.connected = true;
        elements.connectionStatus.textContent = 'Connected';
        elements.connectionStatus.className = 'status connected';
        
        // Enable controls
        toggleUIElements(true);
        
        // Activate the Camera tab by default
        const cameraTabBtn = document.querySelector('.tab-btn[data-tab="camera"]');
        if (cameraTabBtn) {
            cameraTabBtn.click();
        }
        
        logMessage('Connected to spectrometer', 'success');
        
        // Get current settings and set ROI to full sensor size
        await getSpectrumeterSettings();
        
        // Try to set ROI to full sensor immediately
        try {
            const statusData = await apiRequest('/status', 'GET');
            if (statusData && statusData.camera_info && 
                statusData.camera_info.max_width && statusData.camera_info.max_height) {
                
                // Set ROI inputs to full sensor
                elements.roiStartX.value = 0;
                elements.roiStartY.value = 0;
                elements.roiWidth.value = statusData.camera_info.max_width;
                elements.roiHeight.value = statusData.camera_info.max_height;
                
                // Apply ROI settings automatically
                await setRoi();
                
                logMessage('ROI set to full sensor automatically', 'success');
            }
        } catch (error) {
            logMessage(`Could not auto-set ROI: ${error.message}`, 'warning');
        }
    } catch (error) {
        elements.connectionStatus.textContent = 'Disconnected';
        elements.connectionStatus.className = 'status disconnected';
        logMessage(`Connection failed: ${error.message}`, 'error');
    }
}

// Disconnect from the spectrometer
async function disconnectSpectrometer() {
    try {
        logMessage('Disconnecting from spectrometer...', 'info');
        
        await apiRequest('/disconnect', 'POST');
        
        appState.connected = false;
        elements.connectionStatus.textContent = 'Disconnected';
        elements.connectionStatus.className = 'status disconnected';
        
        // Disable controls
        toggleUIElements(false);
        
        logMessage('Disconnected from spectrometer', 'success');
    } catch (error) {
        logMessage(`Disconnection error: ${error.message}`, 'error');
    }
}

// Get current spectrometer settings
async function getSpectrumeterSettings() {
    try {
        // Get status for all settings
        const statusData = await apiRequest('/status', 'GET');
        if (statusData) {
            // Store the current exposure and gain values just in case
            const currentExposure = elements.exposureTime.value;
            const currentGain = elements.gain.value;
            
            if (statusData.settings) {
                elements.exposureTime.value = statusData.settings.exposure_ms || currentExposure;
                elements.gain.value = statusData.settings.gain || currentGain;
                logMessage(`Current exposure: ${elements.exposureTime.value}ms, gain: ${elements.gain.value}`, 'info');
            }
            
            let roiUpdated = false;
            if (statusData.roi) {
                elements.roiStartX.value = statusData.roi.start_x;
                elements.roiStartY.value = statusData.roi.start_y;
                elements.roiWidth.value = statusData.roi.width;
                elements.roiHeight.value = statusData.roi.height;
                logMessage(`Current ROI: (${statusData.roi.start_x},${statusData.roi.start_y}) ${statusData.roi.width}x${statusData.roi.height}`, 'info');
                
                // Update ROI visualization
                updateRoiVisualization(statusData.roi);
                roiUpdated = true;
            }
            
            if (statusData.camera_info) {
                // Set defaults based on camera info if available
                if (statusData.camera_info.max_width && statusData.camera_info.max_height) {
                    // Set ROI to full sensor size if not already set
                    if (!elements.roiWidth.value || elements.roiWidth.value === "null") {
                        elements.roiWidth.value = statusData.camera_info.max_width;
                    }
                    
                    if (!elements.roiHeight.value || elements.roiHeight.value === "null") {
                        elements.roiHeight.value = statusData.camera_info.max_height;
                    }
                    
                    logMessage(`Set ROI to full sensor size: ${elements.roiWidth.value}x${elements.roiHeight.value}`, 'info');
                    
                    // Update ROI visualization if not already updated
                    if (!roiUpdated) {
                        updateRoiVisualization({
                            start_x: parseInt(elements.roiStartX.value) || 0,
                            start_y: parseInt(elements.roiStartY.value) || 0,
                            width: parseInt(elements.roiWidth.value),
                            height: parseInt(elements.roiHeight.value)
                        });
                    }
                }
            }
            
            if (statusData.calibration && statusData.calibration.coefficients) {
                const coeffs = statusData.calibration.coefficients;
                elements.wavelengthA.value = coeffs[0] || 0.0;
                elements.wavelengthB.value = coeffs[1] || 1.0;
                elements.wavelengthC.value = coeffs.length > 2 ? coeffs[2] : 0.0;
                logMessage(`Current calibration: A=${elements.wavelengthA.value}, B=${elements.wavelengthB.value}, C=${elements.wavelengthC.value}`, 'info');
            }
            
            if (statusData.processing) {
                // Update processing settings
                elements.useMax.checked = statusData.processing.use_max || false;
                logMessage(`Processing settings: Use Max=${statusData.processing.use_max}`, 'info');
            }
            
            // Restore saved laser wavelength
            const savedLaserWL = localStorage.getItem('laserWavelength');
            if (savedLaserWL) {
                elements.laserWavelength.value = savedLaserWL;
                logMessage(`Restored laser wavelength: ${savedLaserWL} nm`, 'info');
            }
        }
    } catch (error) {
        logMessage(`Error getting settings: ${error.message}`, 'error');
    }
}

// Set exposure time
async function setExposure() {
    const exposureMs = parseInt(elements.exposureTime.value);
    const gain = parseInt(elements.gain.value);
    
    try {
        logMessage(`Setting exposure to ${exposureMs}ms, gain to ${gain}...`, 'info');
        await apiRequest('/exposure', 'POST', { 
            exposure_ms: exposureMs,
            gain: gain
        });
        logMessage(`Exposure set to ${exposureMs}ms, gain set to ${gain}`, 'success');
    } catch (error) {
        logMessage(`Error setting exposure: ${error.message}`, 'error');
    }
}

// Set gain
async function setGain() {
    const gain = parseInt(elements.gain.value);
    
    try {
        logMessage(`Setting gain to ${gain}...`, 'info');
        // Use the exposure endpoint to set gain, keeping the current exposure value
        await apiRequest('/exposure', 'POST', { 
            exposure_ms: parseInt(elements.exposureTime.value),
            gain: gain
        });
        logMessage(`Gain set to ${gain}`, 'success');
    } catch (error) {
        logMessage(`Error setting gain: ${error.message}`, 'error');
    }
}

// Set ROI
async function setRoi() {
    const roi = {
        start_x: parseInt(elements.roiStartX.value),
        start_y: parseInt(elements.roiStartY.value),
        width: parseInt(elements.roiWidth.value),
        height: parseInt(elements.roiHeight.value)
    };
    
    try {
        logMessage(`Setting ROI to (${roi.start_x},${roi.start_y}) ${roi.width}x${roi.height}...`, 'info');
        await apiRequest('/roi', 'POST', roi);
        logMessage(`ROI set successfully`, 'success');
        
        // Update the ROI visualization
        updateRoiVisualization(roi);
    } catch (error) {
        logMessage(`Error setting ROI: ${error.message}`, 'error');
    }
}

// Function to draw ROI visualization
function updateRoiVisualization(roi) {
    const canvas = elements.roiCanvas;
    if (!canvas) {
        console.error('ROI canvas element not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Sensor dimensions
    const sensorWidth = 5496;
    const sensorHeight = 3672;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate scale to fit sensor in canvas
    // We'll keep the aspect ratio of the sensor
    const sensorAspect = sensorWidth / sensorHeight;
    const canvasAspect = width / height;
    
    let drawWidth, drawHeight;
    if (sensorAspect > canvasAspect) {
        // Sensor is wider than canvas (relative to height)
        drawWidth = width;
        drawHeight = width / sensorAspect;
    } else {
        // Sensor is taller than canvas (relative to width)
        drawHeight = height;
        drawWidth = height * sensorAspect;
    }
    
    // Center the sensor rectangle in the canvas
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;
    
    // Draw sensor outline
    ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#666' : '#888';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, drawWidth, drawHeight);
    
    // Calculate ROI position and size in canvas coordinates
    const roiX = offsetX + (roi.start_x / sensorWidth) * drawWidth;
    const roiY = offsetY + (roi.start_y / sensorHeight) * drawHeight;
    const roiWidth = (roi.width / sensorWidth) * drawWidth;
    const roiHeight = (roi.height / sensorHeight) * drawHeight;
    
    // Draw ROI rectangle
    ctx.strokeStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#00b4ff' : '#3498db';
    ctx.lineWidth = 2;
    ctx.strokeRect(roiX, roiY, roiWidth, roiHeight);
    
    // Fill ROI with translucent color
    ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? 
        'rgba(0, 180, 255, 0.15)' : 'rgba(52, 152, 219, 0.15)';
    ctx.fillRect(roiX, roiY, roiWidth, roiHeight);
    
    // Update ROI dimensions text
    if (elements.roiDimensions) {
        elements.roiDimensions.textContent = `Current ROI: ${roi.width} × ${roi.height} pixels`;
    }
}

// Set wavelength calibration
async function setCalibration() {
    // Create array of coefficients [a, b, c] for polynomial calibration
    const coefficients = [
        parseFloat(elements.wavelengthA.value),
        parseFloat(elements.wavelengthB.value),
        parseFloat(elements.wavelengthC.value)
    ];
    
    const laserWavelength = parseFloat(elements.laserWavelength.value);
    
    try {
        logMessage(`Setting calibration coefficients to [${coefficients.join(', ')}]...`, 'info');
        await apiRequest('/calibration', 'POST', { 
            coefficients: coefficients
        });
        logMessage(`Calibration set successfully`, 'success');
        
        // Store the laser wavelength in localStorage
        localStorage.setItem('laserWavelength', laserWavelength);
        
        // If we already have spectrum data, recalculate Raman shifts
        if (appState.wavelengths && appState.currentSpectrum) {
            appState.ramanShifts = calculateRamanShifts(appState.wavelengths);
            
            // If in Raman mode, redraw the spectrum
            if (appState.displayMode === 'raman') {
                drawSpectrum(appState.wavelengths, appState.currentSpectrum);
            }
        }
    } catch (error) {
        logMessage(`Error setting calibration: ${error.message}`, 'error');
    }
}

// Acquire spectrum
async function acquireSpectrum() {
    try {
        // Get the exposure time to determine if we need a countdown
        const exposureTime = parseInt(elements.exposureTime.value, 10);
        const needsCountdown = exposureTime >= 1000;
        
        // Disable the acquire button during acquisition
        elements.acquireSpectrumBtn.disabled = true;
        
        // Show acquisition in progress
        logMessage('Acquiring spectrum...', 'info');
        
        // Set up countdown timer if needed
        let countdownTimer;
        let remainingTime = Math.ceil(exposureTime / 1000);
        
        if (needsCountdown) {
            // Initial status update
            elements.acquisitionStatus.textContent = `Acquiring... ${remainingTime}s`;
            elements.acquisitionStatus.classList.add('active', 'countdown');
            
            // Start countdown timer
            countdownTimer = setInterval(() => {
                remainingTime--;
                if (remainingTime <= 0) {
                    // Clear timer if we reach zero
                    clearInterval(countdownTimer);
                    elements.acquisitionStatus.textContent = 'Processing...';
                } else {
                    elements.acquisitionStatus.textContent = `Acquiring... ${remainingTime}s`;
                }
            }, 1000);
        } else {
            // For short exposures, just show "Acquiring..."
            elements.acquisitionStatus.textContent = 'Acquiring...';
            elements.acquisitionStatus.classList.add('active');
        }
        
        // Make the API request to acquire the spectrum
        const spectrumData = await apiRequest('/acquire/spectrum?include_image=true', 'GET');
        
        // Clear any active countdown
        if (countdownTimer) {
            clearInterval(countdownTimer);
        }
        
        // Store the spectrum data and update display
        appState.wavelengths = spectrumData.wavelengths;
        appState.currentSpectrum = spectrumData.intensities;
        appState.originalSpectrum = [...spectrumData.intensities]; // Store copy for baseline correction
        appState.baselineCorrected = false;
        
        // Calculate Raman shifts if we have a laser wavelength
        appState.ramanShifts = calculateRamanShifts(appState.wavelengths);
        
        // Store and display the image data if available
        if (spectrumData.image_data) {
            appState.imageData = spectrumData.image_data;
            logMessage('Image data received from spectrum acquisition', 'info');
            
            // Display the image automatically
            displayCachedImage();
        }
        
        // Apply baseline correction if selected
        if (elements.baselineCorrection.value !== 'none') {
            appState.currentSpectrum = applyBaselineCorrection(
                appState.wavelengths, 
                appState.currentSpectrum
            );
        }
        
        // Draw spectrum
        drawSpectrum(appState.wavelengths, appState.currentSpectrum);
        
        // Enable export buttons
        elements.saveSpectrumBtn.disabled = false;
        elements.copyDataBtn.disabled = false;
        
        // Clear the status indicator after a brief delay
        setTimeout(() => {
            elements.acquisitionStatus.textContent = 'Complete';
            
            // Fade out the status indicator after another brief delay
            setTimeout(() => {
                elements.acquisitionStatus.classList.remove('active', 'countdown');
                // Re-enable the acquire button
                elements.acquireSpectrumBtn.disabled = false;
            }, 1000);
        }, 500);
        
        logMessage('Spectrum acquired successfully', 'success');
    } catch (error) {
        // Clear the status indicator on error
        elements.acquisitionStatus.textContent = 'Error';
        elements.acquisitionStatus.classList.add('active');
        
        // Fade out the status indicator after a delay
        setTimeout(() => {
            elements.acquisitionStatus.classList.remove('active', 'countdown');
            // Re-enable the acquire button
            elements.acquireSpectrumBtn.disabled = false;
        }, 2000);
        
        logMessage(`Error acquiring spectrum: ${error.message}`, 'error');
    }
}

// Function to display cached image data
function displayCachedImage() {
    if (!appState.imageData) {
        return;
    }
    
    const imageContainer = elements.cameraImage.parentElement;
    
    // Set image from cached data
    elements.cameraImage.onload = function() {
        // Remove loading indicator and show image
        imageContainer.classList.remove('loading');
        elements.cameraImage.style.display = 'block';
        logMessage('Camera image displayed', 'info');
    };
    
    // Show loading indicator while image loads
    imageContainer.classList.add('loading');
    elements.cameraImage.style.display = 'none';
    elements.cameraImage.src = appState.imageData;
}

// Draw spectrum using Plotly.js
function drawSpectrum(wavelengths, intensities) {
    if (!wavelengths || !intensities || wavelengths.length === 0) {
        return;
    }
    
    // Choose x-axis data based on display mode
    let xData, xAxisTitle;
    if (appState.displayMode === 'wavelength') {
        xData = wavelengths;
        xAxisTitle = 'Wavelength (nm)';
    } else {
        if (!appState.ramanShifts) {
            appState.ramanShifts = calculateRamanShifts(wavelengths);
            if (!appState.ramanShifts) {
                logMessage('Could not calculate Raman shifts. Using wavelength instead.', 'warning');
                xData = wavelengths;
                xAxisTitle = 'Wavelength (nm)';
                appState.displayMode = 'wavelength';
                elements.wavelengthModeBtn.classList.add('active');
                elements.ramanModeBtn.classList.remove('active');
            } else {
                xData = appState.ramanShifts;
                xAxisTitle = 'Raman Shift (cm⁻¹)';
            }
        } else {
            xData = appState.ramanShifts;
            xAxisTitle = 'Raman Shift (cm⁻¹)';
        }
    }
    
    // Update plot layout with current axis title
    appState.plotLayout.xaxis.title = xAxisTitle;
    
    // Determine line color based on theme
    const lineColor = document.documentElement.getAttribute('data-theme') === 'dark' ? 
        '#00b4ff' : // Thorlabs blue for dark mode
        '#3498db';  // Original blue for light mode
        
    Plotly.react('spectrum-plot', [{
        x: xData,
        y: intensities,
        type: 'scatter',
        mode: 'lines',
        line: {
            color: lineColor,
            width: 2
        },
        name: 'Spectrum'
    }], appState.plotLayout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
        displaylogo: false
    });
}

// Save spectrum data
function saveSpectrum() {
    if (!appState.wavelengths || !appState.currentSpectrum) {
        logMessage('No spectrum data to save', 'warning');
        return;
    }
    
    try {
        // Create CSV content with appropriate x-axis values
        let csvContent;
        
        if (appState.displayMode === 'wavelength') {
            csvContent = 'Wavelength (nm),Intensity\n';
            for (let i = 0; i < appState.wavelengths.length; i++) {
                csvContent += `${appState.wavelengths[i]},${appState.currentSpectrum[i]}\n`;
            }
        } else {
            csvContent = 'Raman Shift (cm⁻¹),Intensity\n';
            for (let i = 0; i < appState.ramanShifts.length; i++) {
                csvContent += `${appState.ramanShifts[i]},${appState.currentSpectrum[i]}\n`;
            }
        }
        
        // Add metadata
        csvContent = `# Acquisition Metadata\n# Laser Wavelength: ${elements.laserWavelength.value} nm\n# Baseline Correction: ${elements.baselineCorrection.value}\n# Display Mode: ${appState.displayMode}\n\n${csvContent}`;
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `spectrum_${timestamp}.csv`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logMessage(`Spectrum saved as ${filename}`, 'success');
    } catch (error) {
        logMessage(`Error saving spectrum: ${error.message}`, 'error');
    }
}

// Copy spectrum data to clipboard
function copyData() {
    if (!appState.wavelengths || !appState.currentSpectrum) {
        logMessage('No spectrum data to copy', 'warning');
        return;
    }
    
    try {
        // Create CSV content with appropriate x-axis values
        let csvContent;
        
        if (appState.displayMode === 'wavelength') {
            csvContent = 'Wavelength (nm),Intensity\n';
            for (let i = 0; i < appState.wavelengths.length; i++) {
                csvContent += `${appState.wavelengths[i]},${appState.currentSpectrum[i]}\n`;
            }
        } else {
            csvContent = 'Raman Shift (cm⁻¹),Intensity\n';
            for (let i = 0; i < appState.ramanShifts.length; i++) {
                csvContent += `${appState.ramanShifts[i]},${appState.currentSpectrum[i]}\n`;
            }
        }
        
        // Add metadata
        csvContent = `# Acquisition Metadata\n# Laser Wavelength: ${elements.laserWavelength.value} nm\n# Baseline Correction: ${elements.baselineCorrection.value}\n# Display Mode: ${appState.displayMode}\n\n${csvContent}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(csvContent)
            .then(() => {
                logMessage('Spectrum data copied to clipboard', 'success');
            })
            .catch(err => {
                logMessage(`Clipboard copy failed: ${err.message}`, 'error');
            });
    } catch (error) {
        logMessage(`Error copying spectrum data: ${error.message}`, 'error');
    }
}

// Toggle UI elements based on connection state
function toggleUIElements(connected) {
    // Helper function to safely toggle disabled state
    const safeToggle = (element, isDisabled) => {
        if (element) {
            element.disabled = isDisabled;
        }
    };
    
    // Disable/enable connection buttons
    safeToggle(elements.connectBtn, connected);
    safeToggle(elements.disconnectBtn, !connected);
    
    // Disable/enable all other buttons
    safeToggle(elements.setExposureBtn, !connected);
    safeToggle(elements.setGainBtn, !connected);
    safeToggle(elements.setRoiBtn, !connected);
    safeToggle(elements.setCalibrationBtn, !connected);
    safeToggle(elements.setProcessingBtn, !connected);
    safeToggle(elements.acquireSpectrumBtn, !connected);
    
    // Reset acquisition status when disconnecting
    if (!connected && elements.acquisitionStatus) {
        elements.acquisitionStatus.textContent = '';
        elements.acquisitionStatus.classList.remove('active', 'countdown');
    }
    
    // Keep these disabled unless we have spectrum data
    const hasSpectrum = appState.wavelengths && appState.currentSpectrum;
    safeToggle(elements.saveSpectrumBtn, !connected || !hasSpectrum);
    safeToggle(elements.copyDataBtn, !connected || !hasSpectrum);
}

// Add message to log
function logMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;
    elements.logContainer.appendChild(logEntry);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
}

// Clear log
function clearLog() {
    elements.logContainer.innerHTML = '';
    logMessage('Log cleared', 'info');
}

// Helper function to check which elements are null
function checkElements() {
    console.log("Checking DOM elements:");
    for (const [key, value] of Object.entries(elements)) {
        if (!value) {
            console.error(`Missing DOM element: ${key}`);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check which elements are null before initializing
    checkElements();
    
    // Initialize the application
    initApp();
    
    // Initialize ROI visualization with default values
    const defaultRoi = {
        start_x: parseInt(elements.roiStartX.value) || 0,
        start_y: parseInt(elements.roiStartY.value) || 0,
        width: parseInt(elements.roiWidth.value) || 5496,
        height: parseInt(elements.roiHeight.value) || 3672
    };
    
    // Initialize baseline correction dropdown handler
    toggleBaselineCorrectionOptions();
    elements.baselineCorrection.addEventListener('change', toggleBaselineCorrectionOptions);
    
    // Draw initial ROI visualization
    setTimeout(() => updateRoiVisualization(defaultRoi), 500);
});

// Theme toggle functionality
function setupThemeToggle() {
    if (!elements.themeToggleBtn || !elements.themeIcon) {
        logMessage('Theme toggle elements not found', 'warning');
        return;
    }

    // Check for saved user preference
    const savedTheme = localStorage.getItem('theme');
    
    // Set initial theme
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeIcon.textContent = '☀️'; // Sun icon for switching to light
    } else {
        document.documentElement.removeAttribute('data-theme');
        elements.themeIcon.textContent = '🌙'; // Moon icon for switching to dark
    }
    
    // Add event listener
    elements.themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        
        if (currentTheme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            elements.themeIcon.textContent = '🌙'; // Moon icon for switching to dark
            logMessage('Light theme activated', 'info');
            
            // Update Plotly theme
            updatePlotlyTheme();
            
            // Update ROI visualization with current values
            const roi = {
                start_x: parseInt(elements.roiStartX.value) || 0,
                start_y: parseInt(elements.roiStartY.value) || 0,
                width: parseInt(elements.roiWidth.value) || 5496,
                height: parseInt(elements.roiHeight.value) || 3672
            };
            updateRoiVisualization(roi);
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            elements.themeIcon.textContent = '☀️'; // Sun icon for switching to light
            logMessage('Dark theme activated', 'info');
            
            // Update Plotly theme
            updatePlotlyTheme();
            
            // Update ROI visualization with current values
            const roi = {
                start_x: parseInt(elements.roiStartX.value) || 0,
                start_y: parseInt(elements.roiStartY.value) || 0,
                width: parseInt(elements.roiWidth.value) || 5496,
                height: parseInt(elements.roiHeight.value) || 3672
            };
            updateRoiVisualization(roi);
        }
    });
}

// Update Plotly theme
function updatePlotlyTheme() {
    if (!elements.spectrumPlot) return;
    
    // Only update if we have a plot with data
    if (appState.wavelengths && appState.currentSpectrum) {
        // Choose x-axis data based on display mode
        let xData;
        if (appState.displayMode === 'wavelength') {
            xData = appState.wavelengths;
        } else {
            xData = appState.ramanShifts || appState.wavelengths;
        }
        
        // Determine line color based on theme
        const lineColor = document.documentElement.getAttribute('data-theme') === 'dark' ? 
            '#00b4ff' : // Thorlabs blue for dark mode
            '#3498db';  // Original blue for light mode
            
        Plotly.react('spectrum-plot', [{
            x: xData,
            y: appState.currentSpectrum,
            type: 'scatter',
            mode: 'lines',
            line: {
                color: lineColor,
                width: 2
            },
            name: 'Spectrum'
        }], {
            ...appState.plotLayout,
            plot_bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--plot-bg-color').trim(),
            paper_bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--plot-bg-color').trim(),
            font: {
                color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim()
            },
            xaxis: {
                ...appState.plotLayout.xaxis,
                gridcolor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#444' : '#eee',
                zerolinecolor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#444' : '#eee',
                showgrid: true
            },
            yaxis: {
                ...appState.plotLayout.yaxis,
                gridcolor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#444' : '#eee',
                zerolinecolor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#444' : '#eee',
                showgrid: true
            }
        }, {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
            displaylogo: false
        });
    }
} 