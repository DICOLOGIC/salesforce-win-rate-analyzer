/**
 * Utilities for data processing and manipulation
 * These utilities help with data cleansing, transformation, and preparation for analytics
 */

/**
 * Identifies and handles missing values in the dataset
 * @param {Array} data - Array of opportunity objects
 * @param {Object} options - Configuration options for handling missing values
 * @param {boolean} options.removeIncomplete - Whether to remove records with missing values
 * @param {Object} options.defaultValues - Default values for different dimensions
 * @returns {Array} Processed data with missing values handled
 */
const handleMissingValues = (data, options = {}) => {
  const { 
    removeIncomplete = false, 
    defaultValues = {} 
  } = options;
  
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  if (removeIncomplete) {
    // Remove records with any null or undefined values
    return data.filter(record => {
      return Object.values(record).every(value => value !== null && value !== undefined);
    });
  } else {
    // Replace missing values with defaults or specified replacements
    return data.map(record => {
      const processedRecord = { ...record };
      Object.keys(processedRecord).forEach(key => {
        if (processedRecord[key] === null || processedRecord[key] === undefined) {
          processedRecord[key] = defaultValues[key] !== undefined ? defaultValues[key] : null;
        }
      });
      return processedRecord;
    });
  }
};

/**
 * Normalizes numeric values to a common scale (0-1)
 * @param {Array} data - Array of opportunity objects
 * @param {Array} numericFields - List of fields to normalize
 * @returns {Array} Data with normalized numeric fields
 */
const normalizeNumericValues = (data, numericFields) => {
  if (!data || !Array.isArray(data) || !numericFields || !Array.isArray(numericFields)) {
    return [];
  }
  
  // Calculate min and max for each numeric field
  const ranges = {};
  numericFields.forEach(field => {
    const values = data.map(record => record[field]).filter(val => typeof val === 'number');
    if (values.length > 0) {
      ranges[field] = {
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }
  });
  
  // Normalize values
  return data.map(record => {
    const normalizedRecord = { ...record };
    numericFields.forEach(field => {
      if (
        ranges[field] && 
        typeof normalizedRecord[field] === 'number' && 
        ranges[field].max !== ranges[field].min
      ) {
        normalizedRecord[`${field}_normalized`] = (normalizedRecord[field] - ranges[field].min) / 
          (ranges[field].max - ranges[field].min);
      } else if (ranges[field] && typeof normalizedRecord[field] === 'number') {
        // Handle case where all values are the same
        normalizedRecord[`${field}_normalized`] = 1;
      }
    });
    return normalizedRecord;
  });
};

/**
 * Encodes categorical variables for use in numerical analysis
 * @param {Array} data - Array of opportunity objects
 * @param {Array} categoricalFields - List of categorical fields to encode
 * @param {string} encodingType - Type of encoding ('one-hot', 'label', 'binary')
 * @returns {Array} Data with encoded categorical variables
 */
const encodeCategoricalVariables = (data, categoricalFields, encodingType = 'one-hot') => {
  if (!data || !Array.isArray(data) || !categoricalFields || !Array.isArray(categoricalFields)) {
    return [];
  }
  
  // Get unique values for each categorical field
  const uniqueValues = {};
  categoricalFields.forEach(field => {
    uniqueValues[field] = [...new Set(data.map(record => record[field]))].filter(Boolean);
  });
  
  // Perform encoding based on the specified type
  switch (encodingType) {
    case 'one-hot':
      return data.map(record => {
        const encodedRecord = { ...record };
        
        categoricalFields.forEach(field => {
          if (record[field]) {
            uniqueValues[field].forEach(value => {
              encodedRecord[`${field}_${value}`] = record[field] === value ? 1 : 0;
            });
          }
        });
        
        return encodedRecord;
      });
      
    case 'label':
      return data.map(record => {
        const encodedRecord = { ...record };
        
        categoricalFields.forEach(field => {
          if (record[field]) {
            encodedRecord[`${field}_encoded`] = uniqueValues[field].indexOf(record[field]);
          }
        });
        
        return encodedRecord;
      });
      
    case 'binary':
      // For binary encoding (only use for fields with exactly 2 values)
      return data.map(record => {
        const encodedRecord = { ...record };
        
        categoricalFields.forEach(field => {
          if (record[field] && uniqueValues[field].length === 2) {
            encodedRecord[`${field}_binary`] = record[field] === uniqueValues[field][0] ? 0 : 1;
          }
        });
        
        return encodedRecord;
      });
      
    default:
      return data;
  }
};

/**
 * Creates derived features from existing opportunity data
 * @param {Array} data - Array of opportunity objects
 * @returns {Array} Data with additional derived features
 */
const createDerivedFeatures = (data) => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  return data.map(record => {
    const derivedRecord = { ...record };
    
    // Calculate age of opportunity if created date exists
    if (record.CreatedDate) {
      const createdDate = new Date(record.CreatedDate);
      const today = new Date();
      derivedRecord.OpportunityAgeInDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
    }
    
    // Calculate deal size category
    if (typeof record.Amount === 'number') {
      if (record.Amount < 10000) {
        derivedRecord.DealSizeCategory = 'Small';
      } else if (record.Amount < 50000) {
        derivedRecord.DealSizeCategory = 'Medium';
      } else if (record.Amount < 100000) {
        derivedRecord.DealSizeCategory = 'Large';
      } else {
        derivedRecord.DealSizeCategory = 'Enterprise';
      }
    }
    
    // Calculate discount percentage if both Amount and Expected Amount exist
    if (typeof record.Amount === 'number' && typeof record.ExpectedAmount === 'number' && record.ExpectedAmount > 0) {
      derivedRecord.DiscountPercentage = ((record.ExpectedAmount - record.Amount) / record.ExpectedAmount) * 100;
    }
    
    return derivedRecord;
  });
};

