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
    continuousMode: false,
    continuousInterval: null,
    currentSpectrum: null,
    wavelengths: null,
    darkFrame: null,
    backgroundFrame: null
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
    acquireBackgroundBtn: document.getElementById('acquire-background-btn'),
    acquireSpectrumBtn: document.getElementById('acquire-spectrum-btn'),
    continuousMode: document.getElementById('continuous-mode'),
    updateInterval: document.getElementById('update-interval'),
    
    // Spectrum display
    spectrumCanvas: document.getElementById('spectrum-canvas'),
    minValue: document.getElementById('min-value'),
    maxValue: document.getElementById('max-value'),
    avgValue: document.getElementById('avg-value'),
    
    // Data export
    saveSpectrumBtn: document.getElementById('save-spectrum-btn'),
    copyDataBtn: document.getElementById('copy-data-btn'),
    
    // Log
    logContainer: document.getElementById('log-container'),
    clearLogBtn: document.getElementById('clear-log-btn')
};

// Canvas context
const ctx = elements.spectrumCanvas.getContext('2d');

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
    elements.acquireBackgroundBtn.addEventListener('click', acquireBackground);
    elements.acquireSpectrumBtn.addEventListener('click', acquireSpectrum);
    elements.continuousMode.addEventListener('change', toggleContinuousMode);
    elements.saveSpectrumBtn.addEventListener('click', saveSpectrum);
    elements.copyDataBtn.addEventListener('click', copyData);
    elements.clearLogBtn.addEventListener('click', clearLog);
    
    // Set up canvas
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Log initialization
    logMessage('Interface initialized', 'info');
    logMessage('Connect to the spectrometer to begin', 'info');
}

