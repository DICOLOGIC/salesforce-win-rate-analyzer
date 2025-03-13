/**
 * Analytics Routes
 * Routes for analytics-related functionality
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Middleware to check authentication
const checkAuth = (req, res, next) => {
  if (!req.cookies || !req.cookies.sf_access_token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please authenticate with Salesforce to access this resource'
    });
  }
  next();
};

// Dimension impact analysis routes
router.post('/dimension-impact', checkAuth, analyticsController.analyzeDimensionImpact);
router.post('/dimension-clustering', checkAuth, analyticsController.performDimensionClustering);

// Win rate prediction routes
router.post('/build-prediction-model', checkAuth, analyticsController.buildPredictionModel);
router.post('/predict-win-rate', checkAuth, analyticsController.predictWinRate);
router.post('/batch-predict', checkAuth, analyticsController.batchPredictWinRates);

// Win rate formula routes
router.post('/generate-formula', checkAuth, analyticsController.generateWinRateFormula);
router.post('/simulate-formula', checkAuth, analyticsController.simulateWinRateFormula);

// Lookup table routes
router.post('/generate-lookup-table', checkAuth, analyticsController.generateWinRateLookupTable);

// Cache management routes
router.post('/clear-cache', checkAuth, analyticsController.clearAnalyticsCache);

module.exports = router;