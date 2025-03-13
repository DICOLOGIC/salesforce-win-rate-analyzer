/**
 * Authentication Routes
 * Routes for Salesforce authentication
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Authentication routes
router.get('/login', authController.loginRedirect);
router.get('/callback', authController.handleCallback);
router.get('/check', authController.checkAuth);
router.get('/logout', authController.logout);

module.exports = router;