// Resize canvas to fit container
function resizeCanvas() {
    const container = elements.spectrumCanvas.parentElement;
    elements.spectrumCanvas.width = container.clientWidth;
    elements.spectrumCanvas.height = container.clientHeight;
    
    // Redraw if we have data
    if (appState.currentSpectrum) {
        drawSpectrum(appState.wavelengths, appState.currentSpectrum);
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
        toggleControlsEnabled(true);
        
        logMessage('Connected to spectrometer', 'success');
        
        // Get current settings
        await getSpectrumeterSettings();
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
        toggleControlsEnabled(false);
        
        // Stop continuous mode if active
        if (appState.continuousMode) {
            toggleContinuousMode();
        }
        
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
            if (statusData.settings) {
                elements.exposureTime.value = statusData.settings.exposure_ms;
                elements.gain.value = statusData.settings.gain;
                logMessage(`Current exposure: ${statusData.settings.exposure_ms}ms, gain: ${statusData.settings.gain}`, 'info');
            }
            
            if (statusData.roi) {
                elements.roiStartX.value = statusData.roi.start_x;
                elements.roiStartY.value = statusData.roi.start_y;
                elements.roiWidth.value = statusData.roi.width;
                elements.roiHeight.value = statusData.roi.height;
                elements.roiBinning.value = statusData.roi.binning;
                logMessage(`Current ROI: (${statusData.roi.start_x},${statusData.roi.start_y}) ${statusData.roi.width}x${statusData.roi.height}, binning: ${statusData.roi.binning}`, 'info');
            }
            
            if (statusData.calibration && statusData.calibration.coefficients) {
                const coeffs = statusData.calibration.coefficients;
                elements.wavelengthA.value = coeffs[0];
                elements.wavelengthB.value = coeffs[1];
                elements.wavelengthC.value = coeffs[2];
                logMessage(`Current calibration: A=${coeffs[0]}, B=${coeffs[1]}, C=${coeffs[2]}`, 'info');
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

// Acquire background frame
async function acquireBackground() {
    try {
        logMessage('Acquiring background frame...', 'info');
        const backgroundData = await apiRequest('/acquire/background', 'POST');
        appState.backgroundFrame = backgroundData;
        logMessage('Background frame acquired successfully', 'success');
    } catch (error) {
        logMessage(`Error acquiring background frame: ${error.message}`, 'error');
    }
}

// Acquire spectrum
async function acquireSpectrum() {
    try {
        logMessage('Acquiring spectrum...', 'info');
        const spectrumData = await apiRequest('/acquire/spectrum', 'GET');
        
        if (spectrumData && spectrumData.wavelengths && spectrumData.intensities) {
            appState.currentSpectrum = spectrumData.intensities;
            appState.wavelengths = spectrumData.wavelengths;
            
            // Draw the spectrum
            drawSpectrum(spectrumData.wavelengths, spectrumData.intensities);
            
            // Update stats
            updateSpectrumStats(spectrumData.intensities);
            
            // Enable save and copy buttons
            elements.saveSpectrumBtn.disabled = false;
            elements.copyDataBtn.disabled = false;
            
            logMessage('Spectrum acquired successfully', 'success');
        } else {
            logMessage('Invalid spectrum data received', 'error');
        }
    } catch (error) {
        logMessage(`Error acquiring spectrum: ${error.message}`, 'error');
    }
}

// Toggle continuous acquisition mode
function toggleContinuousMode() {
    const isContinuous = elements.continuousMode.checked;
    
    if (isContinuous && !appState.continuousInterval) {
        // Start continuous mode
        const interval = parseInt(elements.updateInterval.value);
        logMessage(`Starting continuous acquisition (${interval}ms interval)`, 'info');
        
        // Initial acquisition
        acquireSpectrum();
        
        // Set up interval
        appState.continuousInterval = setInterval(acquireSpectrum, interval);
        appState.continuousMode = true;
        
        // Disable certain controls during continuous mode
        elements.acquireDarkBtn.disabled = true;
        elements.acquireBackgroundBtn.disabled = true;
        elements.setRoiBtn.disabled = true;
    } else if (!isContinuous && appState.continuousInterval) {
        // Stop continuous mode
        logMessage('Stopping continuous acquisition', 'info');
        clearInterval(appState.continuousInterval);
        appState.continuousInterval = null;
        appState.continuousMode = false;
        
        // Re-enable controls
        if (appState.connected) {
            elements.acquireDarkBtn.disabled = false;
            elements.acquireBackgroundBtn.disabled = false;
            elements.setRoiBtn.disabled = false;
        }
    }
}

// Draw spectrum on canvas
function drawSpectrum(wavelengths, intensities) {
    if (!wavelengths || !intensities || wavelengths.length === 0) {
        return;
    }
    
    const canvas = elements.spectrumCanvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate min/max values for scaling
    const minIntensity = Math.min(...intensities);
    const maxIntensity = Math.max(...intensities);
    const range = maxIntensity - minIntensity;
    
    // Scale factor and padding
    const xPadding = 40;
    const yPadding = 30;
    const graphWidth = width - 2 * xPadding;
    const graphHeight = height - 2 * yPadding;
    
    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.moveTo(xPadding, yPadding);
    ctx.lineTo(xPadding, height - yPadding);
    ctx.lineTo(width - xPadding, height - yPadding);
    ctx.stroke();
    
    // Draw wavelength scale
    const minWavelength = Math.min(...wavelengths);
    const maxWavelength = Math.max(...wavelengths);
    const wavelengthRange = maxWavelength - minWavelength;
    
    // X-axis ticks and labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    
    for (let i = 0; i <= 5; i++) {
        const x = xPadding + (i / 5) * graphWidth;
        const wavelength = minWavelength + (i / 5) * wavelengthRange;
        
        ctx.beginPath();
        ctx.moveTo(x, height - yPadding);
        ctx.lineTo(x, height - yPadding + 5);
        ctx.stroke();
        
        ctx.fillText(wavelength.toFixed(1), x, height - yPadding + 8);
    }
    
    // Y-axis ticks and labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i <= 5; i++) {
        const y = height - yPadding - (i / 5) * graphHeight;
        const intensity = minIntensity + (i / 5) * range;
        
        ctx.beginPath();
        ctx.moveTo(xPadding, y);
        ctx.lineTo(xPadding - 5, y);
        ctx.stroke();
        
        ctx.fillText(intensity.toFixed(0), xPadding - 8, y);
    }
    
    // Draw axis labels
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    ctx.fillText('Wavelength (nm)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Intensity', 0, 0);
    ctx.restore();
    
    // Draw spectrum
    ctx.beginPath();
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < wavelengths.length; i++) {
        const x = xPadding + ((wavelengths[i] - minWavelength) / wavelengthRange) * graphWidth;
        const y = height - yPadding - ((intensities[i] - minIntensity) / range) * graphHeight;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
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

// Toggle control elements enabled/disabled state
function toggleControlsEnabled(enabled) {
    elements.disconnectBtn.disabled = !enabled;
    elements.setExposureBtn.disabled = !enabled;
    elements.setGainBtn.disabled = !enabled;
    elements.setRoiBtn.disabled = !enabled;
    elements.setCalibrationBtn.disabled = !enabled;
    elements.acquireDarkBtn.disabled = !enabled;
    elements.acquireBackgroundBtn.disabled = !enabled;
    elements.acquireSpectrumBtn.disabled = !enabled;
    elements.connectBtn.disabled = enabled;
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