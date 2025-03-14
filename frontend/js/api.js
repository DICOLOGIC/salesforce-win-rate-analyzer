/**
 * API Module for Salesforce Win Rate Analyzer
 * Handles all communication with the backend API
 */

/**
 * API Handler for making HTTP requests
 */
const API = (() => {
  // Default request options
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include' // Include cookies for authentication
  };

  /**
   * Generic error handler for API requests
   * @param {Response} response - Fetch API response object
   * @returns {Promise<Object>} Promise resolving to JSON response or rejecting with error
   */
  const handleResponse = async (response) => {
    const contentType = response.headers.get('content-type');
    
    // Parse response based on content type
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Check if response was successful
    if (!response.ok) {
      // Create error object with details from response
      const error = new Error(data.message || response.statusText || 'API Error');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    return data;
  };

  /**
   * Makes a GET request to the API
   * @param {string} endpoint - API endpoint to call
   * @param {Object} params - Query parameters to include
   * @returns {Promise<Object>} Promise resolving to response data
   */
  const get = async (endpoint, params = {}) => {
    // Build URL with query parameters if provided
    let url = `${CONFIG.API.BASE_URL}${endpoint}`;
    
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
    
    try {
      const response = await fetch(url, {
        ...defaultOptions,
        method: 'GET'
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('API GET Error:', error);
      throw error;
    }
  };

  /**
   * Makes a POST request to the API
   * @param {string} endpoint - API endpoint to call
   * @param {Object} data - Data to send in the request body
   * @returns {Promise<Object>} Promise resolving to response data
   */
  const post = async (endpoint, data = {}) => {
    try {
      const response = await fetch(`${CONFIG.API.BASE_URL}${endpoint}`, {
        ...defaultOptions,
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('API POST Error:', error);
      throw error;
    }
  };

  /**
   * Makes a PUT request to the API
   * @param {string} endpoint - API endpoint to call
   * @param {Object} data - Data to send in the request body
   * @returns {Promise<Object>} Promise resolving to response data
   */
  const put = async (endpoint, data = {}) => {
    try {
      const response = await fetch(`${CONFIG.API.BASE_URL}${endpoint}`, {
        ...defaultOptions,
        method: 'PUT',
        body: JSON.stringify(data)
      });
      
      return handleResponse(response);
    } catch (error) {
      console.error('API PUT Error:', error);
      throw error;
    }
  };

  /**
   * Makes a DELETE request to the API
   * @param {string} endpoint - API endpoint to call
   * @param {Object} data - Optional data to send in the request body
   * @returns {Promise<Object>} Promise resolving to response data
   */
  const del = async (endpoint, data = null) => {
    try {
      const options = {
        ...defaultOptions,
        method: 'DELETE'
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${CONFIG.API.BASE_URL}${endpoint}`, options);
      
      return handleResponse(response);
    } catch (error) {
      console.error('API DELETE Error:', error);
      throw error;
    }
  };

  // Return public methods
  return {
    get,
    post,
    put,
    delete: del
  };
})();

/**
 * Authentication API methods
 */
const AuthAPI = {
  /**
   * Initiates Salesforce OAuth login flow
   * @returns {Promise<Object>} Promise resolving to login URL
   */
  login: async () => {
    return API.get(CONFIG.API.AUTH.LOGIN);
  },
  
  /**
   * Processes OAuth callback and completes authentication
   * @param {string} code - OAuth code from callback
   * @param {string} state - OAuth state from callback
   * @returns {Promise<Object>} Promise resolving to user info
   */
  handleCallback: async (code, state) => {
    return API.post(CONFIG.API.AUTH.CALLBACK, { code, state });
  },
  
  /**
   * Logs out the current user
   * @returns {Promise<Object>} Promise resolving to logout result
   */
  logout: async () => {
    return API.post(CONFIG.API.AUTH.LOGOUT);
  },
  
  /**
   * Checks current authentication status
   * @returns {Promise<Object>} Promise resolving to auth status
   */
  checkStatus: async () => {
    return API.get(CONFIG.API.AUTH.STATUS);
  },
  
  /**
   * Refreshes the authentication token
   * @returns {Promise<Object>} Promise resolving to new auth details
   */
  refreshToken: async () => {
    return API.post(CONFIG.API.AUTH.REFRESH);
  }
};

/**
 * Data API methods
 */
const DataAPI = {
  /**
   * Fetches opportunity data
   * @param {Object} filters - Filters to apply to the data
   * @returns {Promise<Object>} Promise resolving to opportunity data
   */
  getOpportunities: async (filters = {}) => {
    return API.get(CONFIG.API.DATA.OPPORTUNITIES, filters);
  },
  
  /**
   * Fetches available fields from Salesforce
   * @returns {Promise<Object>} Promise resolving to field metadata
   */
  getFields: async () => {
    return API.get(CONFIG.API.DATA.FIELDS);
  },
  
  /**
   * Fetches available dimensions for analysis
   * @returns {Promise<Object>} Promise resolving to dimension metadata
   */
  getDimensions: async () => {
    return API.get(CONFIG.API.DATA.DIMENSIONS);
  },
  
  /**
   * Refreshes data from Salesforce
   * @returns {Promise<Object>} Promise resolving to refresh status
   */
  refreshData: async () => {
    return API.post(CONFIG.API.DATA.REFRESH);
  }
};

/**
 * Analytics API methods
 */
const AnalyticsAPI = {
  /**
   * Performs dimension impact analysis
   * @param {Object} params - Analysis parameters
   * @returns {Promise<Object>} Promise resolving to analysis results
   */
  analyzeDimensionImpact: async (params) => {
    return API.post(CONFIG.API.ANALYTICS.DIMENSION_IMPACT, params);
  },
  
  /**
   * Performs dimension clustering
   * @param {Object} params - Clustering parameters
   * @returns {Promise<Object>} Promise resolving to clustering results
   */
  clusterDimensions: async (params) => {
    return API.post(CONFIG.API.ANALYTICS.CLUSTERING, params);
  },
  
  /**
   * Prediction model API methods
   */
  prediction: {
    /**
     * Gets the current prediction model
     * @returns {Promise<Object>} Promise resolving to model details
     */
    getModel: async () => {
      return API.get(CONFIG.API.ANALYTICS.PREDICTION.MODEL);
    },
    
    /**
     * Predicts win probability for an opportunity
     * @param {Object} opportunity - Opportunity data
     * @returns {Promise<Object>} Promise resolving to prediction results
     */
    predict: async (opportunity) => {
      return API.post(CONFIG.API.ANALYTICS.PREDICTION.PREDICT, opportunity);
    },
    
    /**
     * Gets win rate formula
     * @param {Object} params - Formula parameters
     * @returns {Promise<Object>} Promise resolving to formula details
     */
    getFormula: async (params = {}) => {
      return API.get(CONFIG.API.ANALYTICS.PREDICTION.FORMULA, params);
    },
    
    /**
     * Gets factor importance data
     * @param {Object} opportunity - Opportunity data
     * @returns {Promise<Object>} Promise resolving to importance details
     */
    getFactorImportance: async (opportunity) => {
      return API.post(CONFIG.API.ANALYTICS.PREDICTION.IMPORTANCE, opportunity);
    }
  },
  
  /**
   * Generates win rate lookup table
   * @param {Object} params - Lookup table parameters
   * @returns {Promise<Object>} Promise resolving to lookup table data
   */
  generateLookupTable: async (params) => {
    return API.post(CONFIG.API.ANALYTICS.LOOKUP, params);
  }
};
