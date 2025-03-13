/**
 * Utilities for data validation and error handling
 */

/**
 * Validates field types in opportunity data
 * @param {Array} data - Array of opportunity objects
 * @param {Object} expectedTypes - Object mapping field names to expected types
 * @returns {Object} Validation results with errors
 */
const validateFieldTypes = (data, expectedTypes) => {
  if (!data || !Array.isArray(data) || !expectedTypes) {
    return { valid: false, errors: ['Invalid input parameters'] };
  }
  
  const errors = [];
  
  data.forEach((record, recordIndex) => {
    Object.keys(expectedTypes).forEach(field => {
      if (record[field] !== null && record[field] !== undefined) {
        const expectedType = expectedTypes[field];
        let actualType = typeof record[field];
        
        // Special handling for Date objects
        if (expectedType === 'date' && actualType === 'string') {
          try {
            const date = new Date(record[field]);
            if (isNaN(date.getTime())) {
              errors.push(`Record ${recordIndex}: Field '${field}' is not a valid date`);
            }
          } catch (error) {
            errors.push(`Record ${recordIndex}: Field '${field}' is not a valid date`);
          }
        } else if (actualType !== expectedType && !(expectedType === 'number' && record[field] === 0)) {
          errors.push(`Record ${recordIndex}: Field '${field}' expected type '${expectedType}', got '${actualType}'`);
        }
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validates required fields in opportunity data
 * @param {Array} data - Array of opportunity objects
 * @param {Array} requiredFields - List of required field names
 * @returns {Object} Validation results with errors
 */
const validateRequiredFields = (data, requiredFields) => {
  if (!data || !Array.isArray(data) || !requiredFields || !Array.isArray(requiredFields)) {
    return { valid: false, errors: ['Invalid input parameters'] };
  }
  
  const errors = [];
  
  data.forEach((record, recordIndex) => {
    requiredFields.forEach(field => {
      if (record[field] === null || record[field] === undefined || record[field] === '') {
        errors.push(`Record ${recordIndex}: Required field '${field}' is missing or empty`);
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validates numeric ranges for fields
 * @param {Array} data - Array of opportunity objects
 * @param {Object} rangeConstraints - Object mapping field names to min/max constraints
 * @returns {Object} Validation results with errors
 */
const validateNumericRanges = (data, rangeConstraints) => {
  if (!data || !Array.isArray(data) || !rangeConstraints) {
    return { valid: false, errors: ['Invalid input parameters'] };
  }
  
  const errors = [];
  
  data.forEach((record, recordIndex) => {
    Object.keys(rangeConstraints).forEach(field => {
      if (typeof record[field] === 'number') {
        const constraints = rangeConstraints[field];
        
        if (constraints.min !== undefined && record[field] < constraints.min) {
          errors.push(`Record ${recordIndex}: Field '${field}' value ${record[field]} is below minimum ${constraints.min}`);
        }
        
        if (constraints.max !== undefined && record[field] > constraints.max) {
          errors.push(`Record ${recordIndex}: Field '${field}' value ${record[field]} is above maximum ${constraints.max}`);
        }
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validates that field values are within a set of allowed values
 * @param {Array} data - Array of opportunity objects
 * @param {Object} allowedValues - Object mapping field names to arrays of allowed values
 * @returns {Object} Validation results with errors
 */
const validateAllowedValues = (data, allowedValues) => {
  if (!data || !Array.isArray(data) || !allowedValues) {
    return { valid: false, errors: ['Invalid input parameters'] };
  }
  
  const errors = [];
  
  data.forEach((record, recordIndex) => {
    Object.keys(allowedValues).forEach(field => {
      if (record[field] !== null && record[field] !== undefined) {
        const allowed = allowedValues[field];
        
        if (!allowed.includes(record[field])) {
          errors.push(`Record ${recordIndex}: Field '${field}' value '${record[field]}' is not in allowed values: ${allowed.join(', ')}`);
        }
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validates date fields are within specified ranges
 * @param {Array} data - Array of opportunity objects
 * @param {Object} dateRanges - Object mapping date field names to min/max date strings
 * @returns {Object} Validation results with errors
 */
const validateDateRanges = (data, dateRanges) => {
  if (!data || !Array.isArray(data) || !dateRanges) {
    return { valid: false, errors: ['Invalid input parameters'] };
  }
  
  const errors = [];
  
  data.forEach((record, recordIndex) => {
    Object.keys(dateRanges).forEach(field => {
      if (record[field]) {
        try {
          const date = new Date(record[field]);
          const constraints = dateRanges[field];
          
          if (constraints.min) {
            const minDate = new Date(constraints.min);
            if (date < minDate) {
              errors.push(`Record ${recordIndex}: Field '${field}' date ${date.toISOString()} is before minimum ${minDate.toISOString()}`);
            }
          }
          
          if (constraints.max) {
            const maxDate = new Date(constraints.max);
            if (date > maxDate) {
              errors.push(`Record ${recordIndex}: Field '${field}' date ${date.toISOString()} is after maximum ${maxDate.toISOString()}`);
            }
          }
        } catch (error) {
          errors.push(`Record ${recordIndex}: Field '${field}' contains an invalid date`);
        }
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validates relationships between fields
 * @param {Array} data - Array of opportunity objects
 * @param {Array} relationships - Array of relationship rules
 * @returns {Object} Validation results with errors
 */
const validateFieldRelationships = (data, relationships) => {
  if (!data || !Array.isArray(data) || !relationships || !Array.isArray(relationships)) {
    return { valid: false, errors: ['Invalid input parameters'] };
  }
  
  const errors = [];
  
  data.forEach((record, recordIndex) => {
    relationships.forEach(relationship => {
      const { field1, field2, operator, errorMessage } = relationship;
      
      if (record[field1] !== undefined && record[field2] !== undefined) {
        let isValid = false;
        
        switch (operator) {
          case 'equal':
            isValid = record[field1] === record[field2];
            break;
          case 'notEqual':
            isValid = record[field1] !== record[field2];
            break;
          case 'greaterThan':
            isValid = record[field1] > record[field2];
            break;
          case 'lessThan':
            isValid = record[field1] < record[field2];
            break;
          case 'greaterThanOrEqual':
            isValid = record[field1] >= record[field2];
            break;
          case 'lessThanOrEqual':
            isValid = record[field1] <= record[field2];
            break;
          default:
            isValid = true; // Skip validation for unknown operators
        }
        
        if (!isValid) {
          errors.push(`Record ${recordIndex}: ${errorMessage || `Relationship between '${field1}' and '${field2}' is invalid`}`);
        }
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Formats error messages for better readability
 * @param {Array} errors - Array of error messages
 * @param {string} format - Output format ('text', 'html', 'json')
 * @returns {string} Formatted error message
 */
const formatValidationErrors = (errors, format = 'text') => {
  if (!errors || !Array.isArray(errors)) {
    return '';
  }
  
  switch (format) {
    case 'html':
      return `<ul>${errors.map(error => `<li>${error}</li>`).join('')}</ul>`;
    
    case 'json':
      return JSON.stringify({ errors });
    
    case 'text':
    default:
      return errors.map(error => `- ${error}`).join('\n');
  }
};

/**
 * Performs complete validation of opportunity data
 * @param {Array} data - Array of opportunity objects
 * @param {Object} validationRules - Object containing all validation rules
 * @returns {Object} Combined validation results
 */
const validateOpportunityData = (data, validationRules) => {
  if (!data || !Array.isArray(data)) {
    return { valid: false, errors: ['Invalid data: expected an array'] };
  }
  
  if (!validationRules) {
    return { valid: true, errors: [] };
  }
  
  const allErrors = [];
  const results = {};
  
  // Run individual validations
  if (validationRules.fieldTypes) {
    const result = validateFieldTypes(data, validationRules.fieldTypes);
    results.fieldTypes = result;
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }
  
  if (validationRules.requiredFields) {
    const result = validateRequiredFields(data, validationRules.requiredFields);
    results.requiredFields = result;
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }
  
  if (validationRules.numericRanges) {
    const result = validateNumericRanges(data, validationRules.numericRanges);
    results.numericRanges = result;
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }
  
  if (validationRules.allowedValues) {
    const result = validateAllowedValues(data, validationRules.allowedValues);
    results.allowedValues = result;
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }
  
  if (validationRules.dateRanges) {
    const result = validateDateRanges(data, validationRules.dateRanges);
    results.dateRanges = result;
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }
  
  if (validationRules.fieldRelationships) {
    const result = validateFieldRelationships(data, validationRules.fieldRelationships);
    results.fieldRelationships = result;
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    results
  };
};

/**
 * Checks if input parameters for an analytics operation are valid
 * @param {Object} params - Parameters object
 * @param {Object} requiredParams - Definition of required parameters and their types
 * @returns {Object} Validation result
 */
const validateAnalyticsParams = (params, requiredParams) => {
  if (!params || typeof params !== 'object') {
    return { valid: false, errors: ['Invalid parameters: expected an object'] };
  }
  
  if (!requiredParams || typeof requiredParams !== 'object') {
    return { valid: true, errors: [] };
  }
  
  const errors = [];
  
  Object.keys(requiredParams).forEach(param => {
    const requirement = requiredParams[param];
    
    // Check if parameter exists
    if (requirement.required && (params[param] === undefined || params[param] === null)) {
      errors.push(`Missing required parameter: ${param}`);
      return;
    }
    
    // If parameter exists, check its type
    if (params[param] !== undefined && params[param] !== null) {
      const actualType = Array.isArray(params[param]) ? 'array' : typeof params[param];
      
      if (actualType !== requirement.type) {
        errors.push(`Parameter ${param} has invalid type: expected ${requirement.type}, got ${actualType}`);
      }
      
      // For arrays, check item types if specified
      if (actualType === 'array' && requirement.itemType && params[param].length > 0) {
        for (let i = 0; i < params[param].length; i++) {
          const itemType = Array.isArray(params[param][i]) ? 'array' : typeof params[param][i];
          if (itemType !== requirement.itemType) {
            errors.push(`Parameter ${param}[${i}] has invalid type: expected ${requirement.itemType}, got ${itemType}`);
            break; // Only report first error
          }
        }
      }
      
      // Validate against allowed values if specified
      if (requirement.allowedValues && !requirement.allowedValues.includes(params[param])) {
        errors.push(`Parameter ${param} has invalid value: expected one of [${requirement.allowedValues.join(', ')}], got ${params[param]}`);
      }
      
      // Validate numeric ranges
      if (actualType === 'number' && (requirement.min !== undefined || requirement.max !== undefined)) {
        if (requirement.min !== undefined && params[param] < requirement.min) {
          errors.push(`Parameter ${param} is too small: minimum value is ${requirement.min}, got ${params[param]}`);
        }
        
        if (requirement.max !== undefined && params[param] > requirement.max) {
          errors.push(`Parameter ${param} is too large: maximum value is ${requirement.max}, got ${params[param]}`);
        }
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateFieldTypes,
  validateRequiredFields,
  validateNumericRanges,
  validateAllowedValues,
  validateDateRanges,
  validateFieldRelationships,
  formatValidationErrors,
  validateOpportunityData,
  validateAnalyticsParams
};
