/**
 * Salesforce Service
 * Handles interaction with the Salesforce API
 */

const jsforce = require('jsforce');
const { prepareOpportunityData } = require('../utils/dataProcessingUtils');

/**
 * Creates a new Salesforce connection
 * @param {Object} credentials - Salesforce credentials
 * @returns {Object} jsforce connection
 */
const createConnection = (credentials) => {
  try {
    const { instanceUrl, accessToken } = credentials;
    
    if (!instanceUrl || !accessToken) {
      throw new Error('Invalid Salesforce credentials. Missing instanceUrl or accessToken.');
    }
    
    const conn = new jsforce.Connection({
      instanceUrl,
      accessToken
    });
    
    return conn;
  } catch (error) {
    console.error('Error creating Salesforce connection:', error);
    throw new Error(`Failed to create Salesforce connection: ${error.message}`);
  }
};

/**
 * Fetches opportunities from Salesforce
 * @param {Object} conn - jsforce connection
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of opportunities
 */
const fetchOpportunities = async (conn, options = {}) => {
  try {
    const {
      fields = ['Id', 'Name', 'AccountId', 'OwnerId', 'Amount', 'StageName', 
                'CloseDate', 'Probability', 'Type', 'IsWon', 'IsClosed', 'CreatedDate'],
      whereClause = '',
      limit = 5000,
      orderBy = 'CreatedDate DESC',
      includeCustomFields = true
    } = options;
    
    // Fetch all fields including custom fields if requested
    let allFields = [...fields];
    
    if (includeCustomFields) {
      try {
        // Describe opportunity object to get all field names
        const metadata = await conn.describe('Opportunity');
        const customFields = metadata.fields
          .filter(field => field.custom)
          .map(field => field.name);
        
        allFields = [...new Set([...allFields, ...customFields])];
      } catch (error) {
        console.warn('Could not fetch custom fields:', error.message);
        // Continue with standard fields only
      }
    }
    
    // Construct SOQL query
    let soql = `SELECT ${allFields.join(', ')} FROM Opportunity`;
    
    if (whereClause) {
      soql += ` WHERE ${whereClause}`;
    }
    
    if (orderBy) {
      soql += ` ORDER BY ${orderBy}`;
    }
    
    if (limit) {
      soql += ` LIMIT ${limit}`;
    }
    
    // Execute query
    const result = await conn.query(soql);
    
    // Prepare data for analysis
    const opportunities = prepareOpportunityData(result.records, allFields);
    
    return opportunities;
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    throw new Error(`Failed to fetch opportunities: ${error.message}`);
  }
};

/**
 * Fetches opportunity fields metadata from Salesforce
 * @param {Object} conn - jsforce connection
 * @returns {Promise<Array>} Array of field metadata
 */
const fetchOpportunityFields = async (conn) => {
  try {
    // Describe opportunity object
    const metadata = await conn.describe('Opportunity');
    
    // Extract relevant field information
    const fields = metadata.fields.map(field => ({
      name: field.name,
      label: field.label,
      type: field.type,
      length: field.length,
      precision: field.precision,
      scale: field.scale,
      isCustom: field.custom,
      isCalculated: field.calculated,
      picklistValues: field.type === 'picklist' || field.type === 'multipicklist' 
        ? field.picklistValues.map(item => ({
            value: item.value,
            label: item.label,
            isDefault: item.defaultValue
          }))
        : [],
      isFilterable: field.filterable,
      isSortable: field.sortable,
      isNillable: field.nillable
    }));
    
    return fields;
  } catch (error) {
    console.error('Error fetching opportunity fields:', error);
    throw new Error(`Failed to fetch opportunity fields: ${error.message}`);
  }
};

/**
 * Uploads updated win probability to Salesforce
 * @param {Object} conn - jsforce connection
 * @param {Array} updates - Array of opportunity updates
 * @param {String} probabilityField - Field to update with win probability
 * @returns {Promise<Object>} Update results
 */
