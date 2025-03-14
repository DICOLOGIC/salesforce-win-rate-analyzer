/**
 * Dimension Impact Analysis module for Win Rate Analyzer
 * Handles dimension impact visualization and analysis
 */

const DimensionImpact = (function() {
    // Private variables
    let dimensionImpactData = {};
    let regressionModel = null;
    let selectedTimePeriod = 'last_90_days';
    let charts = {};
    let regressionWorker = null;
    
    /**
     * Initialize the module
     */
    function initialize() {
        // Initialize the worker
        initializeWorker();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        loadDimensionImpactData();
    }
    
    /**
     * Initialize the regression worker
     */
    function initializeWorker() {
        try {
            regressionWorker = new Worker('./js/workers/regressionWorker.js');
            
            // Set up event listener for worker messages
            regressionWorker.addEventListener('message', handleWorkerMessage);
        } catch (error) {
            console.error('Failed to initialize regression worker:', error);
            showError('Failed to initialize regression analysis. Browser may not support Web Workers.');
        }
    }
    
    /**
     * Handle messages from the worker
     * @param {MessageEvent} event - Message event from worker
     */
    function handleWorkerMessage(event) {
        const { success, id, result, error } = event.data;
        
        if (!success) {
            console.error('Worker error:', error);
            showError(`Analysis error: ${error}`);
            showLoading(false);
            return;
        }
        
        // Handle different worker responses based on id
        switch (id) {
            case 'multivariate_regression':
                handleRegressionResult(result);
                break;
                
            case 'confidence_intervals':
                updateConfidenceIntervals(result);
                break;
                
            default:
                console.warn('Unknown worker response id:', id);
        }
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Time period selector
        document.getElementById('impact-time-period-selector').addEventListener('change', function(e) {
            selectedTimePeriod = e.target.value;
            loadDimensionImpactData();
        });
        
        // Run regression button
        document.getElementById('run-regression-analysis').addEventListener('click', function() {
            runRegressionAnalysis();
        });
        
        // Regression params form
        document.getElementById('regression-params-form').addEventListener('submit', function(e) {
            e.preventDefault();
            runRegressionAnalysis();
        });
        
        // Export report button
        document.getElementById('export-impact-report').addEventListener('click', function() {
            exportImpactReport();
        });
        
        // Window resize event for responsive charts
        window.addEventListener('resize', Utils.debounce(function() {
            resizeCharts();
        }, 250));
        
        // Listen for auth state changes
        Utils.eventBus.subscribe('auth:stateChanged', function(isAuthenticated) {
            if (isAuthenticated) {
                loadDimensionImpactData();
            } else {
                clearAnalysis();
            }
        });
    }
    
    /**
     * Load dimension impact data from API
     */
    function loadDimensionImpactData() {
        showLoading(true);
        
        API.getDimensionImpactData(selectedTimePeriod)
            .then(function(data) {
                dimensionImpactData = data;
                renderDimensionImpactData();
                showLoading(false);
            })
            .catch(function(error) {
                console.error('Error loading dimension impact data:', error);
                showError('Failed to load dimension impact data. Please try again.');
                showLoading(false);
            });
    }
    
    /**
     * Render dimension impact data
     */
    function renderDimensionImpactData() {
        // Clear existing content
        clearAnalysis();
        
        // Render dimension selection
        renderDimensionSelection();
        
        // Render factors overview if we have model data
        if (dimensionImpactData.model) {
            renderFactorsOverview();
        }
    }
    
    /**
     * Render dimension selection interface
     */
    function renderDimensionSelection() {
        const container = document.getElementById('dimension-selection');
        
        if (!dimensionImpactData.dimensions || dimensionImpactData.dimensions.length === 0) {
            container.innerHTML = '<p>No dimensions available for analysis.</p>';
            return;
        }
        
        // Create HTML for dimension selection
        let html = `
            <h3>Select Dimensions for Analysis</h3>
            <p>Choose the dimensions you want to include in the regression analysis.</p>
            <div class="dimension-selection-grid">
        `;
        
        // Add checkbox for each dimension
        dimensionImpactData.dimensions.forEach(dimension => {
            html += `
                <div class="dimension-checkbox-container">
                    <input type="checkbox" class="dimension-regression-checkbox" 
                        id="dim-${dimension.id}" value="${dimension.id}" 
                        ${dimension.recommended ? 'checked' : ''}>
                    <label for="dim-${dimension.id}">${formatDimensionName(dimension.name)}</label>
                    ${dimension.recommended ? '<span class="recommended-badge">Recommended</span>' : ''}
                </div>
            `;
        });
        
        html += `
            </div>
            <div class="regression-options">
                <h4>Regression Options</h4>
                <form id="regression-params-form">
                    <div class="form-group">
                        <label for="confidence-level">Confidence Level</label>
                        <select id="confidence-level" class="form-control">
                            <option value="0.9">90%</option>
                            <option value="0.95" selected>95%</option>
                            <option value="0.99">99%</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="regression-method">Regression Method</label>
                        <select id="regression-method" class="form-control">
                            <option value="linear">Linear Regression</option>
                            <option value="logistic">Logistic Regression</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary" id="run-regression-analysis">
                        Run Regression Analysis
                    </button>
                </form>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * Render factors overview section
     */
    function renderFactorsOverview() {
        const container = document.getElementById('factors-overview');
        
        if (!dimensionImpactData.model || !dimensionImpactData.model.coefficients) {
            container.innerHTML = '<p>No regression model available. Run an analysis to see results.</p>';
            return;
        }
        
        const model = dimensionImpactData.model;
        
        // Create header section
        let html = `
            <div class="model-summary">
                <h3>Regression Model Results</h3>
                <div class="model-metrics">
                    <div class="metric-card">
                        <h4>R-Squared</h4>
                        <p class="metric-value">${model.rSquared.toFixed(3)}</p>
                    </div>
                    <div class="metric-card">
                        <h4>Adjusted R-Squared</h4>
                        <p class="metric-value">${model.adjustedRSquared.toFixed(3)}</p>
                    </div>
                    <div class="metric-card">
                        <h4>Model Significance</h4>
                        <p class="metric-value">${model.fStat.pValue < 0.05 ? 'Significant' : 'Not Significant'}</p>
                        <p class="metric-secondary">p-value: ${model.fStat.pValue.toExponential(2)}</p>
                    </div>
                </div>
            </div>
            
            <div class="impact-chart-container">
                <h3>Dimension Impact on Win Rate</h3>
                <canvas id="coefficient-chart"></canvas>
            </div>
            
            <div class="coefficients-table-container">
                <h3>Coefficient Details</h3>
                <table class="data-table coefficients-table">
                    <thead>
                        <tr>
                            <th>Dimension</th>
                            <th>Coefficient</th>
                            <th>Impact</th>
                            <th>p-value</th>
                            <th>Significant</th>
                            <th>Confidence Interval</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Sort coefficients by absolute value
        const sortedCoefficients = [...model.coefficients].sort((a, b) => 
            Math.abs(b.coefficient) - Math.abs(a.coefficient)
        );
        
        // Add rows for each coefficient
        sortedCoefficients.forEach(coef => {
            html += `
                <tr>
                    <td>${formatDimensionName(coef.dimension)}</td>
                    <td>${coef.coefficient.toFixed(4)}</td>
                    <td>
                        <div class="impact-indicator ${coef.coefficient > 0 ? 'positive' : 'negative'}">
                            ${coef.coefficient > 0 ? '+' : '-'}${Math.abs(coef.impact * 100).toFixed(2)}%
                        </div>
                    </td>
                    <td>${coef.pValue.toExponential(2)}</td>
                    <td>
                        <span class="significance-indicator ${coef.pValue < 0.05 ? 'significant' : 'not-significant'}">
                            ${coef.pValue < 0.05 ? 'Yes' : 'No'}
                        </span>
                    </td>
                    <td>
                        [${coef.confidenceInterval[0].toFixed(4)}, ${coef.confidenceInterval[1].toFixed(4)}]
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <div class="model-interpretation">
                <h3>Interpretation</h3>
                <div class="interpretation-content">
                    <p>The model explains <strong>${(model.rSquared * 100).toFixed(1)}%</strong> of the variation in win rates.</p>
                    <p>Key factors influencing win rates:</p>
                    <ul>
        `;
        
        // Add interpretations for top coefficients
        sortedCoefficients.slice(0, 5).forEach(coef => {
            if (coef.dimension === 'intercept') {
                html += `<li>The baseline win rate (intercept) is <strong>${(coef.coefficient * 100).toFixed(1)}%</strong>.</li>`;
            } else if (coef.pValue < 0.05) {
                const impact = coef.coefficient > 0 ? 'increases' : 'decreases';
                html += `
                    <li>
                        <strong>${formatDimensionName(coef.dimension)}</strong> ${impact} win rate by 
                        <strong>${Math.abs(coef.impact * 100).toFixed(2)}%</strong> 
                        (p-value: ${coef.pValue.toExponential(2)}).
                    </li>
                `;
            }
        });
        
        html += `
                    </ul>
                    <p>
                        <strong>Note:</strong> Factors with p-value < 0.05 are considered statistically significant.
                    </p>
                </div>
            </div>
            
            <div class="action-buttons">
                <button class="btn btn-primary" id="export-impact-report">Export Report</button>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Create coefficient chart
        createCoefficientChart(sortedCoefficients);
    }
    
    /**
     * Create coefficient chart
     * @param {Array} coefficients - Model coefficients
     */
    function createCoefficientChart(coefficients) {
        const ctx = document.getElementById('coefficient-chart').getContext('2d');
        
        // Filter out intercept and prepare data
        const filteredCoefs = coefficients.filter(coef => coef.dimension !== 'intercept');
        const labels = filteredCoefs.map(coef => formatDimensionName(coef.dimension));
        const impacts = filteredCoefs.map(coef => coef.impact * 100);
        const backgroundColors = impacts.map(impact => 
            impact >= 0 ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)'
        );
        const borderColors = impacts.map(impact => 
            impact >= 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'
        );
        
        // Create chart
        charts['coefficients'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Impact on Win Rate (%)',
                    data: impacts,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Impact on Win Rate (%)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `Impact: ${value.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Run regression analysis
     */
    function runRegressionAnalysis() {
        // Show loading state
        showLoading(true);
        
        // Get selected dimensions
        const selectedDimensions = getSelectedDimensions();
        
        if (selectedDimensions.length === 0) {
            showError('Please select at least one dimension for analysis.');
            showLoading(false);
            return;
        }
        
        // Get regression options
        const confidenceLevel = parseFloat(document.getElementById('confidence-level').value);
        const regressionMethod = document.getElementById('regression-method').value;
        
        // Prepare data for regression
        const regressionData = prepareRegressionData(selectedDimensions);
        
        // Send data to worker
        regressionWorker.postMessage({
            action: 'multivariate_regression',
            id: 'multivariate_regression',
            data: {
                X: regressionData.X,
                y: regressionData.y,
                variableNames: regressionData.variableNames,
                confidenceLevel: confidenceLevel
            }
        });
    }
    
    /**
     * Get selected dimensions from checkboxes
     * @returns {Array} Array of selected dimension IDs
     */
    function getSelectedDimensions() {
        const checkboxes = document.querySelectorAll('.dimension-regression-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    /**
     * Prepare data for regression analysis
     * @param {Array} selectedDimensions - IDs of selected dimensions
     * @returns {Object} Prepared regression data
     */
    function prepareRegressionData(selectedDimensions) {
        // Filter opportunities data to include only selected dimensions
        const opportunities = dimensionImpactData.opportunities || [];
        const dimensionMap = {};
        
        dimensionImpactData.dimensions.forEach(dim => {
            if (selectedDimensions.includes(dim.id)) {
                dimensionMap[dim.id] = dim;
            }
        });
        
        // Prepare X (independent variables) and y (dependent variable - win rate)
        const X = [];
        const y = [];
        const variableNames = selectedDimensions.map(id => dimensionMap[id].name);
        
        opportunities.forEach(opp => {
            const xRow = [];
            
            selectedDimensions.forEach(dimId => {
                // Handle different data types appropriately
                const dimension = dimensionMap[dimId];
                const value = opp.dimensions[dimId];
                
                if (dimension.type === 'categorical') {
                    // For categorical variables, we'd need one-hot encoding
                    // This is a simplified approach
                    xRow.push(dimension.categories.indexOf(value));
                } else {
                    // For numerical variables, use the value directly
                    xRow.push(parseFloat(value) || 0);
                }
            });
            
            X.push(xRow);
            y.push(opp.won ? 1 : 0); // Binary outcome: 1 if won, 0 if lost
        });
        
        return { X, y, variableNames };
    }
    
    /**
     * Handle regression result from worker
     * @param {Object} result - Regression result
     */
    function handleRegressionResult(result) {
        // Store regression model
        regressionModel = result;
        
        // Update UI with results
        updateUIWithRegressionResults(result);
        
        // Hide loading state
        showLoading(false);
    }
    
    /**
     * Update UI with regression results
     * @param {Object} result - Regression result
     */
    function updateUIWithRegressionResults(result) {
        // Format results for UI
        const formattedModel = {
            rSquared: result.rSquared,
            adjustedRSquared: result.adjustedRSquared,
            coefficients: result.coefficients.map(coef => ({
                dimension: coef.name === 'Intercept' ? 'intercept' : coef.name,
                coefficient: coef.coefficient,
                standardError: coef.standardError,
                tStat: coef.tStat,
                pValue: coef.pValue,
                confidenceInterval: coef.confidenceInterval,
                impact: calculateImpact(coef),
                isSignificant: coef.pValue < 0.05
            })),
            fStat: {
                value: result.fStat || 0,
                pValue: result.fPValue || 0
            }
        };
        
        // Update dimension impact data
        dimensionImpactData.model = formattedModel;
        
        // Render results
        renderFactorsOverview();
    }
    
    /**
     * Calculate impact of a coefficient
     * @param {Object} coefficient - Regression coefficient
     * @returns {number} Calculated impact
     */
    function calculateImpact(coefficient) {
        // For binary outcomes, we would calculate marginal effect
        // This is a simplified approach
        if (coefficient.name === 'Intercept') {
            return coefficient.coefficient;
        }
        
        // For continuous variables, calculate standardized impact
        const dimensionInfo = dimensionImpactData.dimensions.find(
            dim => dim.name === coefficient.name
        );
        
        if (!dimensionInfo) return coefficient.coefficient;
        
        // Different impact calculation based on variable type
        if (dimensionInfo.type === 'categorical') {
            return coefficient.coefficient;
        } else {
            // For continuous variables, impact is coefficient * std dev
            return coefficient.coefficient * (dimensionInfo.stats.standardDeviation || 1);
        }
    }
    
    /**
     * Update confidence intervals in the UI
     * @param {Object} intervals - Confidence intervals data
     */
    function updateConfidenceIntervals(intervals) {
        // Implementation depends on how we want to update the UI
        console.log('Confidence intervals updated:', intervals);
    }
    
    /**
     * Export impact analysis report
     */
    function exportImpactReport() {
        if (!dimensionImpactData.model) {
            showError('No analysis results to export. Run an analysis first.');
            return;
        }
        
        // Create report content
        const reportContent = generateReportContent();
        
        // Create download link
        const blob = new Blob([reportContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `win-rate-impact-analysis-${new Date().toISOString().slice(0, 10)}.html`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Generate HTML report content
     * @returns {string} HTML report content
     */
    function generateReportContent() {
        const model = dimensionImpactData.model;
        
        // Create HTML report
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Win Rate Impact Analysis Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2, h3 { color: #333; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .positive { color: green; }
                    .negative { color: red; }
                    .significant { font-weight: bold; color: green; }
                    .not-significant { color: gray; }
                    .header { display: flex; justify-content: space-between; align-items: center; }
                    .metrics { display: flex; gap: 20px; }
                    .metric { border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
                    .interpretation { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Win Rate Impact Analysis Report</h1>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="metrics">
                    <div class="metric">
                        <h3>R-Squared</h3>
                        <p>${model.rSquared.toFixed(3)}</p>
                    </div>
                    <div class="metric">
                        <h3>Adjusted R-Squared</h3>
                        <p>${model.adjustedRSquared.toFixed(3)}</p>
                    </div>
                    <div class="metric">
                        <h3>Model Significance</h3>
                        <p>${model.fStat.pValue < 0.05 ? 'Significant' : 'Not Significant'}</p>
                        <p>p-value: ${model.fStat.pValue.toExponential(2)}</p>
                    </div>
                </div>
                
                <h2>Coefficient Analysis</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Dimension</th>
                            <th>Coefficient</th>
                            <th>Impact</th>
                            <th>p-value</th>
                            <th>Significant</th>
                            <th>Confidence Interval</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${model.coefficients.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
                            .map(coef => `
                                <tr>
                                    <td>${formatDimensionName(coef.dimension)}</td>
                                    <td>${coef.coefficient.toFixed(4)}</td>
                                    <td class="${coef.coefficient > 0 ? 'positive' : 'negative'}">
                                        ${coef.coefficient > 0 ? '+' : '-'}${Math.abs(coef.impact * 100).toFixed(2)}%
                                    </td>
                                    <td>${coef.pValue.toExponential(2)}</td>
                                    <td class="${coef.pValue < 0.05 ? 'significant' : 'not-significant'}">
                                        ${coef.pValue < 0.05 ? 'Yes' : 'No'}
                                    </td>
                                    <td>
                                        [${coef.confidenceInterval[0].toFixed(4)}, ${coef.confidenceInterval[1].toFixed(4)}]
                                    </td>
                                </tr>
                            `).join('')
                        }
                    </tbody>
                </table>
                
                <h2>Interpretation</h2>
                <div class="interpretation">
                    <p>The model explains <strong>${(model.rSquared * 100).toFixed(1)}%</strong> of the variation in win rates.</p>
                    <p>Key factors influencing win rates:</p>
                    <ul>
                        ${model.coefficients
                            .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
                            .slice(0, 5)
                            .map(coef => {
                                if (coef.dimension === 'intercept') {
                                    return `<li>The baseline win rate (intercept) is <strong>${(coef.coefficient * 100).toFixed(1)}%</strong>.</li>`;
                                } else if (coef.pValue < 0.05) {
                                    const impact = coef.coefficient > 0 ? 'increases' : 'decreases';
                                    return `
                                        <li>
                                            <strong>${formatDimensionName(coef.dimension)}</strong> ${impact} win rate by 
                                            <strong>${Math.abs(coef.impact * 100).toFixed(2)}%</strong> 
                                            (p-value: ${coef.pValue.toExponential(2)}).
                                        </li>
                                    `;
                                }
                                return '';
                            }).join('')
                        }
                    </ul>
                    <p>
                        <strong>Note:</strong> Factors with p-value < 0.05 are considered statistically significant.
                    </p>
                </div>
                
                <h2>Analysis Details</h2>
                <p>Time Period: ${selectedTimePeriod.replace('_', ' ')}</p>
                <p>Regression Method: ${document.getElementById('regression-method').value}</p>
                <p>Confidence Level: ${document.getElementById('confidence-level').value}</p>
                <p>Number of observations: ${dimensionImpactData.opportunities ? dimensionImpactData.opportunities.length : 'N/A'}</p>
            </body>
            </html>
        `;
    }
    
    /**
     * Format dimension name for display
     * @param {string} dimension - Dimension name
     * @returns {string} Formatted dimension name
     */
    function formatDimensionName(dimension) {
        if (dimension === 'intercept') return 'Intercept (Baseline)';
        
        // Convert camelCase or snake_case to Title Case
        return dimension
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, str => str.toUpperCase());
    }
    
    /**
     * Show or hide loading indicator
     * @param {boolean} show - Whether to show loading indicator
     */
    function showLoading(show) {
        const loadingElement = document.getElementById('impact-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to show
     */
    function showError(message) {
        const errorElement = document.getElementById('impact-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Hide after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }
    
    /**
     * Clear all analysis elements
     */
    function clearAnalysis() {
        // Destroy existing charts
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        charts = {};
        
        // Clear containers
        document.getElementById('dimension-selection').innerHTML = '';
        document.getElementById('factors-overview').innerHTML = '';
    }
    
    /**
     * Resize charts when window size changes
     */
    function resizeCharts() {
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
    }
    
    // Public API
    return {
        initialize,
        loadDimensionImpactData
    };
})();

// Export for use in other modules
window.DimensionImpact = DimensionImpact;