/**
 * Balances the dataset for win/loss opportunities to avoid bias
 * @param {Array} data - Array of opportunity objects
 * @param {string} outcomeField - Field name indicating win/loss status
 * @param {string} method - Balancing method ('undersample', 'oversample')
 * @returns {Array} Balanced dataset
 */
const balanceWinLossData = (data, outcomeField = 'IsWon', method = 'undersample') => {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  // Separate wins and losses
  const wins = data.filter(record => record[outcomeField] === true);
  const losses = data.filter(record => record[outcomeField] === false);
  
  // Determine minority and majority classes
  const minorityClass = wins.length <= losses.length ? wins : losses;
  const majorityClass = wins.length <= losses.length ? losses : wins;
  
  if (method === 'undersample') {
    // Randomly select from majority class to match minority class size
    const shuffledMajority = [...majorityClass].sort(() => 0.5 - Math.random());
    const selectedMajority = shuffledMajority.slice(0, minorityClass.length);
    return [...minorityClass, ...selectedMajority];
  } else if (method === 'oversample') {
    // Randomly duplicate minority class to match majority class size
    const difference = majorityClass.length - minorityClass.length;
    const oversampledMinority = [...minorityClass];
    
    for (let i = 0; i < difference; i++) {
      const randomIndex = Math.floor(Math.random() * minorityClass.length);
      oversampledMinority.push({ ...minorityClass[randomIndex] });
    }
    
    return [...oversampledMinority, ...majorityClass];
  }
  
  return data;
};

/**
 * Splits data into training and testing sets for model validation
 * @param {Array} data - Array of opportunity objects
 * @param {number} testRatio - Ratio of data to use for testing (0-1)
 * @param {boolean} stratified - Whether to maintain the same win/loss ratio in both sets
 * @param {string} outcomeField - Field name indicating win/loss status
 * @returns {Object} Object containing training and testing datasets
 */
const splitTrainingTestingData = (data, testRatio = 0.2, stratified = true, outcomeField = 'IsWon') => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { training: [], testing: [] };
  }
  
  if (stratified) {
    // Separate wins and losses
    const wins = data.filter(record => record[outcomeField] === true);
    const losses = data.filter(record => record[outcomeField] === false);
    
    // Shuffle each set
    const shuffledWins = [...wins].sort(() => 0.5 - Math.random());
    const shuffledLosses = [...losses].sort(() => 0.5 - Math.random());
    
    // Calculate split points
    const winsTestCount = Math.floor(shuffledWins.length * testRatio);
    const lossesTestCount = Math.floor(shuffledLosses.length * testRatio);
    
    // Split datasets
    const winsTest = shuffledWins.slice(0, winsTestCount);
    const winsTrain = shuffledWins.slice(winsTestCount);
    const lossesTest = shuffledLosses.slice(0, lossesTestCount);
    const lossesTrain = shuffledLosses.slice(lossesTestCount);
    
    return {
      training: [...winsTrain, ...lossesTrain],
      testing: [...winsTest, ...lossesTest]
    };
  } else {
    // Simple random split
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    const testSize = Math.floor(data.length * testRatio);
    
    return {
      training: shuffled.slice(testSize),
      testing: shuffled.slice(0, testSize)
    };
  }
};

/**
 * Detects and handles outliers in numeric data
 * @param {Array} data - Array of opportunity objects
 * @param {Array} numericFields - List of numeric fields to check for outliers
 * @param {string} method - Method for handling outliers ('remove', 'cap', 'none')
 * @returns {Array} Data with outliers handled
 */