const updateOpportunityProbabilities = async (conn, updates, probabilityField = 'Predicted_Win_Probability__c') => {
  try {
    // Check if probability field exists and create if necessary
    let fieldExists = false;
    
    try {
      const metadata = await conn.describe('Opportunity');
      fieldExists = metadata.fields.some(field => field.name === probabilityField);
    } catch (error) {
      console.warn('Could not check field existence:', error.message);
    }
    
    // If field doesn't exist and it's a custom field, try to create it
    if (!fieldExists && probabilityField.endsWith('__c')) {
      try {
        // Create custom field
        const customField = {
          fullName: `Opportunity.${probabilityField}`,
          label: 'Predicted Win Probability',
          type: 'Percent',
          precision: 3,
          scale: 1,
          description: 'Win probability calculated by analytics engine'
        };
        
        await conn.metadata.create('CustomField', customField);
        console.log(`Created custom field: ${probabilityField}`);
        
        // Wait for field creation to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (fieldError) {
        console.warn('Could not create custom field:', fieldError.message);
        // Continue anyway, the update might still work if the field
        // exists but couldn't be detected
      }
    }
    
    // Prepare records for update
    const records = updates.map(update => ({
      Id: update.opportunityId,
      [probabilityField]: update.probability
    }));
    
    // Batch updates in groups of 200
    const batchSize = 200;
    const batches = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }
    
    // Process each batch
    const results = {
      success: [],
      errors: []
    };
    
    for (const batch of batches) {
      try {
        const updateResult = await conn.sobject('Opportunity').update(batch);
        
        // Process results
        if (Array.isArray(updateResult)) {
          updateResult.forEach((result, index) => {
            if (result.success) {
              results.success.push({
                id: batch[index].Id,
                success: true
              });
            } else {
              results.errors.push({
                id: batch[index].Id,
                success: false,
                errors: result.errors
              });
            }
          });
        } else {
          if (updateResult.success) {
            results.success.push({
              id: batch[0].Id,
              success: true
            });
          } else {
            results.errors.push({
              id: batch[0].Id,
              success: false,
              errors: updateResult.errors
            });
          }
        }
      } catch (batchError) {
        console.error('Error updating batch:', batchError);
        // Add all batch records as errors
        batch.forEach(record => {
          results.errors.push({
            id: record.Id,
            success: false,
            errors: [{ message: batchError.message }]
          });
        });
      }
    }
    
    return {
      totalRecords: records.length,
      successCount: results.success.length,
      errorCount: results.errors.length,
      results
    };
  } catch (error) {
    console.error('Error updating opportunity probabilities:', error);
    throw new Error(`Failed to update opportunity probabilities: ${error.message}`);
  }
};

/**
 * Fetches opportunity history data for temporal analysis
 * @param {Object} conn - jsforce connection
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of opportunity history records
 */
const fetchOpportunityHistory = async (conn, options = {}) => {
  try {
    const {
      opportunityIds = [],
      fields = ['OpportunityId', 'Field', 'OldValue', 'NewValue', 'CreatedDate'],
      limit = 10000
    } = options;
    
    // Construct SOQL query
    let soql = `SELECT ${fields.join(', ')} FROM OpportunityHistory`;
    
    // Add WHERE clause for specific opportunities
    if (opportunityIds && opportunityIds.length > 0) {
      // Handle Salesforce's limit on number of IDs in IN clause
      if (opportunityIds.length <= 200) {
        soql += ` WHERE OpportunityId IN ('${opportunityIds.join("','")}')`;
      } else {
        // If more than 200 IDs, use multiple queries
        const results = [];
        for (let i = 0; i < opportunityIds.length; i += 200) {
          const batchIds = opportunityIds.slice(i, i + 200);
          const batchSoql = `${soql} WHERE OpportunityId IN ('${batchIds.join("','")}')`;
          const batchResult = await conn.query(batchSoql);
          results.push(...batchResult.records);
        }
        return results;
      }
    }
    
    // Add LIMIT clause
    if (limit) {
      soql += ` LIMIT ${limit}`;
    }
    
    // Execute query
    const result = await conn.query(soql);
    return result.records;
  } catch (error) {
    console.error('Error fetching opportunity history:', error);
    throw new Error(`Failed to fetch opportunity history: ${error.message}`);
  }
};

/**
 * Fetches user data for sales rep analysis
 * @param {Object} conn - jsforce connection
 * @param {Array} userIds - Array of user IDs to fetch
 * @returns {Promise<Array>} Array of user records
 */
const fetchUsers = async (conn, userIds = []) => {
  try {
    const fields = [
      'Id', 'Name', 'Email', 'Title', 'UserRole.Name', 
      'Manager.Name', 'IsActive', 'CreatedDate'
    ];
    
    // Construct SOQL query
    let soql = `SELECT ${fields.join(', ')} FROM User`;
    
    // Add WHERE clause for specific users
    if (userIds && userIds.length > 0) {
      if (userIds.length <= 200) {
        soql += ` WHERE Id IN ('${userIds.join("','")}')`;
      } else {
        // If more than 200 IDs, use multiple queries
        const results = [];
        for (let i = 0; i < userIds.length; i += 200) {
          const batchIds = userIds.slice(i, i + 200);
          const batchSoql = `${soql} WHERE Id IN ('${batchIds.join("','")}')`;
          const batchResult = await conn.query(batchSoql);
          results.push(...batchResult.records);
        }
        return results;
      }
    }
    
    // Also filter to only active users
    if (userIds && userIds.length > 0) {
      soql += ' AND IsActive = true';
    } else {
      soql += ' WHERE IsActive = true';
    }
    
    // Add LIMIT clause
    soql += ' LIMIT 1000';
    
    // Execute query
    const result = await conn.query(soql);
    return result.records;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
};

module.exports = {
  createConnection,
  fetchOpportunities,
  fetchOpportunityFields,
  updateOpportunityProbabilities,
  fetchOpportunityHistory,
  fetchUsers
};