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
    displayMode: 'pixels', // 'wavelength' or 'raman' or 'pixels'
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
    
    // Settings defaults
    loadDefaultsBtn: document.getElementById('load-defaults-btn'),
    saveAsDefaultBtn: document.getElementById('save-as-default-btn'),
    
    // Display mode
    wavelengthModeBtn: document.getElementById('wavelength-mode-btn'),
    ramanModeBtn: document.getElementById('raman-mode-btn'),
    pixelsModeBtn: document.getElementById('pixels-mode-btn'),
    
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
    readoutMode: document.getElementById('readout-mode'),
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
    
    // Settings defaults buttons
    elements.loadDefaultsBtn.addEventListener('click', loadDefaultSettings);
    elements.saveAsDefaultBtn.addEventListener('click', saveAsDefaultSettings);
    
    // Set up display mode toggle
    elements.wavelengthModeBtn.addEventListener('click', () => setDisplayMode('wavelength'));
    elements.ramanModeBtn.addEventListener('click', () => setDisplayMode('raman'));
    elements.pixelsModeBtn.addEventListener('click', () => setDisplayMode('pixels'));
    
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
    
    // Initialize theme first
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    // Set initial theme
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (elements.themeIcon) {
            elements.themeIcon.textContent = '☀️';
        }
    } else {
        document.documentElement.removeAttribute('data-theme');
        if (elements.themeIcon) {
            elements.themeIcon.textContent = '🌙';
        }
    }
    
    // Set up theme toggle
    setupThemeToggle();
    
    // Get theme colors
    const root = document.documentElement;
    const plotBgColor = root.style.getPropertyValue('--plot-bg-color') || 
                       getComputedStyle(root).getPropertyValue('--plot-bg-color').trim() ||
                       (isDarkMode ? '#1a1a1a' : '#ffffff');
    const textColor = root.style.getPropertyValue('--text-color') || 
                     getComputedStyle(root).getPropertyValue('--text-color').trim() ||
                     (isDarkMode ? '#ffffff' : '#000000');
    const gridColor = isDarkMode ? '#444' : '#eee';
    
    // Initialize default Plotly layout with correct theme
    appState.plotLayout = {
        title: '',
        xaxis: {
            title: 'Wavelength (nm)',
            gridcolor: gridColor,
            zerolinecolor: gridColor,
            showgrid: true
        },
        yaxis: {
            title: 'Intensity',
            gridcolor: gridColor,
            zerolinecolor: gridColor,
            showgrid: true,
            range: [0, 65535]  // Set default range to the full 16-bit ADC range
        },
        margin: { t: 30, l: 60, r: 30, b: 60 },
        plot_bgcolor: plotBgColor,
        paper_bgcolor: plotBgColor,
        hovermode: 'closest',
        font: {
            color: textColor
        }
    };
    
    // Initialize empty plot with correct theme
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

