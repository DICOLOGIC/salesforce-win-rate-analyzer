/**
 * Prediction module for Win Rate Analyzer
 * Handles win rate prediction and formula visualization
 */

const Prediction = (function() {
    // Private variables
    let predictionModel = null;
    let predictionData = {};
    let currentOpportunity = null;
    let predictionWorker = null;
    let charts = {};
    
    /**
     * Initialize the module
     */
    function initialize() {
        // Initialize the worker
        initializeWorker();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load prediction model
        loadPredictionModel();
    }
    
    /**
     * Initialize the prediction worker
     */
    function initializeWorker() {
        try {
            predictionWorker = new Worker('./js/workers/predictionWorker.js');
            
            // Set up event listener for worker messages
            predictionWorker.addEventListener('message', handleWorkerMessage);
        } catch (error) {
            console.error('Failed to initialize prediction worker:', error);
            showError('Failed to initialize prediction analysis. Browser may not support Web Workers.');
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
            showError(`Prediction error: ${error}`);
            showLoading(false);
            return;
        }
        
        // Handle different worker responses based on id
        switch (id) {
            case 'train_model':
                handleTrainModelResult(result);
                break;
                
            case 'predict_win_rate':
                handlePredictionResult(result);
                break;
                
            case 'batch_prediction':
                handleBatchPredictionResult(result);
                break;
                
            case 'generate_formula':
                handleFormulaResult(result);
                break;
                
            case 'feature_importance':
                handleFeatureImportanceResult(result);
                break;
                
            default:
                console.warn('Unknown worker response id:', id);
        }
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Prediction form submit
        document.getElementById('prediction-form').addEventListener('submit', function(e) {
            e.preventDefault();
            predictOpportunityWinRate();
        });
        
        // Clear form button
        document.getElementById('clear-prediction-form').addEventListener('click', function() {
            clearPredictionForm();
        });
        
        // Train model button
        document.getElementById('train-model-button').addEventListener('click', function() {
            trainPredictionModel();
        });
        
        // Generate formula button
        document.getElementById('generate-formula-button').addEventListener('click', function() {
            generateWinRateFormula();
        });
        
        // Export formula button
        document.getElementById('export-formula-button').addEventListener('click', function() {
            exportFormula();
        });
        
        // Feature importance button
        document.getElementById('calculate-feature-importance').addEventListener('click', function() {
            calculateFeatureImportance();
        });
        
        // Listen for opportunity selection events
        Utils.eventBus.subscribe('opportunity:selected', function(opportunityId) {
            loadOpportunityData(opportunityId);
        });
        
        // Listen for auth state changes
        Utils.eventBus.subscribe('auth:stateChanged', function(isAuthenticated) {
            if (isAuthenticated) {
                loadPredictionModel();
            } else {
                clearPrediction();
            }
        });
        
        // Window resize event for responsive charts
        window.addEventListener('resize', Utils.debounce(function() {
            resizeCharts();
        }, 250));
    }
    
    /**
     * Load prediction model from API
     */
    function loadPredictionModel() {
        showLoading(true);
        
        API.getPredictionModel()
            .then(function(data) {
                predictionModel = data.model;
                predictionData = data;
                renderModelInfo();
                showLoading(false);
            })
            .catch(function(error) {
                console.error('Error loading prediction model:', error);
                showError('Failed to load prediction model. You may need to train a model first.');
                showLoading(false);
            });
    }
    
    /**
     * Render model information
     */
    function renderModelInfo() {
        const container = document.getElementById('model-info');
        
        if (!predictionModel) {
            container.innerHTML = `
                <div class="no-model-message">
                    <p>No prediction model available. You need to train a model first.</p>
                    <button id="train-model-button" class="btn btn-primary">Train Model</button>
                </div>
            `;
            return;
        }
        
        // Create HTML for model info
        const html = `
            <div class="model-summary">
                <h3>Prediction Model Details</h3>
                <div class="model-metrics">
                    <div class="metric-card">
                        <h4>Accuracy</h4>
                        <p class="metric-value">${Utils.formatPercentage(predictionModel.performance.accuracy)}</p>
                    </div>
                    <div class="metric-card">
                        <h4>F1 Score</h4>
                        <p class="metric-value">${predictionModel.performance.f1Score.toFixed(3)}</p>
                    </div>
                    <div class="metric-card">
                        <h4>Last Updated</h4>
                        <p class="metric-value">${Utils.formatDate(predictionModel.lastUpdated)}</p>
                    </div>
                </div>
                
                <div class="model-actions">
                    <button id="train-model-button" class="btn btn-outline-primary">Retrain Model</button>
                    <button id="generate-formula-button" class="btn btn-outline-primary">Generate Formula</button>
                    <button id="calculate-feature-importance" class="btn btn-outline-primary">Feature Importance</button>
                </div>
            </div>
            
            <div id="formula-container" class="formula-container ${predictionModel.formula ? '' : 'hidden'}">
                <h3>Win Rate Formula</h3>
                <div class="formula-display">
                    ${predictionModel.formula ? formatFormula(predictionModel.formula) : ''}
                </div>
                <button id="export-formula-button" class="btn btn-sm btn-outline-primary">Export Formula</button>
            </div>
            
            <div id="feature-importance-container" class="feature-importance-container ${predictionModel.featureImportance ? '' : 'hidden'}">
                <h3>Feature Importance</h3>
                <div class="feature-importance-chart-container">
                    <canvas id="feature-importance-chart"></canvas>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Create feature importance chart if data is available
        if (predictionModel.featureImportance) {
            createFeatureImportanceChart(predictionModel.featureImportance);
        }
    }
    
    /**
     * Format formula for display
     * @param {string} formula - Formula text
     * @returns {string} Formatted HTML
     */
    function formatFormula(formula) {
        // Convert basic math notation to properly formatted HTML
        return formula
            .replace(/e\^-z/g, '<span class="formula-exp">e<sup>-z</sup></span>')
            .replace(/e\^z/g, '<span class="formula-exp">e<sup>z</sup></span>')
            .replace(/\*/g, '×')
            .replace(/\+/g, '<span class="formula-operator">+</span>')
            .replace(/\-/g, '<span class="formula-operator">-</span>')
            .replace(/where z =/g, '<br>where z =');
    }
    
    /**
     * Create feature importance chart
     * @param {Array} featureImportance - Feature importance data
     */
    function createFeatureImportanceChart(featureImportance) {
        const ctx = document.getElementById('feature-importance-chart').getContext('2d');
        
        // Sort features by importance
        const sortedFeatures = [...featureImportance]
            .sort((a, b) => b.importance - a.importance);
        
        // Take top 10 features
        const topFeatures = sortedFeatures.slice(0, 10);
        
        // Prepare data
        const labels = topFeatures.map(f => formatFeatureName(f.feature));
        const values = topFeatures.map(f => f.importance * 100);
        
        // Create chart
        charts['featureImportance'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Importance (%)',
                    data: values,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
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
                            text: 'Importance (%)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `Importance: ${value.toFixed(1)}%`;
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    /**
     * Train prediction model
     */
    function trainPredictionModel() {
        showLoading(true);
        
        API.getTrainingData()
            .then(function(data) {
                // Send data to worker for training
                predictionWorker.postMessage({
                    action: 'train_model',
                    id: 'train_model',
                    data: {
                        X: data.features,
                        y: data.targets,
                        options: {
                            maxIterations: 200,
                            learningRate: 0.1,
                            regularization: 0.01
                        }
                    }
                });
            })
            .catch(function(error) {
                console.error('Error loading training data:', error);
                showError('Failed to load training data for model training.');
                showLoading(false);
            });
    }
    
    /**
     * Handle train model result from worker
     * @param {Object} result - Training result
     */
    function handleTrainModelResult(result) {
        // Save trained model
        predictionModel = {
            weights: result.weights,
            numFeatures: result.numFeatures,
            performance: result.performance,
            lastUpdated: new Date().toISOString()
        };
        
        // Save model to API
        API.savePredictionModel(predictionModel)
            .then(function() {
                // Refresh model info display
                renderModelInfo();
                showSuccess('Model trained successfully!');
                showLoading(false);
                
                // Generate formula automatically
                generateWinRateFormula();
            })
            .catch(function(error) {
                console.error('Error saving prediction model:', error);
                showError('Model was trained but could not be saved. Please try again.');
                showLoading(false);
            });
    }
    
    /**
     * Generate win rate formula
     */
    function generateWinRateFormula() {
        if (!predictionModel) {
            showError('No prediction model available. Train a model first.');
            return;
        }
        
        showLoading(true);
        
        // Get feature names
        API.getFeatureNames()
            .then(function(featureNames) {
                // Send request to worker
                predictionWorker.postMessage({
                    action: 'generate_formula',
                    id: 'generate_formula',
                    data: {
                        model: predictionModel,
                        featureNames: featureNames,
                        options: {
                            simplify: true,
                            precision: 3
                        }
                    }
                });
            })
            .catch(function(error) {
                console.error('Error getting feature names:', error);
                showError('Failed to get feature names for formula generation.');
                showLoading(false);
            });
    }
    
    /**
     * Handle formula result from worker
     * @param {Object} result - Formula result
     */
    function handleFormulaResult(result) {
        // Save formula to model
        predictionModel.formula = result.simplifiedFormula;
        predictionModel.detailedFormula = result.detailedFormula;
        predictionModel.featureWeightPairs = result.featureWeightPairs;
        
        // Save updated model to API
        API.savePredictionModel(predictionModel)
            .then(function() {
                // Refresh model info display
                renderModelInfo();
                showSuccess('Formula generated successfully!');
                showLoading(false);
            })
            .catch(function(error) {
                console.error('Error saving formula:', error);
                showError('Formula was generated but could not be saved. Please try again.');
                showLoading(false);
            });
    }
    
    /**
     * Calculate feature importance
     */
    function calculateFeatureImportance() {
        if (!predictionModel) {
            showError('No prediction model available. Train a model first.');
            return;
        }
        
        showLoading(true);
        
        // Get feature names and training data
        Promise.all([
            API.getFeatureNames(),
            API.getTrainingData()
        ])
            .then(function([featureNames, trainingData]) {
                // Send request to worker
                predictionWorker.postMessage({
                    action: 'feature_importance',
                    id: 'feature_importance',
                    data: {
                        model: predictionModel,
                        featureNames: featureNames,
                        X: trainingData.features
                    }
                });
            })
            .catch(function(error) {
                console.error('Error getting data for feature importance:', error);
                showError('Failed to get data for feature importance calculation.');
                showLoading(false);
            });
    }
    
    /**
     * Handle feature importance result from worker
     * @param {Object} result - Feature importance result
     */
    function handleFeatureImportanceResult(result) {
        // Save feature importance to model
        predictionModel.featureImportance = result.featureImportance;
        
        // Save updated model to API
        API.savePredictionModel(predictionModel)
            .then(function() {
                // Refresh model info display
                renderModelInfo();
                showSuccess('Feature importance calculated successfully!');
                showLoading(false);
            })
            .catch(function(error) {
                console.error('Error saving feature importance:', error);
                showError('Feature importance was calculated but could not be saved. Please try again.');
                showLoading(false);
            });
    }
    
    /**
     * Predict win rate for current opportunity
     */
    function predictOpportunityWinRate() {
        if (!predictionModel) {
            showError('No prediction model available. Train a model first.');
            return;
        }
        
        // Get form values
        const features = getFormFeatures();
        
        // Submit to worker for prediction
        predictionWorker.postMessage({
            action: 'predict_win_rate',
            id: 'predict_win_rate',
            data: {
                model: predictionModel,
                features: features
            }
        });
        
        showLoading(true);
    }
    
    /**
     * Get features from form inputs
     * @returns {Array} Feature values
     */
    function getFormFeatures() {
        const formInputs = document.querySelectorAll('#prediction-form .feature-input');
        const features = [];
        
        formInputs.forEach(input => {
            let value;
            
            if (input.type === 'checkbox') {
                value = input.checked ? 1 : 0;
            } else if (input.type === 'number') {
                value = parseFloat(input.value) || 0;
            } else if (input.type === 'select-one') {
                // For select elements, get the selected option's value
                value = parseFloat(input.value) || 0;
            } else {
                value = input.value;
            }
            
            features.push(value);
        });
        
        return features;
    }
    
    /**
     * Handle prediction result from worker
     * @param {Object} result - Prediction result
     */
    function handlePredictionResult(result) {
        showLoading(false);
        
        // Display prediction results
        const resultContainer = document.getElementById('prediction-result');
        
        resultContainer.innerHTML = `
            <div class="prediction-summary">
                <h3>Win Probability</h3>
                <div class="prediction-gauge">
                    <div class="gauge-value ${getProbabilityClass(result.probability)}">
                        ${Utils.formatPercentage(result.probability)}
                    </div>
                    <div class="gauge-label">${result.category.toUpperCase()}</div>
                </div>
            </div>
            
            <div class="prediction-details">
                <h4>Key Factors</h4>
                <div class="factors-list">
                    ${result.featureContributions.slice(0, 5).map(fc => `
                        <div class="factor-item">
                            <div class="factor-name">${formatFeatureName(fc.index)}</div>
                            <div class="factor-impact ${fc.contribution > 0 ? 'positive' : 'negative'}">
                                ${fc.contribution > 0 ? '+' : ''}${fc.contribution.toFixed(3)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="prediction-actions">
                <button id="clear-prediction-form" class="btn btn-outline-secondary">Clear Form</button>
            </div>
        `;
        
        // Scroll to results
        resultContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    /**
     * Handle batch prediction result from worker
     * @param {Object} result - Batch prediction result
     */
    function handleBatchPredictionResult(result) {
        // Implementation for batch prediction if needed
        console.log('Batch prediction results:', result);
    }
    
    /**
     * Load opportunity data from API
     * @param {string} opportunityId - Opportunity ID
     */
    function loadOpportunityData(opportunityId) {
        showLoading(true);
        
        API.getOpportunityDetails(opportunityId)
            .then(function(data) {
                currentOpportunity = data;
                populatePredictionForm(data);
                showLoading(false);
            })
            .catch(function(error) {
                console.error('Error loading opportunity data:', error);
                showError('Failed to load opportunity details.');
                showLoading(false);
            });
    }
    
    /**
     * Populate prediction form with opportunity data
     * @param {Object} opportunity - Opportunity data
     */
    function populatePredictionForm(opportunity) {
        const formInputs = document.querySelectorAll('#prediction-form .feature-input');
        
        formInputs.forEach(input => {
            const featureId = input.getAttribute('data-feature-id');
            if (featureId && opportunity.features[featureId] !== undefined) {
                const value = opportunity.features[featureId];
                
                if (input.type === 'checkbox') {
                    input.checked = value === 1 || value === true;
                } else if (input.type === 'number') {
                    input.value = value;
                } else if (input.type === 'select-one') {
                    input.value = value;
                } else {
                    input.value = value;
                }
            }
        });
        
        // Auto-predict with the loaded data
        predictOpportunityWinRate();
    }
    
    /**
     * Clear prediction form
     */
    function clearPredictionForm() {
        const form = document.getElementById('prediction-form');
        form.reset();
        
        document.getElementById('prediction-result').innerHTML = '';
        currentOpportunity = null;
    }
    
    /**
     * Export formula as PDF or image
     */
    function exportFormula() {
        if (!predictionModel || !predictionModel.formula) {
            showError('No formula available to export. Generate a formula first.');
            return;
        }
        
        // Create a temporary div for rendering the formula report
        const tempDiv = document.createElement('div');
        tempDiv.className = 'formula-export-container';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        
        // Add content to the div
        tempDiv.innerHTML = `
            <div class="formula-export">
                <h2>Win Rate Prediction Formula</h2>
                <div class="formula-content">
                    <h3>Simplified Formula</h3>
                    <div class="formula-box">
                        ${formatFormula(predictionModel.formula)}
                    </div>
                    
                    <h3>Detailed Formula</h3>
                    <div class="formula-box">
                        ${formatFormula(predictionModel.detailedFormula)}
                    </div>
                    
                    <h3>Feature Weights</h3>
                    <table class="weights-table">
                        <thead>
                            <tr>
                                <th>Feature</th>
                                <th>Weight</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${predictionModel.featureWeightPairs.map(pair => `
                                <tr>
                                    <td>${formatFeatureName(pair.feature)}</td>
                                    <td>${pair.weight.toFixed(4)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="export-footer">
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>
            </div>
        `;
        
        // Append to document, print, then remove
        document.body.appendChild(tempDiv);
        
        // Use html2canvas or similar library to create an image
        // For simplicity, we'll just use the browser's print functionality
        window.print();
        
        // Clean up
        document.body.removeChild(tempDiv);
    }
    
    /**
     * Format feature name for display
     * @param {string|number} feature - Feature name or index
     * @returns {string} Formatted feature name
     */
    function formatFeatureName(feature) {
        if (typeof feature === 'number') {
            // Try to get feature name from predictionData
            if (predictionData.featureNames && predictionData.featureNames[feature]) {
                feature = predictionData.featureNames[feature];
            } else {
                return `Feature ${feature + 1}`;
            }
        }
        
        // Convert camelCase or snake_case to Title Case
        return feature
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, str => str.toUpperCase());
    }
    
    /**
     * Get CSS class based on probability value
     * @param {number} probability - Probability value
     * @returns {string} CSS class
     */
    function getProbabilityClass(probability) {
        if (probability >= 0.7) {
            return 'high-probability';
        } else if (probability >= 0.4) {
            return 'medium-probability';
        } else {
            return 'low-probability';
        }
    }
    
    /**
     * Show or hide loading indicator
     * @param {boolean} show - Whether to show loading indicator
     */
    function showLoading(show) {
        const loadingElement = document.getElementById('prediction-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to show
     */
    function showError(message) {
        const errorElement = document.getElementById('prediction-error');
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
     * Show success message
     * @param {string} message - Success message to show
     */
    function showSuccess(message) {
        const successElement = document.getElementById('prediction-success');
        if (successElement) {
            successElement.textContent = message;
            successElement.style.display = 'block';
            
            // Hide after 5 seconds
            setTimeout(() => {
                successElement.style.display = 'none';
            }, 5000);
        }
    }
    
    /**
     * Clear all prediction elements
     */
    function clearPrediction() {
        // Destroy existing charts
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        charts = {};
        
        // Clear containers
        document.getElementById('model-info').innerHTML = '';
        document.getElementById('prediction-result').innerHTML = '';
        
        // Reset form
        clearPredictionForm();
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
        loadPredictionModel
    };
})();

// Export for use in other modules
window.Prediction = Prediction;
