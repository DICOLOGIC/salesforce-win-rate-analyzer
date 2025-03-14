/**
 * Web Worker for regression analysis calculations
 * Handles computationally intensive regression operations off the main thread
 */

// Import the jStat library (assuming it's available via importScripts)
importScripts('../libs/jstat.min.js');

// Handle messages from the main thread
self.onmessage = function(e) {
    const { action, data, id } = e.data;
    
    try {
        let result;
        
        switch (action) {
            case 'multivariate_regression':
                result = performMultivariateRegression(data);
                break;
                
            case 'calculate_coefficients':
                result = calculateRegressionCoefficients(data);
                break;
                
            case 'confidence_intervals':
                result = calculateConfidenceIntervals(data);
                break;
                
            case 'statistical_significance':
                result = calculateStatisticalSignificance(data);
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
 * Perform multivariate regression analysis
 * @param {Object} data - Regression data
 * @param {Array} data.X - Matrix of independent variables (each row is an observation, each column a variable)
 * @param {Array} data.y - Vector of dependent variable (win rate)
 * @returns {Object} Regression results
 */
function performMultivariateRegression(data) {
    const { X, y } = data;
    
    // Check for valid input
    if (!X || !y || X.length === 0 || y.length === 0 || X.length !== y.length) {
        throw new Error('Invalid input data for regression analysis');
    }
    
    try {
        // Calculate regression statistics
        const result = {
            coefficients: [],
            rSquared: 0,
            adjustedRSquared: 0,
            standardError: 0,
            tStats: [],
            pValues: [],
            confidenceIntervals: []
        };
        
        // Prepare design matrix (add column of 1s for intercept)
        const designMatrix = X.map(row => [1, ...row]);
        
        // Calculate coefficients using normal equation: β = (X'X)^(-1)X'y
        const Xt = jStat.transpose(designMatrix);
        const XtX = jStat.multiply(Xt, designMatrix);
        const XtX_inv = jStat.inv(XtX);
        const Xty = jStat.multiply(Xt, y);
        const coefficients = jStat.multiply(XtX_inv, Xty);
        
        // Calculate predicted values
        const predictions = designMatrix.map(row => {
            return jStat.multiply([row], [coefficients])[0];
        });
        
        // Calculate sum of squares
        const yMean = jStat.mean(y);
        const SST = jStat.sum(y.map(val => Math.pow(val - yMean, 2))); // Total sum of squares
        const SSR = jStat.sum(predictions.map((pred, i) => Math.pow(pred - yMean, 2))); // Regression sum of squares
        const SSE = jStat.sum(predictions.map((pred, i) => Math.pow(y[i] - pred, 2))); // Error sum of squares
        
        // Calculate R-squared
        const rSquared = SSR / SST;
        
        // Calculate adjusted R-squared
        const n = y.length;
        const p = X[0].length; // Number of predictors (excluding intercept)
        const adjustedRSquared = 1 - ((1 - rSquared) * (n - 1) / (n - p - 1));
        
        // Calculate standard error of regression
        const standardError = Math.sqrt(SSE / (n - p - 1));
        
        // Calculate standard errors of coefficients
        const diagonalElements = jStat.diag(XtX_inv);
        const coefficientStdErrors = diagonalElements.map(val => Math.sqrt(val * standardError * standardError));
        
        // Calculate t-statistics
        const tStats = coefficients.map((coef, i) => coef / coefficientStdErrors[i]);
        
        // Calculate p-values
        const pValues = tStats.map(t => {
            // Two-tailed t-test
            const df = n - p - 1; // Degrees of freedom
            return 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
        });
        
        // Calculate 95% confidence intervals
        const tCritical = jStat.studentt.inv(0.975, n - p - 1);
        const confidenceIntervals = coefficients.map((coef, i) => {
            const margin = tCritical * coefficientStdErrors[i];
            return [coef - margin, coef + margin];
        });
        
        // Populate result
        result.coefficients = coefficients;
        result.rSquared = rSquared;
        result.adjustedRSquared = adjustedRSquared;
        result.standardError = standardError;
        result.tStats = tStats;
        result.pValues = pValues;
        result.confidenceIntervals = confidenceIntervals;
        result.predictions = predictions;
        
        return result;
    } catch (error) {
        throw new Error(`Regression calculation error: ${error.message}`);
    }
}

/**
 * Calculate regression coefficients
 * @param {Object} data - Data for coefficient calculation
 * @returns {Object} Calculated coefficients with metadata
 */
function calculateRegressionCoefficients(data) {
    const { X, y, variableNames } = data;
    
    // Get basic regression results
    const regression = performMultivariateRegression({ X, y });
    
    // Format coefficients with variable names
    const coefficientsWithNames = regression.coefficients.map((coef, i) => {
        const name = i === 0 ? 'Intercept' : variableNames[i - 1];
        return {
            name,
            coefficient: coef,
            standardError: regression.coefficientStdErrors ? regression.coefficientStdErrors[i] : null,
            tStat: regression.tStats[i],
            pValue: regression.pValues[i],
            confidenceInterval: regression.confidenceIntervals[i],
            isSignificant: regression.pValues[i] < 0.05
        };
    });
    
    return {
        coefficients: coefficientsWithNames,
        rSquared: regression.rSquared,
        adjustedRSquared: regression.adjustedRSquared,
        standardError: regression.standardError
    };
}

/**
 * Calculate confidence intervals for regression coefficients
 * @param {Object} data - Data for confidence interval calculation
 * @returns {Array} Confidence intervals for each coefficient
 */
function calculateConfidenceIntervals(data) {
    const { coefficients, standardErrors, sampleSize, numPredictors, confidenceLevel = 0.95 } = data;
    
    const df = sampleSize - numPredictors - 1; // Degrees of freedom
    const alpha = 1 - confidenceLevel;
    const tCritical = jStat.studentt.inv(1 - alpha/2, df);
    
    return coefficients.map((coef, i) => {
        const margin = tCritical * standardErrors[i];
        return {
            lower: coef - margin,
            upper: coef + margin,
            coefficient: coef,
            margin
        };
    });
}

/**
 * Calculate statistical significance metrics
 * @param {Object} data - Data for significance calculation
 * @returns {Object} Significance metrics
 */
function calculateStatisticalSignificance(data) {
    const { regression, sampleSize } = data;
    
    // Calculate F-statistic
    const p = regression.coefficients.length - 1; // Number of predictors (excluding intercept)
    const df1 = p;
    const df2 = sampleSize - p - 1;
    
    const fStat = (regression.rSquared / df1) / ((1 - regression.rSquared) / df2);
    const fPValue = 1 - jStat.centralF.cdf(fStat, df1, df2);
    
    // Calculate Akaike Information Criterion (AIC)
    const aic = sampleSize * Math.log(regression.standardError * regression.standardError) + 2 * (p + 1);
    
    // Calculate Bayesian Information Criterion (BIC)
    const bic = sampleSize * Math.log(regression.standardError * regression.standardError) + Math.log(sampleSize) * (p + 1);
    
    return {
        fStat,
        fPValue,
        aic,
        bic,
        isModelSignificant: fPValue < 0.05
    };
}