// Fetch default settings from server without connecting
// This function is only called when loadDefaultSettings is triggered while not connected
async function fetchServerDefaultSettings() {
    try {
        logMessage('Loading server default settings...', 'info');
        
        // Make a special API call to get default settings without connecting
        const response = await apiRequest('/api/settings/defaults', 'GET');
        
        if (response && response.success && response.settings) {
            const settings = response.settings;
            logMessage('Default settings loaded from server', 'success');
            
            // Update exposure and gain
            if (settings.camera) {
                if (settings.camera.exposure_ms !== undefined) {
                    elements.exposureTime.value = settings.camera.exposure_ms;
                    console.log('Set exposure to:', settings.camera.exposure_ms);
                }
                if (settings.camera.gain !== undefined) {
                    elements.gain.value = settings.camera.gain;
                    console.log('Set gain to:', settings.camera.gain);
                }
                
                // Update ROI settings
                if (settings.camera.roi) {
                    const roi = settings.camera.roi;
                    elements.roiStartX.value = roi.start_x || '';
                    elements.roiStartY.value = roi.start_y || '';
                    elements.roiWidth.value = roi.width || '';
                    elements.roiHeight.value = roi.height || '';
                    
                    // Update ROI visualization if all values are present
                    if (roi.start_x !== undefined && roi.start_y !== undefined && 
                        roi.width !== undefined && roi.height !== undefined) {
                        updateRoiVisualization({
                            start_x: roi.start_x,
                            start_y: roi.start_y,
                            width: roi.width,
                            height: roi.height
                        });
                    }
                }
            }
            
            // Update calibration settings
            if (settings.calibration && settings.calibration.wavelength_coefficients) {
                const coeffs = settings.calibration.wavelength_coefficients;
                elements.wavelengthA.value = coeffs[0] !== undefined ? coeffs[0] : '';
                elements.wavelengthB.value = coeffs[1] !== undefined ? coeffs[1] : '';
                elements.wavelengthC.value = coeffs[2] !== undefined ? coeffs[2] : '';
                
                if (settings.calibration.laser_wavelength) {
                    elements.laserWavelength.value = settings.calibration.laser_wavelength;
                    localStorage.setItem('laserWavelength', settings.calibration.laser_wavelength);
                }
            }
            
            // Update processing settings
            if (settings.processing) {
                // Handle readout_mode
                if (settings.processing.readout_mode !== undefined) {
                    elements.readoutMode.value = settings.processing.readout_mode;
                }
                
                if (settings.processing.baseline_correction) {
                    elements.baselineCorrection.value = settings.processing.baseline_correction;
                    
                    // Show/hide polynomial degree based on selected method
                    toggleBaselineCorrectionOptions();
                    
                    if (settings.processing.polynomial_degree) {
                        elements.polynomialDegree.value = settings.processing.polynomial_degree;
                    }
                }
            }
            
            // Update display settings and axis range
            if (settings.display) {
                // Set display mode if specified
                if (settings.display.mode) {
                    setDisplayMode(settings.display.mode);
                }
                
                // Update axis ranges if available
                if (appState.displayMode === 'wavelength' && settings.display.wavelength_range) {
                    elements.xMin.value = settings.display.wavelength_range[0];
                    elements.xMax.value = settings.display.wavelength_range[1];
                } else if (appState.displayMode === 'raman' && settings.display.raman_range) {
                    elements.xMin.value = settings.display.raman_range[0];
                    elements.xMax.value = settings.display.raman_range[1];
                } else if (appState.displayMode === 'pixels' && settings.display.pixels_range) {
                    elements.xMin.value = settings.display.pixels_range[0];
                    elements.xMax.value = settings.display.pixels_range[1];
                }
                
                // If xMin and xMax are set, update plot layout
                if (elements.xMin.value && elements.xMax.value) {
                    const xMin = parseFloat(elements.xMin.value);
                    const xMax = parseFloat(elements.xMax.value);
                    
                    if (!isNaN(xMin) && !isNaN(xMax) && xMin < xMax) {
                        // Update plot layout
                        const layout = {
                            xaxis: {
                                title: appState.displayMode === 'wavelength' ? 'Wavelength (nm)' : 
                                       appState.displayMode === 'raman' ? 'Raman Shift (cm⁻¹)' : 'Pixels',
                                range: [xMin, xMax]
                            }
                        };
                        
                        Plotly.relayout('spectrum-plot', layout);
                        logMessage(`Axis range set to [${xMin}, ${xMax}]`, 'info');
                    }
                }
            }
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        logMessage(`Error loading server default settings: ${error.message}. Connect to the device to configure settings.`, 'error');
        console.error('Could not fetch server default settings:', error);
    }
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

// Set display mode (wavelength or Raman shift or pixels)
function setDisplayMode(mode) {
    if (mode === appState.displayMode) return;
    
    appState.displayMode = mode;
    
    // Update button states
    if (mode === 'wavelength') {
        elements.wavelengthModeBtn.classList.add('active');
        elements.ramanModeBtn.classList.remove('active');
        elements.pixelsModeBtn.classList.remove('active');
    } else if (mode === 'raman') {
        elements.wavelengthModeBtn.classList.remove('active');
        elements.ramanModeBtn.classList.add('active');
        elements.pixelsModeBtn.classList.remove('active');
    } else {
        elements.wavelengthModeBtn.classList.remove('active');
        elements.ramanModeBtn.classList.remove('active');
        elements.pixelsModeBtn.classList.add('active');
    }
    
    // Update axis labels and ranges
    resetAxisRange();
    
    // Redraw the spectrum if we have data
    if (appState.wavelengths && appState.currentSpectrum) {
        drawSpectrum(appState.wavelengths, appState.currentSpectrum);
    }
    
    logMessage(`Display mode changed to ${mode === 'wavelength' ? 'Wavelength (nm)' : mode === 'raman' ? 'Raman Shift (cm⁻¹)' : 'Pixels'}`, 'info');
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
async function resetAxisRange() {
    // Only try to get values from server if connected
    if (!appState.connected) {
        // Just update the axis title without setting values
        const layout = {
            xaxis: {
                title: appState.displayMode === 'wavelength' ? 'Wavelength (nm)' : appState.displayMode === 'raman' ? 'Raman Shift (cm⁻¹)' : 'Pixels'
            }
        };
        
        Plotly.relayout('spectrum-plot', layout);
        return;
    }
    
    let xMin, xMax;
    
    try {
        // Try to get range values from server
        const response = await apiRequest('/api/settings/defaults', 'GET');
        
        if (response && response.success && response.settings && response.settings.display) {
            if (appState.displayMode === 'wavelength') {
                if (response.settings.display.wavelength_range && 
                    response.settings.display.wavelength_range.length === 2) {
                    [xMin, xMax] = response.settings.display.wavelength_range;
                }
                // Update plot layout for wavelength
                appState.plotLayout.xaxis.title = 'Wavelength (nm)';
            } else if (appState.displayMode === 'raman') {
                if (response.settings.display.raman_range && 
                    response.settings.display.raman_range.length === 2) {
                    [xMin, xMax] = response.settings.display.raman_range;
                }
                // Update plot layout for Raman shift
                appState.plotLayout.xaxis.title = 'Raman Shift (cm⁻¹)';
            } else {
                if (response.settings.display.pixels_range && 
                    response.settings.display.pixels_range.length === 2) {
                    [xMin, xMax] = response.settings.display.pixels_range;
                }
                // Update plot layout for pixels
                appState.plotLayout.xaxis.title = 'Pixels';
            }
        } else {
            // If server doesn't provide values, leave fields empty
            elements.xMin.value = '';
            elements.xMax.value = '';
            
            // Update only the axis title
            const layout = {
                xaxis: {
                    title: appState.displayMode === 'wavelength' ? 'Wavelength (nm)' : appState.displayMode === 'raman' ? 'Raman Shift (cm⁻¹)' : 'Pixels'
                }
            };
            
            Plotly.relayout('spectrum-plot', layout);
            logMessage(`Axis title updated`, 'info');
            return;
        }
    } catch (error) {
        // If there's an error, leave fields empty
        elements.xMin.value = '';
        elements.xMax.value = '';
        
        // Update only the axis title
        const layout = {
            xaxis: {
                title: appState.displayMode === 'wavelength' ? 'Wavelength (nm)' : appState.displayMode === 'raman' ? 'Raman Shift (cm⁻¹)' : 'Pixels'
            }
        };
        
        Plotly.relayout('spectrum-plot', layout);
        logMessage(`Error loading axis range defaults: ${error.message}`, 'warning');
        return;
    }
    
    // Update input fields if we have valid values
    if (xMin !== undefined && xMax !== undefined) {
        elements.xMin.value = xMin;
        elements.xMax.value = xMax;
        
        // Update plot layout
        const layout = {
            xaxis: {
                title: appState.plotLayout.xaxis.title,
                range: [xMin, xMax]
            }
        };
        
        Plotly.relayout('spectrum-plot', layout);
        logMessage(`Axis range reset to [${xMin}, ${xMax}]`, 'info');
    }
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
    // Get readout mode from dropdown
    const readoutMode = elements.readoutMode.value;
    // Baseline correction is disabled, always use 'none'
    const baselineMethod = 'none';
    
    try {
        logMessage(`Setting processing options: Readout=${readoutMode}`, 'info');
        
        await apiRequest('/processing', 'POST', { 
            readout_mode: readoutMode
        });
        
        // Apply baseline correction client-side if we have data
        if (appState.wavelengths && appState.currentSpectrum) {
            // If the spectrum was previously baseline corrected, restore original data
            if (appState.baselineCorrected) {
                appState.currentSpectrum = [...appState.originalSpectrum];
                appState.baselineCorrected = false;
                appState.originalSpectrum = null;
                
                // Redraw the spectrum with processed data
                drawSpectrum(appState.wavelengths, appState.currentSpectrum);
            }
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
        logMessage('Default settings from default_settings.json have been applied to the camera', 'info');
        
        // Get current settings with cache-busting parameter to ensure fresh data
        try {
            const statusData = await apiRequest('/status?_nocache=' + new Date().getTime(), 'GET');
            console.log('Status data:', statusData);
            
            if (statusData) {
                // Store the current exposure and gain values
                if (statusData.settings) {
                    // Check for Exposure (capital E) which is in microseconds
                    if ('Exposure' in statusData.settings) {
                        // Convert from microseconds to milliseconds
                        // Server returns Exposure in microseconds (μs), but UI displays in milliseconds (ms)
                        // Example: Server returns 100000 μs which is 100 ms in the UI
                        const exposureMs = Math.round(statusData.settings.Exposure / 1000);
                        elements.exposureTime.value = exposureMs;
                        console.log('Set exposure from Exposure (μs):', statusData.settings.Exposure, '→', exposureMs, 'ms');
                    } 
                    // Also check lowercase version
                    else if ('exposure_ms' in statusData.settings) {
                        elements.exposureTime.value = statusData.settings.exposure_ms;
                        console.log('Set exposure from exposure_ms:', statusData.settings.exposure_ms);
                    }
                    
                    // Check for Gain (capital G)
                    if ('Gain' in statusData.settings) {
                        elements.gain.value = statusData.settings.Gain;
                        console.log('Set gain from Gain:', statusData.settings.Gain);
                    }
                    // Also check lowercase version
                    else if ('gain' in statusData.settings) {
                        elements.gain.value = statusData.settings.gain;
                        console.log('Set gain from gain:', statusData.settings.gain);
                    }
                    
                    // Log actual values that were set
                    logMessage(`Current settings: Exposure=${elements.exposureTime.value}ms, Gain=${elements.gain.value}`, 'info');
                } else {
                    logMessage('Warning: No settings data received from server', 'warning');
                }
                
                if (statusData.roi) {
                    if (statusData.roi.start_x !== undefined) elements.roiStartX.value = statusData.roi.start_x;
                    if (statusData.roi.start_y !== undefined) elements.roiStartY.value = statusData.roi.start_y;
                    if (statusData.roi.width !== undefined) elements.roiWidth.value = statusData.roi.width;
                    if (statusData.roi.height !== undefined) elements.roiHeight.value = statusData.roi.height;
                    
                    logMessage(`Current ROI: (${statusData.roi.start_x},${statusData.roi.start_y}) ${statusData.roi.width}x${statusData.roi.height}`, 'info');
                    
                    // Update ROI visualization only if all values are valid
                    if (statusData.roi.start_x !== undefined && statusData.roi.start_y !== undefined &&
                        statusData.roi.width !== undefined && statusData.roi.height !== undefined) {
                        updateRoiVisualization(statusData.roi);
                    }
                }
                
                if (statusData.calibration && statusData.calibration.coefficients) {
                    const coeffs = statusData.calibration.coefficients;
                    if (coeffs[0] !== undefined) elements.wavelengthA.value = coeffs[0];
                    if (coeffs[1] !== undefined) elements.wavelengthB.value = coeffs[1];
                    if (coeffs.length > 2 && coeffs[2] !== undefined) elements.wavelengthC.value = coeffs[2];
                    
                    // Set laser wavelength with priority:
                    // 1. From server if available
                    // 2. From localStorage if available
                    // 3. From default settings if needed
                    let laserWavelengthSet = false;
                    
                    // First check if it's in the server response
                    if (statusData.calibration.laser_wavelength) {
                        elements.laserWavelength.value = statusData.calibration.laser_wavelength;
                        laserWavelengthSet = true;
                        console.log('Set laser wavelength from server:', statusData.calibration.laser_wavelength);
                    }
                    
                    // Next, try localStorage (only if not already set)
                    if (!laserWavelengthSet) {
                        const savedLaserWL = localStorage.getItem('laserWavelength');
                        if (savedLaserWL && !isNaN(parseFloat(savedLaserWL))) {
                            elements.laserWavelength.value = parseFloat(savedLaserWL);
                            laserWavelengthSet = true;
                            console.log('Set laser wavelength from localStorage:', savedLaserWL);
                        }
                    }
                    
                    // Finally, if still not set, fetch from default settings
                    if (!laserWavelengthSet) {
                        try {
                            const defaultsResponse = await apiRequest('/api/settings/defaults', 'GET');
                            if (defaultsResponse && defaultsResponse.success && 
                                defaultsResponse.settings && 
                                defaultsResponse.settings.calibration && 
                                defaultsResponse.settings.calibration.laser_wavelength) {
                                elements.laserWavelength.value = defaultsResponse.settings.calibration.laser_wavelength;
                                laserWavelengthSet = true;
                                console.log('Set laser wavelength from defaults:', defaultsResponse.settings.calibration.laser_wavelength);
                            }
                        } catch (err) {
                            console.error('Could not fetch laser wavelength from defaults:', err);
                        }
                    }
                    
                    logMessage(`Current calibration: A=${elements.wavelengthA.value}, B=${elements.wavelengthB.value}, C=${elements.wavelengthC.value}, Laser=${elements.laserWavelength.value || 'unknown'}nm`, 'info');
                }
                
                if (statusData.processing) {
                    // Update processing settings
                    if (statusData.processing.readout_mode !== undefined) {
                        elements.readoutMode.value = statusData.processing.readout_mode;
                    }
                    
                    // Update baseline correction settings if available
                    if (statusData.processing.baseline_correction) {
                        elements.baselineCorrection.value = statusData.processing.baseline_correction;
                        
                        // Show/hide polynomial degree based on selected method
                        toggleBaselineCorrectionOptions();
                        
                        // Set polynomial degree if available
                        if (statusData.processing.polynomial_degree) {
                            elements.polynomialDegree.value = statusData.processing.polynomial_degree;
                        }
                    }
                    
                    logMessage(`Processing settings: Readout=${elements.readoutMode.value}`, 'info');
                }
            } else {
                logMessage('Connected, but received no settings data from device', 'warning');
            }
        } catch (error) {
            logMessage(`Connected, but error getting device settings: ${error.message}`, 'warning');
            console.error('Error fetching status after connection:', error);
        }
        
        // Update the axis range display with the values for the current display mode
        await resetAxisRange();
        
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
        // Add a cache-busting parameter to ensure we get fresh data
        const cacheBuster = new Date().getTime();
        const statusData = await apiRequest(`/status?_nocache=${cacheBuster}`, 'GET');
        
        if (statusData) {
            // Store the current exposure and gain values just in case
            const currentExposure = elements.exposureTime.value;
            const currentGain = elements.gain.value;
            
            if (statusData.settings) {
                // Check for Exposure (capital E) which is in microseconds
                if ('Exposure' in statusData.settings) {
                    // Convert from microseconds to milliseconds
                    elements.exposureTime.value = Math.round(statusData.settings.Exposure / 1000);
                    console.log('Updated exposure from Exposure (μs):', statusData.settings.Exposure, '→', elements.exposureTime.value, 'ms');
                } 
                // Also check lowercase version
                else if ('exposure_ms' in statusData.settings) {
                    elements.exposureTime.value = statusData.settings.exposure_ms;
                    console.log('Updated exposure from exposure_ms:', statusData.settings.exposure_ms);
                }
                
                // Check for Gain (capital G)
                if ('Gain' in statusData.settings) {
                    elements.gain.value = statusData.settings.Gain;
                    console.log('Updated gain from Gain:', statusData.settings.Gain);
                }
                // Also check lowercase version
                else if ('gain' in statusData.settings) {
                    elements.gain.value = statusData.settings.gain;
                    console.log('Updated gain from gain:', statusData.settings.gain);
                }
                
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
                
                // Check for laser wavelength in calibration settings
                if (statusData.calibration.laser_wavelength) {
                    elements.laserWavelength.value = statusData.calibration.laser_wavelength;
                    // Also update localStorage for consistency
                    localStorage.setItem('laserWavelength', statusData.calibration.laser_wavelength);
                    console.log('Updated laser wavelength from server:', statusData.calibration.laser_wavelength);
                }
                
                logMessage(`Current calibration: A=${elements.wavelengthA.value}, B=${elements.wavelengthB.value}, C=${elements.wavelengthC.value}, Laser=${elements.laserWavelength.value || 'unknown'}nm`, 'info');
            }
            
            if (statusData.processing) {
                // Update processing settings
                if (statusData.processing.readout_mode !== undefined) {
                    elements.readoutMode.value = statusData.processing.readout_mode;
                }
                
                // Update baseline correction settings if available
                if (statusData.processing.baseline_correction) {
                    elements.baselineCorrection.value = statusData.processing.baseline_correction;
                    
                    // Show/hide polynomial degree based on selected method
                    toggleBaselineCorrectionOptions();
                    
                    // Set polynomial degree if available
                    if (statusData.processing.polynomial_degree) {
                        elements.polynomialDegree.value = statusData.processing.polynomial_degree;
                    }
                }
                
                logMessage(`Processing settings: Readout=${elements.readoutMode.value}`, 'info');
            }
        }

        // After getting settings from the server, look for display.mode
        const defaultsResponse = await apiRequest('/api/settings/defaults', 'GET');
        if (defaultsResponse && defaultsResponse.success && defaultsResponse.settings) {
            // If there are any values in the defaults that weren't returned by getSpectrumeterSettings, apply them
            const defaults = defaultsResponse.settings;
            
            // Update laser wavelength if available in defaults
            if (defaults.calibration && defaults.calibration.laser_wavelength) {
                if (!elements.laserWavelength.value) {
                    elements.laserWavelength.value = defaults.calibration.laser_wavelength;
                    logMessage(`Set laser wavelength from defaults: ${defaults.calibration.laser_wavelength}nm`, 'info');
                }
            }

            // Set display mode if available
            if (defaults.display && defaults.display.mode) {
                setDisplayMode(defaults.display.mode);
                logMessage(`Set display mode from defaults: ${defaults.display.mode}`, 'info');
                
                // Explicitly reset axis range after changing display mode
                await resetAxisRange();
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
    const exposureMs = parseInt(elements.exposureTime.value);
    
    try {
        logMessage(`Setting gain to ${gain} with exposure ${exposureMs}ms...`, 'info');
        // Use the exposure endpoint to set gain, keeping the current exposure value
        await apiRequest('/exposure', 'POST', { 
            exposure_ms: exposureMs,
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
            coefficients: coefficients,
            laser_wavelength: laserWavelength
        });
        
        // Save the laser wavelength to localStorage for persistence
        if (!isNaN(laserWavelength) && laserWavelength > 0) {
            localStorage.setItem('laserWavelength', laserWavelength);
            logMessage(`Laser wavelength (${laserWavelength}nm) saved to server and browser storage`, 'info');
        }
        
        logMessage(`Calibration set successfully`, 'success');
        
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
        
        // Get readout mode from dropdown
        const readoutMode = elements.readoutMode.value;
        
        // Build query params without including undefined values
        let queryParams = `readout_mode=${readoutMode}&include_image=true`;
        
        // Make the API request to acquire the spectrum
        const spectrumData = await apiRequest('/acquire/spectrum?' + queryParams, 'GET');
        
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
    } else if (appState.displayMode === 'raman') {
        if (!appState.ramanShifts) {
            appState.ramanShifts = calculateRamanShifts(wavelengths);
            if (!appState.ramanShifts) {
                logMessage('Could not calculate Raman shifts. Using wavelength instead.', 'warning');
                xData = wavelengths;
                xAxisTitle = 'Wavelength (nm)';
                appState.displayMode = 'wavelength';
                elements.wavelengthModeBtn.classList.add('active');
                elements.ramanModeBtn.classList.remove('active');
                elements.pixelsModeBtn.classList.remove('active');
            } else {
                xData = appState.ramanShifts;
                xAxisTitle = 'Raman Shift (cm⁻¹)';
            }
        } else {
            xData = appState.ramanShifts;
            xAxisTitle = 'Raman Shift (cm⁻¹)';
        }
    } else {
        // Pixels mode - create an array of pixel indices (0, 1, 2, ...)
        xData = Array.from({ length: intensities.length }, (_, i) => i);
        xAxisTitle = 'Pixels';
    }
    
    // Update plot layout with current theme settings
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const updatedLayout = {
        ...appState.plotLayout,
        xaxis: {
            ...appState.plotLayout.xaxis,
            title: xAxisTitle,
            gridcolor: isDarkMode ? '#444' : '#eee',
            zerolinecolor: isDarkMode ? '#444' : '#eee',
            showgrid: true
        },
        yaxis: {
            ...appState.plotLayout.yaxis,
            gridcolor: isDarkMode ? '#444' : '#eee',
            zerolinecolor: isDarkMode ? '#444' : '#eee',
            showgrid: true
        },
        plot_bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--plot-bg-color').trim(),
        paper_bgcolor: getComputedStyle(document.documentElement).getPropertyValue('--plot-bg-color').trim(),
        font: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim()
        }
    };
    
    // Determine line color based on theme
    const lineColor = isDarkMode ? '#00b4ff' : '#3498db';
        
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
    }], updatedLayout, {
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
        } else if (appState.displayMode === 'raman') {
            csvContent = 'Raman Shift (cm⁻¹),Intensity\n';
            for (let i = 0; i < appState.ramanShifts.length; i++) {
                csvContent += `${appState.ramanShifts[i]},${appState.currentSpectrum[i]}\n`;
            }
        } else {
            csvContent = 'Pixel,Intensity\n';
            for (let i = 0; i < appState.currentSpectrum.length; i++) {
                csvContent += `${i},${appState.currentSpectrum[i]}\n`;
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
        } else if (appState.displayMode === 'raman') {
            csvContent = 'Raman Shift (cm⁻¹),Intensity\n';
            for (let i = 0; i < appState.ramanShifts.length; i++) {
                csvContent += `${appState.ramanShifts[i]},${appState.currentSpectrum[i]}\n`;
            }
        } else {
            csvContent = 'Pixel,Intensity\n';
            for (let i = 0; i < appState.currentSpectrum.length; i++) {
                csvContent += `${i},${appState.currentSpectrum[i]}\n`;
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
    
    // Disable baseline correction functionality while keeping the UI elements
    elements.baselineCorrection.disabled = true;
    elements.polynomialDegree.disabled = true;
    elements.baselineCorrection.value = 'none';
    elements.polynomialDegreeGroup.style.display = 'none';
    
    // Initialize baseline correction dropdown handler
    toggleBaselineCorrectionOptions();
    elements.baselineCorrection.addEventListener('change', toggleBaselineCorrectionOptions);
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
        const isDarkMode = currentTheme === 'dark';
        
        if (isDarkMode) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            elements.themeIcon.textContent = '🌙'; // Moon icon for switching to dark
            logMessage('Light theme activated', 'info');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            elements.themeIcon.textContent = '☀️'; // Sun icon for switching to light
            logMessage('Dark theme activated', 'info');
        }
        
        // Get updated theme colors
        const root = document.documentElement;
        const plotBgColor = root.style.getPropertyValue('--plot-bg-color') || 
                           getComputedStyle(root).getPropertyValue('--plot-bg-color').trim() ||
                           (!isDarkMode ? '#ffffff' : '#1a1a1a');
        const textColor = root.style.getPropertyValue('--text-color') || 
                         getComputedStyle(root).getPropertyValue('--text-color').trim() ||
                         (!isDarkMode ? '#000000' : '#ffffff');
        const gridColor = !isDarkMode ? '#eee' : '#444';
        
        // Update plot layout with new theme colors
        const updatedLayout = {
            ...appState.plotLayout,
            plot_bgcolor: plotBgColor,
            paper_bgcolor: plotBgColor,
            font: {
                color: textColor
            },
            xaxis: {
                ...appState.plotLayout.xaxis,
                gridcolor: gridColor,
                zerolinecolor: gridColor
            },
            yaxis: {
                ...appState.plotLayout.yaxis,
                gridcolor: gridColor,
                zerolinecolor: gridColor
            }
        };
        
        // Update the plot with new theme
        Plotly.relayout('spectrum-plot', updatedLayout);
        
        // Update ROI visualization with current values
        const roi = {
            start_x: parseInt(elements.roiStartX.value) || 0,
            start_y: parseInt(elements.roiStartY.value) || 0,
            width: parseInt(elements.roiWidth.value) || 5496,
            height: parseInt(elements.roiHeight.value) || 3672
        };
        updateRoiVisualization(roi);
    });
}

// Load default settings from server
async function loadDefaultSettings() {
    try {
        logMessage('Loading default settings...', 'info');
        
        // Check if we're connected
        if (!appState.connected) {
            logMessage('Not connected to spectrometer. Showing default values from server (read-only).', 'warning');
            // Just fetch and display the defaults without trying to apply to device
            await fetchServerDefaultSettings();
            return;
        }
        
        // Call API to load default settings
        const response = await apiRequest('/api/settings/load-defaults', 'POST');
        
        if (response && response.success) {
            logMessage('Default settings loaded successfully', 'success');
            
            // Add a small delay to ensure the server has applied all settings
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Refresh the UI with current settings without disconnecting
            await getSpectrumeterSettings();
            
            // Explicitly fetch default settings to pull additional values that might not be in the status
            try {
                const defaultsResponse = await apiRequest('/api/settings/defaults', 'GET');
                if (defaultsResponse && defaultsResponse.success && defaultsResponse.settings) {
                    // If there are any values in the defaults that weren't returned by getSpectrumeterSettings, apply them
                    const defaults = defaultsResponse.settings;
                    
                    // Update laser wavelength if available in defaults
                    if (defaults.calibration && defaults.calibration.laser_wavelength) {
                        if (!elements.laserWavelength.value) {
                            elements.laserWavelength.value = defaults.calibration.laser_wavelength;
                            logMessage(`Set laser wavelength from defaults: ${defaults.calibration.laser_wavelength}nm`, 'info');
                        }
                    }
                    
                    // Set display mode if available
                    if (defaults.display && defaults.display.mode) {
                        setDisplayMode(defaults.display.mode);
                        logMessage(`Set display mode from defaults: ${defaults.display.mode}`, 'info');
                        
                        // Explicitly reset axis range after changing display mode
                        await resetAxisRange();
                    }
                }
            } catch (err) {
                console.error('Error fetching additional default settings:', err);
            }
        } else {
            logMessage(`Failed to load default settings: ${response?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        logMessage(`Error loading default settings: ${error.message}`, 'error');
    }
}

// Save current settings as defaults
async function saveAsDefaultSettings() {
    try {
        logMessage('Saving current settings as defaults...', 'info');
        
        // First, update the display mode in the server settings
        try {
            const displayResponse = await apiRequest('/api/settings/display', 'POST', {
                mode: appState.displayMode
            });
            
            if (displayResponse && displayResponse.success) {
                logMessage(`Display mode '${appState.displayMode}' updated on server`, 'info');
            }
        } catch (displayError) {
            logMessage(`Warning: Could not update display mode: ${displayError.message}`, 'warning');
            // Continue with saving defaults even if display mode update fails
        }
        
        // Call API to save current settings as defaults
        const saveResponse = await apiRequest('/api/settings/save-as-default', 'POST');
        
        if (saveResponse && saveResponse.success) {
            logMessage('Settings saved as defaults successfully', 'success');
        } else {
            logMessage(`Failed to save settings as defaults: ${saveResponse?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        logMessage(`Error saving settings as defaults: ${error.message}`, 'error');
    }
}