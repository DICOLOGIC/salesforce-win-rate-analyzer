/**
 * Web Worker for win rate prediction calculations
 * Handles computationally intensive prediction operations off the main thread
 */

// Import required libraries
importScripts('../libs/jstat.min.js');

// Handle messages from the main thread
self.onmessage = function(e) {
    const { action, data, id } = e.data;
    
    try {
        let result;
        
        switch (action) {
            case 'train_model':
                result = trainPredictionModel(data);
                break;
                
            case 'predict_win_rate':
                result = predictWinRate(data);
                break;
                
            case 'batch_prediction':
                result = batchPrediction(data);
                break;
                
            case 'generate_formula':
                result = generateWinRateFormula(data);
                break;
                
            case 'feature_importance':
                result = calculateFeatureImportance(data);
                break;
                
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        
        // Send successful result back to main thread
        self.postMessage({
            success: true,
            id,
            result
        });
    } catch (error) {
        // Send error back to main thread
        self.postMessage({
            success: false,
            id,
            error: error.message
        });
    }
};

/**
 * Train a logistic regression model for win rate prediction
 * @param {Object} data - Training data
 * @param {Array} data.X - Matrix of independent variables
 * @param {Array} data.y - Vector of dependent variable (win/loss)
 * @param {Object} data.options - Training options
 * @returns {Object} Trained model
 */
function trainPredictionModel(data) {
    const { X, y, options = {} } = data;
    const { maxIterations = 100, learningRate = 0.1, regularization = 0.01 } = options;
    
    // Check for valid input
    if (!X || !y || X.length === 0 || y.length === 0 || X.length !== y.length) {
        throw new Error('Invalid input data for model training');
    }
    
    try {
        // Add bias term (intercept) to X
        const XWithBias = X.map(row => [1, ...row]);
        
        // Initialize weights
        const numFeatures = XWithBias[0].length;
        let weights = new Array(numFeatures).fill(0);
        
        // Logistic regression using gradient descent
        let iteration = 0;
        let converged = false;
        let costHistory = [];
        
        while (!converged && iteration < maxIterations) {
            // Calculate predictions
            const predictions = XWithBias.map(row => sigmoid(dotProduct(row, weights)));
            
            // Calculate error
            const errors = predictions.map((pred, i) => pred - y[i]);
            
            // Calculate gradients with L2 regularization
            const gradients = new Array(numFeatures).fill(0);
            
            for (let j = 0; j < numFeatures; j++) {
                for (let i = 0; i < XWithBias.length; i++) {
                    gradients[j] += errors[i] * XWithBias[i][j];
                }
                
                // Add regularization term (don't regularize bias term)
                if (j > 0) {
                    gradients[j] += regularization * weights[j];
                }
                
                gradients[j] /= XWithBias.length;
            }
            
            // Update weights
            const oldWeights = [...weights];
            for (let j = 0; j < numFeatures; j++) {
                weights[j] -= learningRate * gradients[j];
            }
            
            // Calculate cost function
            const cost = calculateLogisticCost(XWithBias, y, weights, regularization);
            costHistory.push(cost);
            
            // Check for convergence
            if (iteration > 5) {
                const weightChange = Math.sqrt(
                    weights.reduce((sum, w, i) => sum + Math.pow(w - oldWeights[i], 2), 0)
                );
                
                if (weightChange < 0.0001) {
                    converged = true;
                }
            }
            
            iteration++;
        }
        
        // Calculate model performance metrics
        const predictions = XWithBias.map(row => sigmoid(dotProduct(row, weights)) >= 0.5 ? 1 : 0);
        const accuracy = predictions.reduce((sum, pred, i) => sum + (pred === y[i] ? 1 : 0), 0) / y.length;
        
        // Calculate confusion matrix
        const confusionMatrix = {
            truePositive: 0,
            falsePositive: 0,
            trueNegative: 0,
            falseNegative: 0
        };
        
        for (let i = 0; i < y.length; i++) {
            if (y[i] === 1 && predictions[i] === 1) confusionMatrix.truePositive++;
            if (y[i] === 0 && predictions[i] === 1) confusionMatrix.falsePositive++;
            if (y[i] === 0 && predictions[i] === 0) confusionMatrix.trueNegative++;
            if (y[i] === 1 && predictions[i] === 0) confusionMatrix.falseNegative++;
        }
        
        // Calculate precision, recall, F1
        const precision = confusionMatrix.truePositive / (confusionMatrix.truePositive + confusionMatrix.falsePositive) || 0;
        const recall = confusionMatrix.truePositive / (confusionMatrix.truePositive + confusionMatrix.falseNegative) || 0;
        const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
        
        // Return model and training information
        return {
            weights,
            numFeatures,
            converged,
            iterations: iteration,
            costHistory,
            performance: {
                accuracy,
                precision,
                recall,
                f1Score,
                confusionMatrix
            }
        };
    } catch (error) {
        throw new Error(`Model training error: ${error.message}`);
    }
}

/**
 * Predict win rate for a single opportunity
 * @param {Object} data - Prediction data
 * @param {Object} data.model - Trained prediction model
 * @param {Array} data.features - Feature values for the opportunity
 * @returns {Object} Prediction results
 */
function predictWinRate(data) {
    const { model, features } = data;
    
    if (!model || !features) {
        throw new Error('Missing model or features for prediction');
    }
    
    try {
        // Add bias term
        const featuresWithBias = [1, ...features];
        
        // Calculate probability using sigmoid function
        const probability = sigmoid(dotProduct(featuresWithBias, model.weights));
        
        // Calculate feature contributions
        const featureContributions = calculateFeatureContributions(featuresWithBias, model.weights);
        
        // Determine win probability category
        let category;
        if (probability >= 0.7) {
            category = 'high';
        } else if (probability >= 0.4) {
            category = 'medium';
        } else {
            category = 'low';
        }
        
        return {
            probability,
            category,
            featureContributions
        };
    } catch (error) {
        throw new Error(`Prediction error: ${error.message}`);
    }
}

/**
 * Perform batch prediction for multiple opportunities
 * @param {Object} data - Batch prediction data
 * @param {Object} data.model - Trained prediction model
 * @param {Array} data.featuresList - Array of feature sets for opportunities
 * @returns {Array} Array of prediction results
 */
function batchPrediction(data) {
    const { model, featuresList } = data;
    
    if (!model || !featuresList || !Array.isArray(featuresList)) {
        throw new Error('Invalid input for batch prediction');
    }
    
    try {
        // Process each set of features
        const results = featuresList.map(features => {
            return predictWinRate({ model, features });
        });
        
        return {
            predictions: results,
            summary: {
                count: results.length,
                averageProbability: results.reduce((sum, r) => sum + r.probability, 0) / results.length,
                categoryBreakdown: {
                    high: results.filter(r => r.category === 'high').length,
                    medium: results.filter(r => r.category === 'medium').length,
                    low: results.filter(r => r.category === 'low').length
                }
            }
        };
    } catch (error) {
        throw new Error(`Batch prediction error: ${error.message}`);
    }
}

/**
 * Generate a human-readable formula for win rate calculation
 * @param {Object} data - Formula generation data
 * @param {Object} data.model - Trained prediction model
 * @param {Array} data.featureNames - Names of features
 * @param {Object} data.options - Formula options
 * @returns {Object} Generated formula and related information
 */
function generateWinRateFormula(data) {
    const { model, featureNames, options = {} } = data;
    const { simplify = true, precision = 3 } = options;
    
    if (!model || !featureNames) {
        throw new Error('Missing model or feature names for formula generation');
    }
    
    if (featureNames.length !== model.weights.length - 1) {
        throw new Error('Number of feature names must match model features');
    }
    
    try {
        // Add "Intercept" at the beginning of feature names
        const allFeatureNames = ['Intercept', ...featureNames];
        
        // Generate detailed formula
        let detailedFormula = 'Win Probability = 1 / (1 + e^-z), where z = ';
        let termsDetailed = [];
        
        model.weights.forEach((weight, index) => {
            const featureName = allFeatureNames[index];
            const roundedWeight = weight.toFixed(precision);
            
            if (index === 0) {
                termsDetailed.push(`${roundedWeight}`);
            } else if (weight >= 0) {
                termsDetailed.push(`+ ${roundedWeight} × ${featureName}`);
            } else {
                termsDetailed.push(`- ${Math.abs(weight).toFixed(precision)} × ${featureName}`);
            }
        });
        
        detailedFormula += termsDetailed.join(' ');
        
        // Generate simplified formula if requested
        let simplifiedFormula = '';
        if (simplify) {
            // Sort features by absolute weight value
            const featurePairs = model.weights.map((weight, index) => ({
                weight,
                name: allFeatureNames[index]
            })).slice(1); // Skip intercept
            
            featurePairs.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
            
            // Take top 3-5 features based on weight magnitude
            const topFeatures = featurePairs.slice(0, Math.min(5, featurePairs.length));
            
            // Create simplified formula with just intercept and top features
            simplifiedFormula = 'Win Probability ≈ 1 / (1 + e^-z), where z = ';
            let termsSimplified = [`${model.weights[0].toFixed(precision)}`];
            
            topFeatures.forEach(feature => {
                if (feature.weight >= 0) {
                    termsSimplified.push(`+ ${feature.weight.toFixed(precision)} × ${feature.name}`);
                } else {
                    termsSimplified.push(`- ${Math.abs(feature.weight).toFixed(precision)} × ${feature.name}`);
                }
            });
            
            simplifiedFormula += termsSimplified.join(' ');
            
            if (topFeatures.length < featureNames.length) {
                simplifiedFormula += ' + [other factors]';
            }
        }
        
        return {
            detailedFormula,
            simplifiedFormula,
            featureWeightPairs: allFeatureNames.map((name, index) => ({
                feature: name,
                weight: model.weights[index],
                absWeight: Math.abs(model.weights[index])
            })).sort((a, b) => b.absWeight - a.absWeight)
        };
    } catch (error) {
        throw new Error(`Formula generation error: ${error.message}`);
    }
}

/**
 * Calculate feature importance for the trained model
 * @param {Object} data - Feature importance data
 * @param {Object} data.model - Trained model
 * @param {Array} data.featureNames - Names of features
 * @param {Array} data.X - Training data features
 * @returns {Object} Feature importance information
 */
function calculateFeatureImportance(data) {
    const { model, featureNames, X } = data;
    
    if (!model || !featureNames || !X) {
        throw new Error('Missing required data for feature importance calculation');
    }
    
    try {
        // Calculate standard deviation of each feature
        const stdDevs = [];
        for (let j = 0; j < X[0].length; j++) {
            const featureValues = X.map(row => row[j]);
            stdDevs.push(calculateStandardDeviation(featureValues));
        }
        
        // Feature importance = |weight| * std_dev
        const importanceScores = model.weights.slice(1).map((weight, index) => {
            return Math.abs(weight) * stdDevs[index];
        });
        
        // Normalize to sum to 100%
        const totalImportance = importanceScores.reduce((sum, score) => sum + score, 0);
        const normalizedScores = importanceScores.map(score => score / totalImportance);
        
        // Create importance information
        const importanceInfo = featureNames.map((name, index) => ({
            feature: name,
            importance: normalizedScores[index],
            weight: model.weights[index + 1],
            weightMagnitude: Math.abs(model.weights[index + 1])
        })).sort((a, b) => b.importance - a.importance);
        
        return {
            featureImportance: importanceInfo,
            topFeatures: importanceInfo.slice(0, Math.min(5, importanceInfo.length)),
            bottomFeatures: importanceInfo.slice(-Math.min(5, importanceInfo.length)).reverse()
        };
    } catch (error) {
        throw new Error(`Feature importance calculation error: ${error.message}`);
    }
}

// ---- Helper Functions -----

/**
 * Calculate the sigmoid function
 * @param {number} z - Input value
 * @returns {number} Sigmoid output (between 0 and 1)
 */
function sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
}

