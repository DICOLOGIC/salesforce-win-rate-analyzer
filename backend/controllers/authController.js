/**
 * Authentication Controller
 * Handles Salesforce OAuth authentication
 */

const jsforce = require('jsforce');

// Load configuration
const config = require('../config/config');

/**
 * Redirects to Salesforce login page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const loginRedirect = (req, res) => {
  try {
    // Create OAuth2 configuration
    const oauth2 = new jsforce.OAuth2({
      clientId: config.salesforce.clientId,
      clientSecret: config.salesforce.clientSecret,
      redirectUri: config.salesforce.redirectUri
    });
    
    // Redirect to authorization page
    res.redirect(oauth2.getAuthorizationUrl({ scope: 'api web' }));
  } catch (error) {
    console.error('Error in loginRedirect:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Handles OAuth callback from Salesforce
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Invalid callback',
        message: 'Authorization code is missing'
      });
    }
    
    // Create OAuth2 configuration
    const oauth2 = new jsforce.OAuth2({
      clientId: config.salesforce.clientId,
      clientSecret: config.salesforce.clientSecret,
      redirectUri: config.salesforce.redirectUri
    });
    
    // Create connection
    const conn = new jsforce.Connection({ oauth2 });
    
    // Request access token
    const response = await conn.authorize(code);
    
    // Set cookies for later use
    res.cookie('sf_access_token', conn.accessToken, {
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.cookie('sf_instance_url', conn.instanceUrl, {
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    res.cookie('sf_user_id', response.id, {
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    // Redirect to the application
    res.redirect('/');
  } catch (error) {
    console.error('Error in handleCallback:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message
    });
  }
};

/**
 * Checks if user is authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkAuth = (req, res) => {
  try {
    const isAuthenticated = !!(req.cookies && req.cookies.sf_access_token);
    
    res.json({
      success: true,
      isAuthenticated,
      userData: isAuthenticated ? {
        instanceUrl: req.cookies.sf_instance_url,
        userId: req.cookies.sf_user_id
      } : null
    });
  } catch (error) {
    console.error('Error in checkAuth:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Logs out the user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = (req, res) => {
  try {
    // Clear authentication cookies
    res.clearCookie('sf_access_token');
    res.clearCookie('sf_instance_url');
    res.clearCookie('sf_user_id');
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Error in logout:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = {
  loginRedirect,
  handleCallback,
  checkAuth,
  logout
};