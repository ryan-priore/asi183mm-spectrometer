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
    plotLayout: null,
    imageData: null  // Add this to store the image data
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
    
    // Data export
    saveSpectrumBtn: document.getElementById('save-spectrum-btn'),
    copyDataBtn: document.getElementById('copy-data-btn'),
    
    // Image acquisition
    acquireImageBtn: document.getElementById('acquire-image-btn'),
    cameraImage: document.getElementById('camera-image'),
    
    // Log
    logContainer: document.getElementById('log-container'),
    clearLogBtn: document.getElementById('clear-log-btn'),
    
    // Processing settings
    setProcessingBtn: document.getElementById('set-processing-btn'),
    subtractDark: document.getElementById('subtract-dark'),
    useMax: document.getElementById('use-max')
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
    elements.acquireImageBtn.addEventListener('click', acquireImage);
    elements.saveSpectrumBtn.addEventListener('click', saveSpectrum);
    elements.copyDataBtn.addEventListener('click', copyData);
    elements.clearLogBtn.addEventListener('click', clearLog);
    
    // Set up processing settings
    elements.setProcessingBtn.addEventListener('click', setProcessingSettings);
    
    // Initialize tab interface
    initTabInterface();
    
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

// Set processing settings
async function setProcessingSettings() {
    const subtractDark = elements.subtractDark.checked;
    const useMax = elements.useMax.checked;
    
    try {
        logMessage(`Setting processing options: Subtract Dark=${subtractDark}, Use Max=${useMax}`, 'info');
        
        await apiRequest('/processing', 'POST', { 
            subtract_dark: subtractDark,
            use_max: useMax
        });
        
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
            
            if (statusData.processing) {
                // Update processing settings
                elements.subtractDark.checked = statusData.processing.subtract_dark || false;
                elements.useMax.checked = statusData.processing.use_max || false;
                logMessage(`Processing settings: Subtract Dark=${statusData.processing.subtract_dark}, Use Max=${statusData.processing.use_max}`, 'info');
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
        const spectrumData = await apiRequest('/acquire/spectrum?include_image=true', 'GET');
        
        // Store the spectrum data and update display
        appState.wavelengths = spectrumData.wavelengths;
        appState.currentSpectrum = spectrumData.intensities;
        
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
        
        logMessage('Spectrum acquired successfully', 'success');
    } catch (error) {
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
    safeToggle(elements.acquireDarkBtn, !connected);
    safeToggle(elements.acquireSpectrumBtn, !connected);
    safeToggle(elements.acquireImageBtn, !connected);
    
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

// Acquire camera image
async function acquireImage() {
    try {
        // Check if we have cached image data from spectrum acquisition
        if (appState.imageData) {
            logMessage('Using cached image data from previous acquisition', 'info');
            displayCachedImage();
            // Re-enable the button (displayCachedImage doesn't handle this)
            elements.acquireImageBtn.disabled = false;
            return;
        }
        
        // If no cached data, acquire a new image
        logMessage('No cached image data, acquiring new camera image...', 'info');
        
        // Disable the button while acquiring
        elements.acquireImageBtn.disabled = true;
        
        // Show loading indicator
        const imageContainer = elements.cameraImage.parentElement;
        imageContainer.classList.add('loading');
        elements.cameraImage.style.display = 'none';
        
        // Call the API with a query parameter to request a scaled image directly from the server
        const response = await fetch(`${API_BASE_URL}/acquire/image?scale=0.5`, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            cache: 'no-store' // Tell browser not to cache
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        // Get the image as a blob
        const imageBlob = await response.blob();
        
        // Create an object URL for the blob
        const imageUrl = URL.createObjectURL(imageBlob);
        
        // Set image directly without additional processing
        elements.cameraImage.onload = function() {
            // Remove loading indicator and show image
            imageContainer.classList.remove('loading');
            elements.cameraImage.style.display = 'block';
            
            // Re-enable the button once image is loaded
            elements.acquireImageBtn.disabled = false;
            logMessage('Camera image acquired successfully', 'success');
        };
        
        elements.cameraImage.src = imageUrl;
    } catch (error) {
        // Show error status
        const imageContainer = elements.cameraImage.parentElement;
        imageContainer.classList.remove('loading');
        imageContainer.classList.add('error');
        
        // Re-enable the button on error
        elements.acquireImageBtn.disabled = false;
        logMessage(`Error acquiring image: ${error.message}`, 'error');
        
        // Remove error class after 3 seconds
        setTimeout(() => {
            imageContainer.classList.remove('error');
        }, 3000);
    }
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
}); 