/**
 * Application Configuration
 */

// Load environment variables
require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  
  // Salesforce API configuration
  salesforce: {
    clientId: process.env.SF_CLIENT_ID,
    clientSecret: process.env.SF_CLIENT_SECRET,
    redirectUri: process.env.SF_REDIRECT_URI || 'http://localhost:3000/api/auth/callback',
    loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com'
  },
  
  // Application settings
  app: {
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '100', 10),
    maxQueryResults: parseInt(process.env.MAX_QUERY_RESULTS || '10000', 10),
    defaultOpportunityFields: [
      'Id', 'Name', 'AccountId', 'OwnerId', 'Amount', 'StageName', 
      'CloseDate', 'Probability', 'Type', 'IsWon', 'IsClosed', 'CreatedDate'
    ]
  },
  
  // Analytics settings
  analytics: {
    minOpportunitiesForAnalysis: parseInt(process.env.MIN_OPPORTUNITIES || '50', 10),
    minOpportunitiesForPrediction: parseInt(process.env.MIN_OPPORTUNITIES_PREDICTION || '100', 10),
    maxLookupTableCombinations: parseInt(process.env.MAX_LOOKUP_COMBINATIONS || '1000', 10),
    defaultClusterCount: parseInt(process.env.DEFAULT_CLUSTER_COUNT || '3', 10)
  }
};