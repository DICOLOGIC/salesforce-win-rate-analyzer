/**
 * Settings Module
 * 
 * This module manages application settings and preferences for the Win Rate Analyzer.
 * It handles user configurations for analytics features and persists settings across sessions.
 */

const Settings = (function() {
    // Private members
    const LOCAL_STORAGE_KEY = 'winRateAnalyzer_settings';
    let currentSettings = null;
    let containerElement = null;
    let onSettingsChangeCallbacks = [];
    
    // Default settings
    const DEFAULT_SETTINGS = {
        // Analysis settings
        analysis: {
            confidenceLevel: 0.95,
            minSampleSize: 10,
            outlierDetection: true,
            regressionType: 'linear',
            significanceThreshold: 0.05
        },
        // UI settings
        ui: {
            colorScheme: 'default',
            defaultView: 'dashboard',
            tableRowsPerPage: 20,
            chartAnimations: true
        },
        // Display settings
        display: {
            roundDecimals: 1,
            showConfidenceIntervals: true,
            showSampleSize: true,
            winRateFormat: 'percent' // 'percent' or 'decimal'
        },
        // Feature toggles
        features: {
            clusteringEnabled: true,
            predictionEnabled: true,
            dimensionImpactEnabled: true
        }
    };
    
    /**
     * Initializes the settings module
     * @param {HTMLElement} container - Container element for the settings UI
     */
    function init(container) {
        containerElement = container;
        
        // Load settings from localStorage or use defaults
        _loadSettings();
        
        // Render the settings UI
        _renderSettingsUI();
        
        // Set up event listeners
        _setupEventListeners();
    }
    
    /**
     * Loads settings from localStorage or uses defaults
     * @private
     */
    function _loadSettings() {
        try {
            const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedSettings) {
                currentSettings = JSON.parse(savedSettings);
                // Merge with defaults to ensure all properties exist
                currentSettings = _mergeWithDefaults(currentSettings);
            } else {
                currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        }
    }
    
    /**
     * Merges saved settings with defaults to ensure all properties exist
     * @param {Object} savedSettings - Settings from localStorage
     * @returns {Object} - Complete settings object
     * @private
     */
    function _mergeWithDefaults(savedSettings) {
        const merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        
        // Helper function to recursively merge objects
        function mergeObjects(target, source) {
            for (const key in source) {
                if (source.hasOwnProperty(key)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        if (!target[key]) target[key] = {};
                        mergeObjects(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
        }
        
        mergeObjects(merged, savedSettings);
        return merged;
    }
    
    /**
     * Saves current settings to localStorage
     * @private
     */
    function _saveSettings() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentSettings));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }
    
    /**
     * Renders the settings UI
     * @private
     */
    function _renderSettingsUI() {
        if (!containerElement) return;
        
        containerElement.innerHTML = `
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Analysis Settings</h5>
                    <button id="reset-settings" class="btn btn-sm btn-outline-secondary">Reset to Defaults</button>
                </div>
                <div class="card-body">
                    <ul class="nav nav-tabs" id="settingsTabs" role="tablist">
                        <li class="nav-item">
                            <a class="nav-link active" id="analysis-tab" data-toggle="tab" href="#analysis-settings" role="tab">Analysis</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" id="display-tab" data-toggle="tab" href="#display-settings" role="tab">Display</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" id="features-tab" data-toggle="tab" href="#features-settings" role="tab">Features</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" id="ui-tab" data-toggle="tab" href="#ui-settings" role="tab">UI</a>
                        </li>
                    </ul>
                    
                    <div class="tab-content mt-3" id="settingsTabsContent">
                        <!-- Analysis Settings Tab -->
                        <div class="tab-pane fade show active" id="analysis-settings" role="tabpanel">
                            <div class="form-group">
                                <label for="confidence-level">Confidence Level</label>
                                <select class="form-control" id="confidence-level" data-setting="analysis.confidenceLevel">
                                    <option value="0.90" ${currentSettings.analysis.confidenceLevel === 0.90 ? 'selected' : ''}>90%</option>
                                    <option value="0.95" ${currentSettings.analysis.confidenceLevel === 0.95 ? 'selected' : ''}>95%</option>
                                    <option value="0.99" ${currentSettings.analysis.confidenceLevel === 0.99 ? 'selected' : ''}>99%</option>
                                </select>
                                <small class="form-text text-muted">Confidence level for statistical tests and intervals.</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="min-sample-size">Minimum Sample Size</label>
                                <input type="number" class="form-control" id="min-sample-size" data-setting="analysis.minSampleSize" value="${currentSettings.analysis.minSampleSize}" min="1" max="1000">
                                <small class="form-text text-muted">Minimum number of opportunities needed for reliable analysis.</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="significance-threshold">Significance Threshold</label>
                                <input type="number" class="form-control" id="significance-threshold" data-setting="analysis.significanceThreshold" value="${currentSettings.analysis.significanceThreshold}" min="0.001" max="0.1" step="0.001">
                                <small class="form-text text-muted">P-value threshold for statistical significance (smaller values are stricter).</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="regression-type">Regression Type</label>
                                <select class="form-control" id="regression-type" data-setting="analysis.regressionType">
                                    <option value="linear" ${currentSettings.analysis.regressionType === 'linear' ? 'selected' : ''}>Linear Regression</option>
                                    <option value="logistic" ${currentSettings.analysis.regressionType === 'logistic' ? 'selected' : ''}>Logistic Regression</option>
                                </select>
                                <small class="form-text text-muted">Type of regression to use for dimension impact analysis.</small>
                            </div>
                            
                            <div class="custom-control custom-switch mt-3">
                                <input type="checkbox" class="custom-control-input" id="outlier-detection" data-setting="analysis.outlierDetection" ${currentSettings.analysis.outlierDetection ? 'checked' : ''}>
                                <label class="custom-control-label" for="outlier-detection">Enable Outlier Detection</label>
                                <small class="form-text text-muted">Automatically detect and exclude outliers from analysis.</small>
                            </div>
                        </div>
                        
                        <!-- Display Settings Tab -->
                        <div class="tab-pane fade" id="display-settings" role="tabpanel">
                            <div class="form-group">
                                <label for="round-decimals">Decimal Places</label>
                                <select class="form-control" id="round-decimals" data-setting="display.roundDecimals">
                                    <option value="0" ${currentSettings.display.roundDecimals === 0 ? 'selected' : ''}>0 (e.g. 75%)</option>
                                    <option value="1" ${currentSettings.display.roundDecimals === 1 ? 'selected' : ''}>1 (e.g. 75.4%)</option>
                                    <option value="2" ${currentSettings.display.roundDecimals === 2 ? 'selected' : ''}>2 (e.g. 75.42%)</option>
                                </select>
                                <small class="form-text text-muted">Number of decimal places to display for percentages.</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="win-rate-format">Win Rate Format</label>
                                <select class="form-control" id="win-rate-format" data-setting="display.winRateFormat">
                                    <option value="percent" ${currentSettings.display.winRateFormat === 'percent' ? 'selected' : ''}>Percentage (e.g. 75%)</option>
                                    <option value="decimal" ${currentSettings.display.winRateFormat === 'decimal' ? 'selected' : ''}>Decimal (e.g. 0.75)</option>
                                </select>
                                <small class="form-text text-muted">Format for displaying win rates.</small>
                            </div>
                            
                            <div class="custom-control custom-switch mt-3">
                                <input type="checkbox" class="custom-control-input" id="show-confidence" data-setting="display.showConfidenceIntervals" ${currentSettings.display.showConfidenceIntervals ? 'checked' : ''}>
                                <label class="custom-control-label" for="show-confidence">Show Confidence Intervals</label>
                                <small class="form-text text-muted">Display confidence intervals for win rates in charts and tables.</small>
                            </div>
                            
                            <div class="custom-control custom-switch mt-3">
                                <input type="checkbox" class="custom-control-input" id="show-sample-size" data-setting="display.showSampleSize" ${currentSettings.display.showSampleSize ? 'checked' : ''}>
                                <label class="custom-control-label" for="show-sample-size">Show Sample Size</label>
                                <small class="form-text text-muted">Display opportunity counts alongside win rates.</small>
                            </div>
                        </div>
                        
                        <!-- Features Settings Tab -->
                        <div class="tab-pane fade" id="features-settings" role="tabpanel">
                            <div class="alert alert-info">
                                <small>Enable or disable advanced analytics features. Disabling features can improve performance on larger datasets.</small>
                            </div>
                            
                            <div class="custom-control custom-switch mt-3">
                                <input type="checkbox" class="custom-control-input" id="dimension-impact-enabled" data-setting="features.dimensionImpactEnabled" ${currentSettings.features.dimensionImpactEnabled ? 'checked' : ''}>
                                <label class="custom-control-label" for="dimension-impact-enabled">Dimension Impact Analysis</label>
                                <small class="form-text text-muted">Analyze which dimensions most significantly impact win rates.</small>
                            </div>
                            
                            <div class="custom-control custom-switch mt-3">
                                <input type="checkbox" class="custom-control-input" id="clustering-enabled" data-setting="features.clusteringEnabled" ${currentSettings.features.clusteringEnabled ? 'checked' : ''}>
                                <label class="custom-control-label" for="clustering-enabled">Dimension Clustering</label>
                                <small class="form-text text-muted">Group dimensions with similar impact on win rates.</small>
                            </div>
                            
                            <div class="custom-control custom-switch mt-3">
                                <input type="checkbox" class="custom-control-input" id="prediction-enabled" data-setting="features.predictionEnabled" ${currentSettings.features.predictionEnabled ? 'checked' : ''}>
                                <label class="custom-control-label" for="prediction-enabled">Win Rate Prediction</label>
                                <small class="form-text text-muted">Enable predictive model for win probability calculation.</small>
                            </div>
                        </div>
                        
                        <!-- UI Settings Tab -->
                        <div class="tab-pane fade" id="ui-settings" role="tabpanel">
                            <div class="form-group">
                                <label for="color-scheme">Color Scheme</label>
                                <select class="form-control" id="color-scheme" data-setting="ui.colorScheme">
                                    <option value="default" ${currentSettings.ui.colorScheme === 'default' ? 'selected' : ''}>Default</option>
                                    <option value="salesforce" ${currentSettings.ui.colorScheme === 'salesforce' ? 'selected' : ''}>Salesforce</option>
                                    <option value="monochrome" ${currentSettings.ui.colorScheme === 'monochrome' ? 'selected' : ''}>Monochrome</option>
                                    <option value="highcontrast" ${currentSettings.ui.colorScheme === 'highcontrast' ? 'selected' : ''}>High Contrast</option>
                                </select>
                                <small class="form-text text-muted">Color scheme for charts and visualizations.</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="default-view">Default View</label>
                                <select class="form-control" id="default-view" data-setting="ui.defaultView">
                                    <option value="dashboard" ${currentSettings.ui.defaultView === 'dashboard' ? 'selected' : ''}>Dashboard</option>
                                    <option value="dimensionImpact" ${currentSettings.ui.defaultView === 'dimensionImpact' ? 'selected' : ''}>Dimension Impact</option>
                                    <option value="prediction" ${currentSettings.ui.defaultView === 'prediction' ? 'selected' : ''}>Prediction</option>
                                    <option value="lookup" ${currentSettings.ui.defaultView === 'lookup' ? 'selected' : ''}>Lookup Table</option>
                                </select>
                                <small class="form-text text-muted">Default view to show when opening the analyzer.</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="table-rows">Table Rows Per Page</label>
                                <select class="form-control" id="table-rows" data-setting="ui.tableRowsPerPage">
                                    <option value="10" ${currentSettings.ui.tableRowsPerPage === 10 ? 'selected' : ''}>10</option>
                                    <option value="20" ${currentSettings.ui.tableRowsPerPage === 20 ? 'selected' : ''}>20</option>
                                    <option value="50" ${currentSettings.ui.tableRowsPerPage === 50 ? 'selected' : ''}>50</option>
                                    <option value="100" ${currentSettings.ui.tableRowsPerPage === 100 ? 'selected' : ''}>100</option>
                                </select>
                                <small class="form-text text-muted">Number of rows to display per page in tables.</small>
                            </div>
                            
                            <div class="custom-control custom-switch mt-3">
                                <input type="checkbox" class="custom-control-input" id="chart-animations" data-setting="ui.chartAnimations" ${currentSettings.ui.chartAnimations ? 'checked' : ''}>
                                <label class="custom-control-label" for="chart-animations">Chart Animations</label>
                                <small class="form-text text-muted">Enable animations in charts. Disable to improve performance.</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <button id="save-settings" class="btn btn-primary">Save Settings</button>
                        <button id="cancel-settings" class="btn btn-link">Cancel</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Sets up event listeners for settings UI
     * @private
     */
    function _setupEventListeners() {
        if (!containerElement) return;
        
        // Reset to defaults
        const resetButton = containerElement.querySelector('#reset-settings');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                if (confirm('Reset all settings to default values?')) {
                    _resetSettings();
                }
            });
        }
        
        // Save settings
        const saveButton = containerElement.querySelector('#save-settings');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                _saveSettingsFromUI();
                alert('Settings saved successfully!');
                _notifySettingsChanged();
            });
        }
        
        // Cancel changes
        const cancelButton = containerElement.querySelector('#cancel-settings');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                _renderSettingsUI(); // Re-render with current settings
            });
        }
        
        // Handle immediate toggle changes for better UX
        containerElement.addEventListener('change', (e) => {
            const settingElement = e.target.closest('[data-setting]');
            if (settingElement) {
                // Update UI immediately for a better user experience
                _updateSettingFromElement(settingElement);
            }
        });
    }
    
    /**
     * Updates a setting from a UI element
     * @param {HTMLElement} element - The element containing the setting
     * @private
     */
    function _updateSettingFromElement(element) {
        const settingPath = element.dataset.setting;
        if (!settingPath) return;
        
        const pathParts = settingPath.split('.');
        let currentObj = currentSettings;
        
        // Navigate to the parent object
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (!currentObj[pathParts[i]]) {
                currentObj[pathParts[i]] = {};
            }
            currentObj = currentObj[pathParts[i]];
        }
        
        // Set the value based on element type
        const property = pathParts[pathParts.length - 1];
        
        if (element.type === 'checkbox') {
            currentObj[property] = element.checked;
        } else if (element.type === 'number') {
            currentObj[property] = parseFloat(element.value);
        } else {
            // For select elements and other input types
            let value = element.value;
            
            // Convert to appropriate type if needed
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (!isNaN(value) && value.indexOf('.') !== -1) value = parseFloat(value);
            else if (!isNaN(value)) value = parseInt(value, 10);
            
            currentObj[property] = value;
        }
    }
    
    /**
     * Saves all settings from the UI elements
     * @private
     */
    function _saveSettingsFromUI() {
        if (!containerElement) return;
        
        // Get all elements with data-setting attribute
        const settingElements = containerElement.querySelectorAll('[data-setting]');
        
        // Update settings from each element
        settingElements.forEach(element => {
            _updateSettingFromElement(element);
        });
        
        // Save to localStorage
        _saveSettings();
    }
    
    /**
     * Resets all settings to default values
     * @private
     */
    function _resetSettings() {
        currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        _saveSettings();
        _renderSettingsUI();
        _notifySettingsChanged();
    }
    
    /**
     * Notifies all registered callbacks when settings change
     * @private
     */
    function _notifySettingsChanged() {
        onSettingsChangeCallbacks.forEach(callback => {
            try {
                callback(currentSettings);
            } catch (error) {
                console.error('Error in settings change callback:', error);
            }
        });
    }
    
    /**
     * Gets the current settings
     * @returns {Object} - Current settings object
     */
    function getSettings() {
        return JSON.parse(JSON.stringify(currentSettings));
    }
    
    /**
     * Gets a specific setting value
     * @param {string} path - Dot-notation path to the setting
     * @param {*} defaultValue - Default value to return if setting not found
     * @returns {*} - Setting value or default value
     */
    function getSetting(path, defaultValue) {
        const pathParts = path.split('.');
        let current = currentSettings;
        
        for (const part of pathParts) {
            if (current === undefined || current === null || !current.hasOwnProperty(part)) {
                return defaultValue;
            }
            current = current[part];
        }
        
        return current !== undefined ? current : defaultValue;
    }
    
    /**
     * Updates a specific setting value
     * @param {string} path - Dot-notation path to the setting
     * @param {*} value - New value for the setting
     */
    function updateSetting(path, value) {
        const pathParts = path.split('.');
        let current = currentSettings;
        
        // Navigate to the parent object
        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
        
        // Update the value
        current[pathParts[pathParts.length - 1]] = value;
        
        // Save to localStorage
        _saveSettings();
        
        // Notify callbacks
        _notifySettingsChanged();
    }
    
    /**
     * Registers a callback for settings changes
     * @param {Function} callback - Function to call when settings change
     */
    function onSettingsChange(callback) {
        if (typeof callback === 'function' && !onSettingsChangeCallbacks.includes(callback)) {
            onSettingsChangeCallbacks.push(callback);
        }
    }
    
    /**
     * Unregisters a settings change callback
     * @param {Function} callback - The callback to remove
     */
    function offSettingsChange(callback) {
        const index = onSettingsChangeCallbacks.indexOf(callback);
        if (index !== -1) {
            onSettingsChangeCallbacks.splice(index, 1);
        }
    }
    
    // Public API
    return {
        init: init,
        getSettings: getSettings,
        getSetting: getSetting,
        updateSetting: updateSetting,
        onSettingsChange: onSettingsChange,
        offSettingsChange: offSettingsChange
    };
})();

// Export the module
export default Settings;