/**
 * Utility functions for Salesforce Win Rate Analyzer
 */

const Utils = (() => {
  /**
   * Creates and returns a debounced version of a function
   * @param {Function} fn - The function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  const debounce = (fn, delay) => {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  /**
   * Creates and returns a throttled version of a function
   * @param {Function} fn - The function to throttle
   * @param {number} limit - Limit in milliseconds
   * @returns {Function} Throttled function
   */
  const throttle = (fn, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  /**
   * Formats a number as a percentage
   * @param {number} value - The value to format
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted percentage
   */
  const formatPercentage = (value, decimals = 1) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    return `${Number(value).toFixed(decimals)}%`;
  };

  /**
   * Formats a number as currency
   * @param {number} value - The value to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted currency
   */
  const formatCurrency = (value, currency = CONFIG.LOCALE.CURRENCY) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  /**
   * Formats a date
   * @param {string|Date} date - The date to format
   * @param {string} format - Optional format for the date
   * @returns {string} Formatted date
   */
  const formatDate = (date, format = CONFIG.LOCALE.DATE_FORMAT) => {
    if (!date) {
      return 'N/A';
    }
    
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) {
      return 'Invalid Date';
    }
    
    // Simple format handling (not as comprehensive as a date library)
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = d.getFullYear();
    
    let formatted = format
      .replace('MM', month.toString().padStart(2, '0'))
      .replace('DD', day.toString().padStart(2, '0'))
      .replace('YYYY', year);
    
    return formatted;
  };

  /**
   * Gets a color based on value within a range
   * @param {number} value - Value to map to a color
   * @param {number} min - Minimum value in range
   * @param {number} max - Maximum value in range
   * @param {string} colorScheme - Color scheme to use
   * @returns {string} Hex color code
   */
  const getColorInRange = (value, min, max, colorScheme = CONFIG.DEFAULTS.VISUALIZATION.COLOR_SCHEME) => {
    // Default to blues if scheme doesn't exist
    const scheme = CONFIG.COLORS.SCHEMES[colorScheme.toUpperCase()] || CONFIG.COLORS.SCHEMES.BLUES;
    
    if (min === max) {
      return scheme[Math.floor(scheme.length / 2)];
    }
    
    // Normalize value to 0-1 range
    const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    // Map to color index
    const index = Math.min(scheme.length - 1, Math.floor(normalizedValue * scheme.length));
    
    return scheme[index];
  };

  /**
   * Shows a loading indicator
   * @param {string} message - Message to display
   */
  const showLoading = (message = 'Loading...') => {
    const loadingEl = document.getElementById('loadingIndicator');
    const messageEl = document.getElementById('loadingMessage');
    
    if (messageEl) {
      messageEl.textContent = message;
    }
    
    if (loadingEl) {
      loadingEl.classList.remove('d-none');
    }
  };

  /**
   * Hides the loading indicator
   */
  const hideLoading = () => {
    const loadingEl = document.getElementById('loadingIndicator');
    
    if (loadingEl) {
      loadingEl.classList.add('d-none');
    }
  };

  /**
   * Creates a DOM element
   * @param {string} tag - Tag name for the element
   * @param {Object} attributes - Attributes to set on the element
   * @param {string|Node|Array} children - Child element(s) or text
   * @returns {HTMLElement} Created element
   */
  const createElement = (tag, attributes = {}, children = null) => {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'class' || key === 'className') {
        element.className = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Event handlers
        const eventName = key.substring(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Add children
    if (children) {
      if (Array.isArray(children)) {
        children.forEach(child => {
          if (child) {
            element.appendChild(
              typeof child === 'string' ? document.createTextNode(child) : child
            );
          }
        });
      } else {
        element.appendChild(
          typeof children === 'string' ? document.createTextNode(children) : children
        );
      }
    }
    
    return element;
  };

  /**
   * Parses URL query parameters
   * @returns {Object} Object containing parsed parameters
   */
  const parseQueryParams = () => {
    const params = {};
    const query = window.location.search.substring(1);
    
    if (query) {
      query.split('&').forEach(part => {
        const item = part.split('=');
        params[decodeURIComponent(item[0])] = decodeURIComponent(item[1] || '');
      });
    }
    
    return params;
  };

  /**
   * Shows an error message to the user
   * @param {string} message - Error message to display
   * @param {Error} error - Optional error object
   */
  const showError = (message, error = null) => {
    console.error('Error:', message, error);
    
    // Create error toast
    const toastContainer = document.getElementById('toastContainer') || 
      createElement('div', { id: 'toastContainer', class: 'toast-container position-fixed bottom-0 end-0 p-3' });
    
    if (!document.getElementById('toastContainer')) {
      document.body.appendChild(toastContainer);
    }
    
    const toastId = `toast-${Date.now()}`;
    const toast = createElement('div', {
      id: toastId,
      class: 'toast',
      role: 'alert',
      'aria-live': 'assertive',
      'aria-atomic': 'true'
    });
    
    const toastHeader = createElement('div', { class: 'toast-header bg-danger text-white' }, [
      createElement('strong', { class: 'me-auto' }, 'Error'),
      createElement('button', {
        type: 'button',
        class: 'btn-close btn-close-white',
        'data-bs-dismiss': 'toast',
        'aria-label': 'Close'
      })
    ]);
    
    const toastBody = createElement('div', { class: 'toast-body' }, message);
    
    toast.appendChild(toastHeader);
    toast.appendChild(toastBody);
    toastContainer.appendChild(toast);
    
    // Initialize and show toast
    const bootstrapToast = new bootstrap.Toast(toast);
    bootstrapToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
  };

  /**
   * Generates a unique ID
   * @param {string} prefix - Optional prefix for the ID
   * @returns {string} Unique ID
   */
  const generateId = (prefix = 'id-') => {
    return `${prefix}${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  };

  /**
   * Checks if a value is empty (null, undefined, empty string, empty array)
   * @param {*} value - Value to check
   * @returns {boolean} True if empty, false otherwise
   */
  const isEmpty = (value) => {
    if (value === null || value === undefined) {
      return true;
    }
    
    if (typeof value === 'string') {
      return value.trim() === '';
    }
    
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    
    return false;
  };

  /**
   * Truncates text to a specified length
   * @param {string} text - Text to truncate
   * @param {number} length - Maximum length
   * @param {string} suffix - Suffix to add if truncated
   * @returns {string} Truncated text
   */
  const truncateText = (text, length = 100, suffix = '...') => {
    if (!text) {
      return '';
    }
    
    if (text.length <= length) {
      return text;
    }
    
    return text.substring(0, length - suffix.length) + suffix;
  };

  /**
   * Creates a web worker from a function
   * @param {Function} workerFunction - Function to execute in the worker
   * @returns {Worker} Web worker
   */
  const createWorker = (workerFunction) => {
    const blob = new Blob([`(${workerFunction.toString()})()`], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    return new Worker(url);
  };

  /**
   * Formats a number with commas for thousands
   * @param {number} value - Number to format
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted number
   */
  const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }
    
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  /**
   * Calculates statistical significance using z-test
   * @param {number} p1 - Proportion 1
   * @param {number} n1 - Sample size 1
   * @param {number} p2 - Proportion 2
   * @param {number} n2 - Sample size 2
   * @param {number} confidenceLevel - Confidence level (e.g., 0.95)
   * @returns {boolean} True if statistically significant
   */
  const isStatisticallySignificant = (p1, n1, p2, n2, confidenceLevel = 0.95) => {
    if (n1 < 5 || n2 < 5) {
      return false; // Too small samples
    }
    
    // Calculate Z-score
    const p = (p1 * n1 + p2 * n2) / (n1 + n2);
    const standardError = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
    
    if (standardError === 0) {
      return false;
    }
    
    const zScore = Math.abs((p1 - p2) / standardError);
    
    // Critical z-value for two-tailed test
    const criticalZValue = 1.96; // For 95% confidence
    
    return zScore > criticalZValue;
  };

  /**
   * Calculates confidence interval for a proportion
   * @param {number} p - Proportion
   * @param {number} n - Sample size
   * @param {number} confidenceLevel - Confidence level (default 0.95)
   * @returns {Array} Lower and upper bounds of confidence interval
   */
  const calculateConfidenceInterval = (p, n, confidenceLevel = 0.95) => {
    if (n === 0) {
      return [0, 0];
    }
    
    // Z-value for confidence level (1.96 for 95%)
    const zValue = 1.96;
    
    const marginOfError = zValue * Math.sqrt((p * (1 - p)) / n);
    
    return [
      Math.max(0, p - marginOfError),
      Math.min(1, p + marginOfError)
    ];
  };

  // Public interface
  return {
    debounce,
    throttle,
    formatPercentage,
    formatCurrency,
    formatDate,
    formatNumber,
    getColorInRange,
    showLoading,
    hideLoading,
    createElement,
    parseQueryParams,
    showError,
    generateId,
    isEmpty,
    truncateText,
    createWorker,
    isStatisticallySignificant,
    calculateConfidenceInterval
  };
})();
