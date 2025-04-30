/**
 * ASI183MM Spectrometer Control Interface
 * JavaScript controller for API interactions
 */

// Configuration
const API_BASE_URL = 'http://localhost:8000';
const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

// State management
const appState = {
    connected: false,
    currentSpectrum: null,
    wavelengths: null,
    darkFrame: null,
    plotLayout: null
};

// DOM elements
const elements = {
    // Status elements
    connectionStatus: document.getElementById('connection-status'),
    connectBtn: document.getElementById('connect-btn'),
    disconnectBtn: document.getElementById('disconnect-btn'),
    
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
    roiBinning: document.getElementById('roi-binning'),
    setRoiBtn: document.getElementById('set-roi-btn'),
    
    // Calibration
    wavelengthA: document.getElementById('wavelength-a'),
    wavelengthB: document.getElementById('wavelength-b'),
    wavelengthC: document.getElementById('wavelength-c'),
    setCalibrationBtn: document.getElementById('set-calibration-btn'),
    
    // Acquisition
    acquireDarkBtn: document.getElementById('acquire-dark-btn'),
    acquireSpectrumBtn: document.getElementById('acquire-spectrum-btn'),
    
    // Spectrum display
    spectrumPlot: document.getElementById('spectrum-plot'),
    minValue: document.getElementById('min-value'),
    maxValue: document.getElementById('max-value'),
    avgValue: document.getElementById('avg-value'),
    
    // Plot controls
    autoScaleBtn: document.getElementById('auto-scale-btn'),
    fullRangeBtn: document.getElementById('full-range-btn'),
    setRangeBtn: document.getElementById('set-range-btn'),
    yMin: document.getElementById('y-min'),
    yMax: document.getElementById('y-max'),
    
    // Data export
    saveSpectrumBtn: document.getElementById('save-spectrum-btn'),
    copyDataBtn: document.getElementById('copy-data-btn'),
    
    // Log
    logContainer: document.getElementById('log-container'),
    clearLogBtn: document.getElementById('clear-log-btn')
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
    elements.acquireDarkBtn.addEventListener('click', acquireDark);
    elements.acquireSpectrumBtn.addEventListener('click', acquireSpectrum);
    elements.autoScaleBtn.addEventListener('click', autoScalePlot);
    elements.fullRangeBtn.addEventListener('click', setFullRange);
    elements.setRangeBtn.addEventListener('click', setYAxisRange);
    elements.saveSpectrumBtn.addEventListener('click', saveSpectrum);
    elements.copyDataBtn.addEventListener('click', copyData);
    elements.clearLogBtn.addEventListener('click', clearLog);
    
    // Set default values
    elements.exposureTime.value = 100;
    elements.gain.value = 0;
    
    // Initialize default Plotly layout
    appState.plotLayout = {
        title: 'Spectrum',
        xaxis: {
            title: 'Wavelength (nm)',
            gridcolor: '#eee'
        },
        yaxis: {
            title: 'Intensity (max ADC counts, 16-bit)',
            gridcolor: '#eee',
            range: [0, 65535]  // Set default range to the full 16-bit ADC range
        },
        margin: { t: 50, l: 60, r: 30, b: 60 },
        plot_bgcolor: '#f8f9fa',
        paper_bgcolor: '#f8f9fa',
        hovermode: 'closest'
    };
    
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
                elements.roiBinning.value = 1;
                
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
            
            if (statusData.roi) {
                elements.roiStartX.value = statusData.roi.start_x;
                elements.roiStartY.value = statusData.roi.start_y;
                elements.roiWidth.value = statusData.roi.width;
                elements.roiHeight.value = statusData.roi.height;
                elements.roiBinning.value = statusData.roi.binning;
                logMessage(`Current ROI: (${statusData.roi.start_x},${statusData.roi.start_y}) ${statusData.roi.width}x${statusData.roi.height}, binning: ${statusData.roi.binning}`, 'info');
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
                }
            }
            
            if (statusData.calibration && statusData.calibration.coefficients) {
                const coeffs = statusData.calibration.coefficients;
                elements.wavelengthA.value = coeffs[0] || 0.0;
                elements.wavelengthB.value = coeffs[1] || 1.0;
                elements.wavelengthC.value = coeffs.length > 2 ? coeffs[2] : 0.0;
                logMessage(`Current calibration: A=${elements.wavelengthA.value}, B=${elements.wavelengthB.value}, C=${elements.wavelengthC.value}`, 'info');
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
        height: parseInt(elements.roiHeight.value),
        binning: parseInt(elements.roiBinning.value)
    };
    
    try {
        logMessage(`Setting ROI to (${roi.start_x},${roi.start_y}) ${roi.width}x${roi.height}, binning: ${roi.binning}...`, 'info');
        await apiRequest('/roi', 'POST', roi);
        logMessage(`ROI set successfully`, 'success');
    } catch (error) {
        logMessage(`Error setting ROI: ${error.message}`, 'error');
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
    
    try {
        logMessage(`Setting calibration coefficients to [${coefficients.join(', ')}]...`, 'info');
        await apiRequest('/calibration', 'POST', { 
            coefficients: coefficients
        });
        logMessage(`Calibration set successfully`, 'success');
    } catch (error) {
        logMessage(`Error setting calibration: ${error.message}`, 'error');
    }
}

// Acquire dark frame
async function acquireDark() {
    try {
        logMessage('Acquiring dark frame...', 'info');
        const darkData = await apiRequest('/acquire/dark', 'POST');
        appState.darkFrame = darkData;
        logMessage('Dark frame acquired successfully', 'success');
    } catch (error) {
        logMessage(`Error acquiring dark frame: ${error.message}`, 'error');
    }
}

