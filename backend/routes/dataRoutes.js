/**
 * Data Routes
 * Routes for data retrieval and manipulation
 */

const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');

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

// Opportunity data routes
router.get('/opportunities', checkAuth, dataController.fetchOpportunities);
router.get('/opportunity-fields', checkAuth, dataController.fetchOpportunityFields);
router.get('/opportunity-history', checkAuth, dataController.fetchOpportunityHistory);

// User data routes
router.get('/users', checkAuth, dataController.fetchUsers);

// Data update routes
router.post('/update-probabilities', checkAuth, dataController.updateOpportunityProbabilities);

module.exports = router;