const handleOutliers = (data, numericFields, method = 'cap') => {
  if (!data || !Array.isArray(data) || !numericFields || !Array.isArray(numericFields)) {
    return [];
  }
  
  // Calculate statistics for each numeric field
  const fieldStats = {};
  numericFields.forEach(field => {
    const values = data.map(record => record[field]).filter(val => typeof val === 'number');
    if (values.length > 0) {
      // Sort values for percentile calculation
      const sortedValues = [...values].sort((a, b) => a - b);
      
      // Calculate quartiles
      const q1Index = Math.floor(sortedValues.length * 0.25);
      const q3Index = Math.floor(sortedValues.length * 0.75);
      const q1 = sortedValues[q1Index];
      const q3 = sortedValues[q3Index];
      
      // Calculate IQR and bounds
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      fieldStats[field] = {
        lowerBound,
        upperBound,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }
  });
  
  // Handle outliers based on specified method
  switch (method) {
    case 'remove':
      return data.filter(record => {
        return numericFields.every(field => {
          if (typeof record[field] !== 'number') return true;
          
          const stats = fieldStats[field];
          return record[field] >= stats.lowerBound && record[field] <= stats.upperBound;
        });
      });
      
    case 'cap':
      return data.map(record => {
        const processedRecord = { ...record };
        
        numericFields.forEach(field => {
          if (typeof processedRecord[field] !== 'number') return;
          
          const stats = fieldStats[field];
          if (processedRecord[field] < stats.lowerBound) {
            processedRecord[field] = stats.lowerBound;
          } else if (processedRecord[field] > stats.upperBound) {
            processedRecord[field] = stats.upperBound;
          }
        });
        
        return processedRecord;
      });
      
    default:
      return data;
  }
};

/**
 * Aggregates opportunity data by dimensions for summary analysis
 * @param {Array} data - Array of opportunity objects
 * @param {Array} dimensions - Dimensions to group by
 * @param {Array} metrics - Metrics to aggregate
 * @returns {Array} Aggregated data
 */
const aggregateByDimensions = (data, dimensions, metrics) => {
  if (!data || !Array.isArray(data) || !dimensions || !Array.isArray(dimensions)) {
    return [];
  }
  
  // Create a map for aggregated results
  const aggregatedMap = new Map();
  
  // Process each record
  data.forEach(record => {
    // Create a key based on dimensions
    const dimensionValues = dimensions.map(dim => record[dim] || 'Unknown').join('|');
    
    // Get or create entry in the map
    if (!aggregatedMap.has(dimensionValues)) {
      const entry = {
        count: 0,
        won: 0
      };
      
      // Initialize dimensions
      dimensions.forEach((dim, index) => {
        entry[dim] = record[dim] || 'Unknown';
      });
      
      // Initialize metrics
      metrics.forEach(metric => {
        entry[`sum_${metric}`] = 0;
        entry[`avg_${metric}`] = 0;
        entry[`min_${metric}`] = Infinity;
        entry[`max_${metric}`] = -Infinity;
      });
      
      aggregatedMap.set(dimensionValues, entry);
    }
    
    const entry = aggregatedMap.get(dimensionValues);
    
    // Update counts
    entry.count += 1;
    if (record.IsWon) {
      entry.won += 1;
    }
    
    // Update metrics
    metrics.forEach(metric => {
      if (typeof record[metric] === 'number') {
        entry[`sum_${metric}`] += record[metric];
        entry[`min_${metric}`] = Math.min(entry[`min_${metric}`], record[metric]);
        entry[`max_${metric}`] = Math.max(entry[`max_${metric}`], record[metric]);
      }
    });
  });
  
  // Calculate averages and win rates
  const result = [];
  aggregatedMap.forEach(entry => {
    // Calculate win rate
    entry.winRate = entry.count > 0 ? (entry.won / entry.count) * 100 : 0;
    
    // Calculate averages
    metrics.forEach(metric => {
      entry[`avg_${metric}`] = entry.count > 0 ? entry[`sum_${metric}`] / entry.count : 0;
      // Reset min if it was never set
      if (entry[`min_${metric}`] === Infinity) {
        entry[`min_${metric}`] = 0;
      }
    });
    
    result.push(entry);
  });
  
  return result;
};

module.exports = {
  handleMissingValues,
  normalizeNumericValues,
  encodeCategoricalVariables,
  createDerivedFeatures,
  balanceWinLossData,
  splitTrainingTestingData,
  handleOutliers,
  aggregateByDimensions
};