// Acquire spectrum
async function acquireSpectrum() {
    try {
        logMessage('Acquiring spectrum...', 'info');
        const spectrumData = await apiRequest('/acquire/spectrum', 'GET');
        
        // Store the spectrum data and update display
        appState.wavelengths = spectrumData.wavelengths;
        appState.currentSpectrum = spectrumData.intensities;
        
        // Draw spectrum
        drawSpectrum(appState.wavelengths, appState.currentSpectrum);
        
        // Enable export buttons
        elements.saveSpectrumBtn.disabled = false;
        elements.copyDataBtn.disabled = false;
        
        logMessage('Spectrum acquired successfully', 'success');
    } catch (error) {
        logMessage(`Error acquiring spectrum: ${error.message}`, 'error');
    }
}

// Draw spectrum using Plotly.js
function drawSpectrum(wavelengths, intensities) {
    if (!wavelengths || !intensities || wavelengths.length === 0) {
        return;
    }
    
    const trace = {
        x: wavelengths,
        y: intensities,
        type: 'scatter',
        mode: 'lines',
        line: {
            color: '#3498db',
            width: 2
        },
        name: 'Spectrum'
    };
    
    Plotly.react('spectrum-plot', [trace], appState.plotLayout, {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
        displaylogo: false
    });
    
    // Update stats display
    updateSpectrumStats(intensities);
}

// Auto-scale the y-axis
function autoScalePlot() {
    if (!appState.wavelengths || !appState.currentSpectrum) {
        logMessage('No spectrum data to auto-scale', 'warning');
        return;
    }
    
    Plotly.relayout('spectrum-plot', {
        'yaxis.autorange': true
    });
    
    // Update the stored layout
    appState.plotLayout.yaxis.autorange = true;
    delete appState.plotLayout.yaxis.range;
    
    logMessage('Y-axis auto-scaled to data range', 'info');
}

// Set full 16-bit range
function setFullRange() {
    if (!appState.wavelengths || !appState.currentSpectrum) {
        logMessage('No spectrum data to set range for', 'warning');
        return;
    }
    
    Plotly.relayout('spectrum-plot', {
        'yaxis.autorange': false,
        'yaxis.range': [0, 65535]
    });
    
    // Update the stored layout
    appState.plotLayout.yaxis.autorange = false;
    appState.plotLayout.yaxis.range = [0, 65535];
    
    logMessage('Y-axis set to full 16-bit range (0-65535)', 'info');
}

// Set a fixed y-axis range
function setYAxisRange() {
    if (!appState.wavelengths || !appState.currentSpectrum) {
        logMessage('No spectrum data to set range for', 'warning');
        return;
    }
    
    const yMin = parseFloat(elements.yMin.value);
    const yMax = parseFloat(elements.yMax.value);
    
    if (!isNaN(yMin) && !isNaN(yMax) && yMin < yMax) {
        Plotly.relayout('spectrum-plot', {
            'yaxis.autorange': false,
            'yaxis.range': [yMin, yMax]
        });
        
        // Update the stored layout
        appState.plotLayout.yaxis.autorange = false;
        appState.plotLayout.yaxis.range = [yMin, yMax];
        
        logMessage(`Y-axis range set to [${yMin}, ${yMax}]`, 'info');
    } else {
        logMessage('Invalid Y-axis range', 'error');
    }
}

// Update spectrum statistics
function updateSpectrumStats(intensities) {
    if (!intensities || intensities.length === 0) {
        return;
    }
    
    const min = Math.min(...intensities);
    const max = Math.max(...intensities);
    const sum = intensities.reduce((a, b) => a + b, 0);
    const avg = sum / intensities.length;
    
    elements.minValue.textContent = min.toFixed(2);
    elements.maxValue.textContent = max.toFixed(2);
    elements.avgValue.textContent = avg.toFixed(2);
}

// Save spectrum data
function saveSpectrum() {
    if (!appState.wavelengths || !appState.currentSpectrum) {
        logMessage('No spectrum data to save', 'warning');
        return;
    }
    
    try {
        // Create CSV content
        let csvContent = 'Wavelength (nm),Intensity\n';
        
        for (let i = 0; i < appState.wavelengths.length; i++) {
            csvContent += `${appState.wavelengths[i]},${appState.currentSpectrum[i]}\n`;
        }
        
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
        // Create CSV content
        let csvContent = 'Wavelength (nm),Intensity\n';
        
        for (let i = 0; i < appState.wavelengths.length; i++) {
            csvContent += `${appState.wavelengths[i]},${appState.currentSpectrum[i]}\n`;
        }
        
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
    // Disable/enable connection buttons
    elements.connectBtn.disabled = connected;
    elements.disconnectBtn.disabled = !connected;
    
    // Disable/enable all other buttons
    elements.setExposureBtn.disabled = !connected;
    elements.setGainBtn.disabled = !connected;
    elements.setRoiBtn.disabled = !connected;
    elements.setCalibrationBtn.disabled = !connected;
    elements.acquireDarkBtn.disabled = !connected;
    elements.acquireSpectrumBtn.disabled = !connected;
    elements.autoScaleBtn.disabled = !connected;
    elements.fullRangeBtn.disabled = !connected;
    elements.setRangeBtn.disabled = !connected;
    elements.yMin.disabled = !connected;
    elements.yMax.disabled = !connected;
    
    // Keep these disabled unless we have spectrum data
    const hasSpectrum = appState.wavelengths && appState.currentSpectrum;
    elements.saveSpectrumBtn.disabled = !connected || !hasSpectrum;
    elements.copyDataBtn.disabled = !connected || !hasSpectrum;
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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp); 