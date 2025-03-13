/**
 * Prediction Service
 * Provides predictive modeling functionality for win rate prediction
 */

const math = require('mathjs');
const { preprocessData, encodeCategories } = require('../utils/dataProcessingUtils');

/**
 * Builds a logistic regression model for win prediction
 * @param {Array} opportunities - Training data (opportunities)
 * @param {Array} dimensions - Dimensions to use as features
 * @param {String} targetVariable - Target variable (usually 'IsWon')
 * @returns {Object} Trained model and metrics
 */
const buildPredictionModel = (opportunities, dimensions, targetVariable = 'IsWon') => {
  try {
    // Preprocess and prepare data
    const preprocessedData = preprocessData(opportunities, dimensions, targetVariable);
    const X = preprocessedData.X;
    const y = preprocessedData.y;
    const encodingInfo = preprocessedData.encodingInfo;
    
    // Split data into training (80%) and validation (20%) sets
    const trainSize = Math.floor(X.length * 0.8);
    const indices = Array.from({ length: X.length }, (_, i) => i);
    const shuffledIndices = indices.sort(() => Math.random() - 0.5);
    
    const trainIndices = shuffledIndices.slice(0, trainSize);
    const validIndices = shuffledIndices.slice(trainSize);
    
    const X_train = trainIndices.map(i => X[i]);
    const y_train = trainIndices.map(i => y[i]);
    const X_valid = validIndices.map(i => X[i]);
    const y_valid = validIndices.map(i => y[i]);
    
    // Initialize model parameters (coefficients)
    let coefficients = Array(X_train[0].length + 1).fill(0); // +1 for intercept
    
    // Sigmoid function
    const sigmoid = z => 1 / (1 + Math.exp(-z));
    
    // Predict probability using logistic regression
    const predict = (features) => {
      const Xwith1 = [1, ...features]; // Add intercept
      const z = math.dot(coefficients, Xwith1);
      return sigmoid(z);
    };
    
    // Cost function (negative log likelihood)
    const computeCost = (X, y, coef) => {
      let cost = 0;
      for (let i = 0; i < X.length; i++) {
        const Xwith1 = [1, ...X[i]]; // Add intercept
        const z = math.dot(coef, Xwith1);
        const h = sigmoid(z);
        cost += -y[i] * Math.log(h) - (1 - y[i]) * Math.log(1 - h + 1e-10);
      }
      return cost / X.length;
    };
    
    // Gradient descent
    const LEARNING_RATE = 0.1;
    const MAX_ITERATIONS = 500;
    const CONVERGENCE_THRESHOLD = 0.0001;
    
    let prevCost = Infinity;
    let iteration = 0;
    let costs = [];
    
    while (iteration < MAX_ITERATIONS) {
      // Initialize gradients
      const gradients = Array(coefficients.length).fill(0);
      
      // Calculate gradients
      for (let i = 0; i < X_train.length; i++) {
        const Xwith1 = [1, ...X_train[i]]; // Add intercept
        const predicted = predict(X_train[i]);
        const error = predicted - y_train[i];
        
        // Update each gradient component
        for (let j = 0; j < gradients.length; j++) {
          gradients[j] += error * Xwith1[j];
        }
      }
      
      // Normalize gradients
      for (let j = 0; j < gradients.length; j++) {
        gradients[j] /= X_train.length;
      }
      
      // Update coefficients using gradients
      for (let j = 0; j < coefficients.length; j++) {
        coefficients[j] -= LEARNING_RATE * gradients[j];
      }
      
      // Calculate cost and check convergence
      const currentCost = computeCost(X_train, y_train, coefficients);
      costs.push(currentCost);
      
      if (Math.abs(prevCost - currentCost) < CONVERGENCE_THRESHOLD) {
        break;
      }
      
      prevCost = currentCost;
      iteration++;
    }
    
    // Calculate feature importance
    const featureImportance = dimensions.map((dimension, index) => {
      return {
        feature: dimension,
        coefficient: coefficients[index + 1], // Skip intercept
        absoluteImportance: Math.abs(coefficients[index + 1]),
        normalizedImportance: 0 // Will be calculated below
      };
    });
    
    // Normalize feature importance
    const totalImportance = featureImportance.reduce(
      (sum, feature) => sum + feature.absoluteImportance, 0
    );
    
    featureImportance.forEach(feature => {
      feature.normalizedImportance = totalImportance > 0 
        ? feature.absoluteImportance / totalImportance
        : 0;
    });
    
    // Sort by importance
    featureImportance.sort((a, b) => b.absoluteImportance - a.absoluteImportance);
    
    // Evaluate model on validation set
    const validateModel = () => {
      let truePositives = 0;
      let trueNegatives = 0;
      let falsePositives = 0;
      let falseNegatives = 0;
      
      for (let i = 0; i < X_valid.length; i++) {
        const probability = predict(X_valid[i]);
        const predicted = probability >= 0.5 ? 1 : 0;
        const actual = y_valid[i];
        
        if (predicted === 1 && actual === 1) truePositives++;
        if (predicted === 0 && actual === 0) trueNegatives++;
        if (predicted === 1 && actual === 0) falsePositives++;
        if (predicted === 0 && actual === 1) falseNegatives++;
      }
      
      const accuracy = (truePositives + trueNegatives) / X_valid.length;
      const precision = truePositives / (truePositives + falsePositives) || 0;
      const recall = truePositives / (truePositives + falseNegatives) || 0;
      const f1Score = 2 * precision * recall / (precision + recall) || 0;
      
      return {
        accuracy,
        precision,
        recall,
        f1Score,
        confusionMatrix: {
          truePositives,
          trueNegatives,
          falsePositives,
          falseNegatives
        }
      };
    };
    
    // Generate simplified formula
    const generateFormula = () => {
      let formula = `Win Probability = 1 / (1 + e^-(${coefficients[0].toFixed(3)}`;
      
      dimensions.forEach((dim, index) => {
        const coef = coefficients[index + 1];
        if (coef !== 0) {
          formula += ` ${coef > 0 ? '+' : '-'} ${Math.abs(coef).toFixed(3)} × ${dim}`;
        }
      });
      
      formula += '))';
      
      return formula;
    };
    
    // Model performance metrics
    const validationMetrics = validateModel();
    
    // Return the model and metrics
    return {
      model: {
        coefficients,
        intercept: coefficients[0],
        featureCoefficients: coefficients.slice(1),
        dimensions,
        encodingInfo,
        predict: (features) => {
          // Encode categorical features
          const encodedFeatures = dimensions.map((dim, i) => {
            const value = features[dim];
            if (encodingInfo[dim]) {
              return encodingInfo[dim][value] || 0;
            }
            return value;
          });
          
          return predict(encodedFeatures);
        }
      },
      metrics: validationMetrics,
      featureImportance,
      formula: generateFormula(),
      training: {
        iterations: iteration,
        convergence: iteration < MAX_ITERATIONS,
        costHistory: costs,
        finalCost: costs[costs.length - 1]
      }
    };
  } catch (error) {
    console.error('Error building prediction model:', error);
    throw new Error(`Failed to build prediction model: ${error.message}`);
  }
};