/**
 * Calculate the dot product of two vectors
 * @param {Array} a - First vector
 * @param {Array} b - Second vector
 * @returns {number} Dot product
 */
function dotProduct(a, b) {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length for dot product');
    }
    
    return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

/**
 * Calculate logistic regression cost function
 * @param {Array} X - Feature matrix with bias
 * @param {Array} y - Target values
 * @param {Array} weights - Model weights
 * @param {number} lambda - Regularization parameter
 * @returns {number} Cost value
 */
function calculateLogisticCost(X, y, weights, lambda) {
    const m = y.length;
    
    // Calculate predictions
    const predictions = X.map(row => sigmoid(dotProduct(row, weights)));
    
    // Calculate cross-entropy loss
    let cost = 0;
    for (let i = 0; i < m; i++) {
        cost += -y[i] * Math.log(predictions[i] + 1e-10) - (1 - y[i]) * Math.log(1 - predictions[i] + 1e-10);
    }
    cost /= m;
    
    // Add L2 regularization term (exclude bias term)
    const regularizationTerm = (lambda / (2 * m)) * weights.slice(1).reduce((sum, w) => sum + w * w, 0);
    cost += regularizationTerm;
    
    return cost;
}

/**
 * Calculate feature contributions to the prediction
 * @param {Array} features - Feature values with bias
 * @param {Array} weights - Model weights
 * @returns {Array} Feature contributions
 */
function calculateFeatureContributions(features, weights) {
    return features.map((value, index) => ({
        contribution: value * weights[index],
        weight: weights[index],
        value: value,
        index
    })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}

/**
 * Calculate standard deviation of a set of values
 * @param {Array} values - Input values
 * @returns {number} Standard deviation
 */
function calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
}
