/**
 * Configuration for the Salesforce Win Rate Analyzer
 * Contains constants and configuration options for the frontend application
 */

const CONFIG = {
  /**
   * API endpoints
   */
  API: {
    BASE_URL: '/api',
    AUTH: {
      LOGIN: '/auth/login',
      CALLBACK: '/auth/callback',
      LOGOUT: '/auth/logout',
      REFRESH: '/auth/refresh',
      STATUS: '/auth/status'
    },
    DATA: {
      OPPORTUNITIES: '/data/opportunities',
      FIELDS: '/data/fields',
      DIMENSIONS: '/data/dimensions',
      REFRESH: '/data/refresh'
    },
    ANALYTICS: {
      DIMENSION_IMPACT: '/analytics/dimension-impact',
      CLUSTERING: '/analytics/clustering',
      PREDICTION: {
        MODEL: '/analytics/prediction/model',
        PREDICT: '/analytics/prediction/predict',
        FORMULA: '/analytics/prediction/formula',
        IMPORTANCE: '/analytics/prediction/importance'
      },
      LOOKUP: '/analytics/lookup-table'
    }
  },
  
  /**
   * Default settings
   */
  DEFAULTS: {
    /**
     * Analytics settings
     */
    ANALYTICS: {
      CONFIDENCE_LEVEL: 0.95,
      MIN_SAMPLE_SIZE: 10,
      PREDICTION_MODEL_TYPE: 'logistic',
      USE_WEIGHTED_MODEL: true
    },
    
    /**
     * Visualization settings
     */
    VISUALIZATION: {
      COLOR_SCHEME: 'blues',
      SHOW_CONFIDENCE_INTERVALS: true
    },
    
    /**
     * Data settings
     */
    DATA: {
      WIN_DEFINITION: 'standard',
      EXCLUDE_OUTLIERS: true
    },
    
    /**
     * Time range options
     */
    TIME_RANGES: {
      LAST_30_DAYS: 'last30Days',
      LAST_90_DAYS: 'last90Days',
      LAST_YEAR: 'lastYear',
      ALL_TIME: 'allTime',
      CUSTOM: 'custom'
    }
  },
  
  /**
   * Prediction model settings
   */
  PREDICTION: {
    /**
     * Probability thresholds for categorical predictions
     */
    THRESHOLDS: {
      HIGH: 0.7,
      MEDIUM: 0.3
    },
    
    /**
     * Model types
     */
    MODEL_TYPES: {
      LOGISTIC: 'logistic',
      RANDOM_FOREST: 'randomForest'
    }
  },
  
  /**
   * Clustering settings
   */
  CLUSTERING: {
    /**
     * Algorithms
     */
    ALGORITHMS: {
      K_MEANS: 'kmeans',
      HIERARCHICAL: 'hierarchical'
    },
    
    /**
     * Default number of clusters
     */
    DEFAULT_CLUSTERS: 3,
    
    /**
     * Maximum number of clusters
     */
    MAX_CLUSTERS: 10
  },
  
  /**
   * Chart colors
   */
  COLORS: {
    PRIMARY: '#007bff',
    SUCCESS: '#28a745',
    DANGER: '#dc3545',
    WARNING: '#ffc107',
    INFO: '#17a2b8',
    
    /**
     * Color schemes for visualizations
     */
    SCHEMES: {
      BLUES: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
      GREENS: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
      ORANGES: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
      PURPLES: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
      SPECTRAL: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2']
    }
  },
  
  /**
   * Locale settings for formatting
   */
  LOCALE: {
    CURRENCY: 'USD',
    DATE_FORMAT: 'MM/DD/YYYY',
    DECIMAL_PLACES: 2
  },
  
  /**
   * Web Worker paths
   */
  WORKERS: {
    REGRESSION: '/js/workers/regressionWorker.js',
    CLUSTERING: '/js/workers/clusteringWorker.js',
    PREDICTION: '/js/workers/predictionWorker.js'
  }
};
