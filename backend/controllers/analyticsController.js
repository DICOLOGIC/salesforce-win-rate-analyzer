/**
 * Analytics Controller
 * Handles request/response for analytics operations
 */

const { performMultivariateRegression, performDimensionClustering: clusterDimensions, generateWinRateLookupTable } = require('../services/analyticService');
const { buildPredictionModel, predictWinRate, batchPredictWinRates, generateWinRateFormula } = require('../services/predictionService');
const { createConnection, fetchOpportunities } = require('../services/salesforceService');

// Simple in-memory cache
const cache = {
  models: {},
  regressionResults: {},
  lookupTables: {},
  clearCache: function() {
    this.models = {};
    this.regressionResults = {};
    this.lookupTables = {};
  }
};

/**
 * Analyzes the impact of dimensions on win rates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const analyzeDimensionImpact = async (req, res) => {
  try {
    const { dimensions, filters, cacheKey } = req.body;
    
    // Validate required parameters
    if (!dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Please provide an array of dimensions to analyze'
      });
    }
    
    // Check cache if cacheKey provided
    if (cacheKey && cache.regressionResults[cacheKey]) {
      return res.json({
        success: true,
        data: cache.regressionResults[cacheKey],
        fromCache: true
      });
    }
    
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Construct where clause from filters
    let whereClause = '';
    if (filters && Object.keys(filters).length > 0) {
      whereClause = Object.entries(filters)
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field} IN ('${value.join("','")}')`;
          } else {
            return `${field} = '${value}'`;
          }
        })
        .join(' AND ');
    }
    
    // Add IsClosed filter to only analyze closed opportunities
    whereClause = whereClause 
      ? `${whereClause} AND IsClosed = true` 
      : 'IsClosed = true';
    
    // Fetch opportunities
    const opportunities = await fetchOpportunities(conn, {
      fields: ['Id', 'IsWon', ...dimensions],
      whereClause,
      limit: 5000
    });
    
    // Check if we have enough data
    if (opportunities.length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data',
        message: 'Not enough closed opportunities to perform analysis'
      });
    }
    
    // Perform regression analysis
    const regressionResults = performMultivariateRegression(
      opportunities,
      dimensions,
      'IsWon'
    );
    
    // Cache results if cacheKey provided
    if (cacheKey) {
      cache.regressionResults[cacheKey] = regressionResults;
    }
    
    res.json({
      success: true,
      data: regressionResults,
      opportunityCount: opportunities.length,
      fromCache: false
    });
  } catch (error) {
    console.error('Error in analyzeDimensionImpact:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Performs dimension clustering analysis
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const performDimensionClustering = async (req, res) => {
  try {
    const { dimensions, filters, k, cacheKey } = req.body;
    
    // Validate required parameters
    if (!dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Please provide an array of dimensions for clustering'
      });
    }
    
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Construct where clause from filters
    let whereClause = '';
    if (filters && Object.keys(filters).length > 0) {
      whereClause = Object.entries(filters)
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field} IN ('${value.join("','")}')`;
          } else {
            return `${field} = '${value}'`;
          }
        })
        .join(' AND ');
    }
    
    // Fetch opportunities
    const opportunities = await fetchOpportunities(conn, {
      fields: ['Id', 'IsWon', ...dimensions],
      whereClause,
      limit: 5000
    });
    
    // Perform clustering analysis
    const clusteringResults = performDimensionClustering(
      opportunities,
      dimensions,
      k || 3
    );
    
    res.json({
      success: true,
      data: clusteringResults,
      opportunityCount: opportunities.length
    });
  } catch (error) {
    console.error('Error in performDimensionClustering:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Builds a win rate prediction model
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const buildPredictionModel = async (req, res) => {
  try {
    const { dimensions, filters, modelId } = req.body;
    
    // Validate required parameters
    if (!dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Please provide an array of dimensions for the prediction model'
      });
    }
    
    // Validate model ID
    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Please provide a model ID for caching'
      });
    }
    
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Construct where clause from filters
    let whereClause = '';
    if (filters && Object.keys(filters).length > 0) {
      whereClause = Object.entries(filters)
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field} IN ('${value.join("','")}')`;
          } else {
            return `${field} = '${value}'`;
          }
        })
        .join(' AND ');
    }
    
    // Add IsClosed filter to only use closed opportunities for training
    whereClause = whereClause 
      ? `${whereClause} AND IsClosed = true` 
      : 'IsClosed = true';
    
    // Fetch opportunities
    const opportunities = await fetchOpportunities(conn, {
      fields: ['Id', 'IsWon', ...dimensions],
      whereClause,
      limit: 10000
    });
    
    // Check if we have enough data
    if (opportunities.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data',
        message: 'Not enough closed opportunities to build a prediction model'
      });
    }
    
    // Build prediction model
    const modelResults = buildPredictionModel(
      opportunities,
      dimensions,
      'IsWon'
    );
    
    // Cache the model
    cache.models[modelId] = modelResults.model;
    
    res.json({
      success: true,
      modelId,
      data: {
        metrics: modelResults.metrics,
        featureImportance: modelResults.featureImportance,
        formula: modelResults.formula,
        training: modelResults.training
      },
      opportunityCount: opportunities.length
    });
  } catch (error) {
    console.error('Error in buildPredictionModel:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Predicts win rate for a single opportunity
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const predictWinRate = async (req, res) => {
  try {
    const { opportunity, modelId } = req.body;
    
    // Validate required parameters
    if (!opportunity) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Please provide opportunity data for prediction'
      });
    }
    
    if (!modelId || !cache.models[modelId]) {
      return res.status(400).json({
        success: false,
        error: 'Model not found',
        message: 'Please build or select a valid prediction model'
      });
    }
    
    // Get the model from cache
    const model = cache.models[modelId];
    
    // Predict win rate
    const prediction = predictWinRate(opportunity, model);
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Error in predictWinRate:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Batch predicts win rates for multiple opportunities
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const batchPredictWinRates = async (req, res) => {
  try {
    const { filters, modelId, fetchOpportunities: shouldFetch } = req.body;
    
    // Validate required parameters
    if (!modelId || !cache.models[modelId]) {
      return res.status(400).json({
        success: false,
        error: 'Model not found',
        message: 'Please build or select a valid prediction model'
      });
    }
    
    // Get the model from cache
    const model = cache.models[modelId];
    
    let opportunities = [];
    
    if (shouldFetch) {
      // Get Salesforce connection from cookies
      const credentials = {
        accessToken: req.cookies.sf_access_token,
        instanceUrl: req.cookies.sf_instance_url
      };
      
      const conn = createConnection(credentials);
      
      // Construct where clause from filters
      let whereClause = '';
      if (filters && Object.keys(filters).length > 0) {
        whereClause = Object.entries(filters)
          .map(([field, value]) => {
            if (Array.isArray(value)) {
              return `${field} IN ('${value.join("','")}')`;
            } else {
              return `${field} = '${value}'`;
            }
          })
          .join(' AND ');
      }
      
      // Add IsClosed = false to only predict for open opportunities
      whereClause = whereClause 
        ? `${whereClause} AND IsClosed = false` 
        : 'IsClosed = false';
      
      // Fetch opportunities
      opportunities = await fetchOpportunities(conn, {
        fields: ['Id', 'Name', ...model.dimensions],
        whereClause,
        limit: 1000
      });
    } else {
      // Use provided opportunities
      opportunities = req.body.opportunities || [];
    }
    
    // Check if we have opportunities
    if (opportunities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No opportunities',
        message: 'No opportunities found for prediction'
      });
    }
    
    // Batch predict win rates
    const predictions = batchPredictWinRates(opportunities, model);
    
    res.json({
      success: true,
      data: predictions,
      opportunityCount: opportunities.length
    });
  } catch (error) {
    console.error('Error in batchPredictWinRates:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Generates a win rate formula
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateWinRateFormula = async (req, res) => {
  try {
    const { modelId, simplified } = req.body;
    
    // Validate required parameters
    if (!modelId || !cache.models[modelId]) {
      return res.status(400).json({
        success: false,
        error: 'Model not found',
        message: 'Please build or select a valid prediction model'
      });
    }
    
    // Get the model from cache
    const model = cache.models[modelId];
    
    // Generate formula
    const formula = generateWinRateFormula(model, simplified !== false);
    
    res.json({
      success: true,
      data: formula
    });
  } catch (error) {
    console.error('Error in generateWinRateFormula:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Simulates a win rate formula with different values
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const simulateWinRateFormula = async (req, res) => {
  try {
    const { modelId, values } = req.body;
    
    // Validate required parameters
    if (!modelId || !cache.models[modelId]) {
      return res.status(400).json({
        success: false,
        error: 'Model not found',
        message: 'Please build or select a valid prediction model'
      });
    }
    
    if (!values || typeof values !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Please provide values for simulation'
      });
    }
    
    // Get the model from cache
    const model = cache.models[modelId];
    
    // Create a simulated opportunity with the provided values
    const simulatedOpportunity = { ...values };
    
    // Predict win rate
    const prediction = predictWinRate(simulatedOpportunity, model);
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('Error in simulateWinRateFormula:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Generates a win rate lookup table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const generateWinRateLookupTable = async (req, res) => {
  try {
    const { dimensions, filters, maxCombinations, cacheKey } = req.body;
    
    // Validate required parameters
    if (!dimensions || !Array.isArray(dimensions) || dimensions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Please provide an array of dimensions for the lookup table'
      });
    }
    
    // Check cache if cacheKey provided
    if (cacheKey && cache.lookupTables[cacheKey]) {
      return res.json({
        success: true,
        data: cache.lookupTables[cacheKey],
        fromCache: true
      });
    }
    
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Construct where clause from filters
    let whereClause = '';
    if (filters && Object.keys(filters).length > 0) {
      whereClause = Object.entries(filters)
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field} IN ('${value.join("','")}')`;
          } else {
            return `${field} = '${value}'`;
          }
        })
        .join(' AND ');
    }
    
    // Add IsClosed filter to only use closed opportunities
    whereClause = whereClause 
      ? `${whereClause} AND IsClosed = true` 
      : 'IsClosed = true';
    
    // Fetch opportunities
    const opportunities = await fetchOpportunities(conn, {
      fields: ['Id', 'IsWon', ...dimensions],
      whereClause,
      limit: 10000
    });
    
    // Generate lookup table
    const lookupTable = generateWinRateLookupTable(
      opportunities,
      dimensions,
      maxCombinations || 1000
    );
    
    // Cache results if cacheKey provided
    if (cacheKey) {
      cache.lookupTables[cacheKey] = lookupTable;
    }
    
    res.json({
      success: true,
      data: lookupTable,
      opportunityCount: opportunities.length,
      fromCache: false
    });
  } catch (error) {
    console.error('Error in generateWinRateLookupTable:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Clears the analytics cache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const clearAnalyticsCache = (req, res) => {
  try {
    cache.clearCache();
    
    res.json({
      success: true,
      message: 'Analytics cache cleared successfully'
    });
  } catch (error) {
    console.error('Error in clearAnalyticsCache:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = {
  analyzeDimensionImpact,
  performDimensionClustering,
  buildPredictionModel,
  predictWinRate,
  batchPredictWinRates,
  generateWinRateFormula,
  simulateWinRateFormula,
  generateWinRateLookupTable,
  clearAnalyticsCache
};