/**
 * Predicts win probability for a single opportunity
 * @param {Object} opportunity - Opportunity data
 * @param {Object} model - Trained prediction model
 * @returns {Object} Prediction results
 */
const predictWinRate = (opportunity, model) => {
  try {
    // Extract features needed by the model
    const opportunityFeatures = {};
    model.dimensions.forEach(dim => {
      opportunityFeatures[dim] = opportunity[dim];
    });
    
    // Make prediction
    const probability = model.predict(opportunityFeatures);
    
    // Get feature contributions
    const contributions = [];
    model.dimensions.forEach((dim, index) => {
      const coefficient = model.coefficients[index + 1]; // Skip intercept
      const value = opportunityFeatures[dim];
      
      // Encode value if necessary
      let encodedValue = value;
      if (model.encodingInfo && model.encodingInfo[dim]) {
        encodedValue = model.encodingInfo[dim][value] || 0;
      }
      
      // Calculate contribution
      const contribution = coefficient * encodedValue;
      
      contributions.push({
        dimension: dim,
        coefficient,
        value,
        encodedValue,
        contribution,
        absoluteContribution: Math.abs(contribution)
      });
    });
    
    // Sort by absolute contribution
    contributions.sort((a, b) => b.absoluteContribution - a.absoluteContribution);
    
    // Calculate prediction category
    let category = 'Medium';
    if (probability >= 0.75) category = 'High';
    if (probability < 0.25) category = 'Low';
    
    return {
      opportunity: opportunity.Id || 'New Opportunity',
      probability,
      winProbabilityPercent: (probability * 100).toFixed(2),
      category,
      contributions,
      baselineContribution: model.intercept,
      topPositiveFactors: contributions
        .filter(c => c.contribution > 0)
        .slice(0, 3),
      topNegativeFactors: contributions
        .filter(c => c.contribution < 0)
        .slice(0, 3)
    };
  } catch (error) {
    console.error('Error predicting win rate:', error);
    throw new Error(`Failed to predict win rate: ${error.message}`);
  }
};

