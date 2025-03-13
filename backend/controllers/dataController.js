/**
 * Data Controller
 * Handles data-related requests
 */

const { 
  createConnection,
  fetchOpportunities,
  fetchOpportunityFields,
  updateOpportunityProbabilities,
  fetchOpportunityHistory,
  fetchUsers
} = require('../services/salesforceService');

/**
 * Fetches opportunities from Salesforce
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const fetchOpportunitiesHandler = async (req, res) => {
  try {
    const { 
      whereClause, 
      limit, 
      fields, 
      orderBy, 
      includeCustomFields 
    } = req.query;
    
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Fetch opportunities
    const opportunities = await fetchOpportunities(conn, {
      whereClause,
      limit: limit ? parseInt(limit, 10) : undefined,
      fields: fields ? fields.split(',') : undefined,
      orderBy,
      includeCustomFields: includeCustomFields === 'true'
    });
    
    res.json({
      success: true,
      data: opportunities,
      count: opportunities.length
    });
  } catch (error) {
    console.error('Error in fetchOpportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Fetches opportunity fields metadata from Salesforce
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const fetchOpportunityFieldsHandler = async (req, res) => {
  try {
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Fetch opportunity fields
    const fields = await fetchOpportunityFields(conn);
    
    // Group fields by type
    const groupedFields = fields.reduce((acc, field) => {
      const type = field.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(field);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        fields,
        groupedFields
      }
    });
  } catch (error) {
    console.error('Error in fetchOpportunityFields:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Fetches opportunity history data from Salesforce
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const fetchOpportunityHistoryHandler = async (req, res) => {
  try {
    const { opportunityIds, fields, limit } = req.query;
    
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Parse opportunity IDs if provided
    const parsedOpportunityIds = opportunityIds 
      ? opportunityIds.split(',') 
      : [];
    
    // Parse fields if provided
    const parsedFields = fields 
      ? fields.split(',') 
      : undefined;
    
    // Fetch opportunity history
    const history = await fetchOpportunityHistory(conn, {
      opportunityIds: parsedOpportunityIds,
      fields: parsedFields,
      limit: limit ? parseInt(limit, 10) : undefined
    });
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error in fetchOpportunityHistory:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Fetches users from Salesforce
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const fetchUsersHandler = async (req, res) => {
  try {
    const { userIds } = req.query;
    
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Parse user IDs if provided
    const parsedUserIds = userIds 
      ? userIds.split(',') 
      : [];
    
    // Fetch users
    const users = await fetchUsers(conn, parsedUserIds);
    
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error in fetchUsers:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Updates opportunity probabilities in Salesforce
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateOpportunityProbabilitiesHandler = async (req, res) => {
  try {
    const { updates, probabilityField } = req.body;
    
    // Validate required parameters
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Please provide an array of opportunity probability updates'
      });
    }
    
    // Get Salesforce connection from cookies
    const credentials = {
      accessToken: req.cookies.sf_access_token,
      instanceUrl: req.cookies.sf_instance_url
    };
    
    const conn = createConnection(credentials);
    
    // Update opportunity probabilities
    const results = await updateOpportunityProbabilities(
      conn,
      updates,
      probabilityField
    );
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error in updateOpportunityProbabilities:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = {
  fetchOpportunities: fetchOpportunitiesHandler,
  fetchOpportunityFields: fetchOpportunityFieldsHandler,
  fetchOpportunityHistory: fetchOpportunityHistoryHandler,
  fetchUsers: fetchUsersHandler,
  updateOpportunityProbabilities: updateOpportunityProbabilitiesHandler
};