/**
 * Batch predicts win probabilities for multiple opportunities
 * @param {Array} opportunities - Array of opportunities
 * @param {Object} model - Trained prediction model
 * @returns {Array} Array of prediction results
 */
const batchPredictWinRates = (opportunities, model) => {
  try {
    const predictions = opportunities.map(opportunity => 
      predictWinRate(opportunity, model)
    );
    
    return {
      predictions,
      summary: {
        totalOpportunities: predictions.length,
        highProbabilityCount: predictions.filter(p => p.category === 'High').length,
        mediumProbabilityCount: predictions.filter(p => p.category === 'Medium').length,
        lowProbabilityCount: predictions.filter(p => p.category === 'Low').length,
        averageProbability: math.mean(predictions.map(p => p.probability))
      }
    };
  } catch (error) {
    console.error('Error in batch prediction:', error);
    throw new Error(`Failed to batch predict win rates: ${error.message}`);
  }
};

/**
 * Generates a simplified win rate formula from the model
 * @param {Object} model - Trained prediction model
 * @param {Boolean} simplified - Whether to simplify the formula
 * @returns {Object} Formula information
 */
const generateWinRateFormula = (model, simplified = true) => {
  try {
    // Sort features by importance
    const featuresByImportance = [...model.dimensions]
      .map((dim, i) => ({
        dimension: dim,
        coefficient: model.coefficients[i + 1],
        absoluteCoefficient: Math.abs(model.coefficients[i + 1])
      }))
      .sort((a, b) => b.absoluteCoefficient - a.absoluteCoefficient);
    
    // Determine how many features to include in the simplified formula
    const featuresToInclude = simplified
      ? featuresByImportance.slice(0, Math.min(5, featuresByImportance.length))
      : featuresByImportance;
    
    // Generate the mathematical formula
    let formula = `P(win) = 1 / (1 + e^-z)`;
    let zFormula = `z = ${model.intercept.toFixed(3)}`;
    
    featuresToInclude.forEach(feature => {
      const sign = feature.coefficient > 0 ? '+' : '';
      zFormula += ` ${sign}${feature.coefficient.toFixed(3)} × ${feature.dimension}`;
    });
    
    // If simplified, indicate that some terms are omitted
    if (simplified && featuresByImportance.length > featuresToInclude.length) {
      zFormula += ' + ...';
    }
    
    // Generate a narrative explanation
    let explanation = `This formula estimates the probability of winning an opportunity based on ${featuresToInclude.length} key factors.`;
    
    if (featuresToInclude.length > 0) {
      explanation += ` The most influential factors are: ${
        featuresToInclude
          .slice(0, 3)
          .map(f => f.dimension)
          .join(', ')
      }.`;
    }
    
    // Add explanation of how to interpret coefficients
    explanation += ` Positive coefficients increase win probability, while negative coefficients decrease it. `;
    explanation += `The magnitude of each coefficient indicates how strongly that factor affects the outcome.`;
    
    return {
      formula,
      zFormula,
      explanation,
      intercept: model.intercept,
      featuresIncluded: featuresToInclude,
      featuresOmitted: simplified 
        ? featuresByImportance.slice(featuresToInclude.length)
        : [],
      isSimplified: simplified
    };
  } catch (error) {
    console.error('Error generating win rate formula:', error);
    throw new Error(`Failed to generate win rate formula: ${error.message}`);
  }
};

module.exports = {
  buildPredictionModel,
  predictWinRate,
  batchPredictWinRates,
  generateWinRateFormula
};