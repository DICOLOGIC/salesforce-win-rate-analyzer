/**
 * Analytics Service
 * Provides core analytical functionality for win rate analysis
 */

const jStat = require('jStat').jStat;
const math = require('mathjs');
const { preprocessData, encodeCategories } = require('../utils/dataProcessingUtils');

/**
 * Performs multivariate regression analysis on opportunity data
 * @param {Array} opportunities - Array of opportunity objects
 * @param {Array} dimensions - Array of dimension names to analyze
 * @param {String} targetVariable - The target variable (usually 'IsWon')
 * @returns {Object} Regression analysis results
 */
const performMultivariateRegression = (opportunities, dimensions, targetVariable = 'IsWon') => {
  try {
    // Preprocess the data
    const preprocessedData = preprocessData(opportunities, dimensions, targetVariable);
    
    // Extract X (features) and y (target) matrices
    const X = preprocessedData.X;
    const y = preprocessedData.y;
    
    // Add constant term for intercept
    const Xwith1s = X.map(row => [1, ...row]);
    
    // Calculate the regression coefficients: β = (X'X)^(-1)X'y
    const Xt = math.transpose(Xwith1s);
    const XtX = math.multiply(Xt, Xwith1s);
    const XtX_inv = math.inv(XtX);
    const Xty = math.multiply(Xt, y);
    const beta = math.multiply(XtX_inv, Xty);
    
    // Calculate predicted values
    const yPred = math.multiply(Xwith1s, beta);
    
    // Calculate residuals
    const residuals = math.subtract(y, yPred);
    
    // Calculate R-squared
    const TSS = math.sum(math.map(y, val => math.pow(val - math.mean(y), 2)));
    const RSS = math.sum(math.map(residuals, val => math.pow(val, 2)));
    const rSquared = 1 - (RSS / TSS);
    
    // Calculate standard errors
    const n = y.length;
    const p = dimensions.length + 1; // +1 for intercept
    const sigma2 = RSS / (n - p);
    const se = math.map(math.diag(XtX_inv), val => Math.sqrt(val * sigma2));
    
    // Calculate t-values and p-values
    const tValues = beta.map((b, i) => b / se[i]);
    const pValues = tValues.map(t => 2 * (1 - jStat.studentt.cdf(Math.abs(t), n - p)));
    
    // Calculate confidence intervals (95%)
    const tCritical = jStat.studentt.inv(0.975, n - p);
    const confidenceIntervals = beta.map((b, i) => [
      b - tCritical * se[i],
      b + tCritical * se[i]
    ]);
    
    // Format the results
    const dimensionsWithIntercept = ['intercept', ...dimensions];
    const coefficients = dimensionsWithIntercept.map((dim, i) => ({
      dimension: dim,
      coefficient: beta[i],
      standardError: se[i],
      tValue: tValues[i],
      pValue: pValues[i],
      confidenceInterval: confidenceIntervals[i],
      isSignificant: pValues[i] < 0.05
    }));
    
    return {
      coefficients,
      rSquared,
      adjustedRSquared: 1 - ((1 - rSquared) * (n - 1) / (n - p - 1)),
      observations: n,
      dimensions: p - 1, // Exclude intercept
      residualStandardError: Math.sqrt(sigma2),
      targetVariable
    };
  } catch (error) {
    console.error('Error in multivariate regression:', error);
    throw new Error(`Failed to perform regression analysis: ${error.message}`);
  }
};

/**
 * Performs dimension clustering to identify patterns
 * @param {Array} opportunities - Array of opportunity objects
 * @param {Array} dimensions - Array of dimension names to cluster
 * @param {Number} k - Number of clusters to create
 * @returns {Object} Clustering results
 */
const performDimensionClustering = (opportunities, dimensions, k = 3) => {
  try {
    // Preprocess the data
    const data = preprocessData(opportunities, dimensions);
    
    // Extract feature matrix
    const features = data.X;
    
    // Initialize k random centroids
    let centroids = [];
    for (let i = 0; i < k; i++) {
      centroids.push(
        features[Math.floor(Math.random() * features.length)]
      );
    }
    
    // K-means clustering algorithm
    const MAX_ITERATIONS = 100;
    let clusters = [];
    let converged = false;
    let iterations = 0;
    
    while (!converged && iterations < MAX_ITERATIONS) {
      // Assign each point to nearest centroid
      clusters = Array(k).fill().map(() => []);
      
      features.forEach((point, pointIndex) => {
        let minDistance = Infinity;
        let closestCentroid = 0;
        
        centroids.forEach((centroid, centroidIndex) => {
          const distance = math.distance(point, centroid);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = centroidIndex;
          }
        });
        
        clusters[closestCentroid].push({
          point,
          originalIndex: pointIndex,
          opportunity: opportunities[pointIndex]
        });
      });
      
      // Calculate new centroids
      const newCentroids = clusters.map(cluster => {
        if (cluster.length === 0) return centroids[0]; // Avoid empty clusters
        
        const points = cluster.map(item => item.point);
        return points[0].map((_, dim) => 
          math.mean(points.map(point => point[dim]))
        );
      });
      
      // Check convergence
      const centroidShift = math.sum(
        centroids.map((centroid, i) => 
          math.distance(centroid, newCentroids[i])
        )
      );
      
      converged = centroidShift < 0.001;
      centroids = newCentroids;
      iterations++;
    }
    
    // Calculate cluster statistics
    const clusterStats = clusters.map((cluster, i) => {
      const winRates = cluster.map(item => 
        item.opportunity.IsWon ? 1 : 0
      );
      
      return {
        id: i,
        size: cluster.length,
        winRate: math.mean(winRates) || 0,
        opportunities: cluster.map(item => item.opportunity.Id)
      };
    });
    
    // Find representative dimensions for each cluster
    const representativeDimensions = clusters.map((cluster, clusterIndex) => {
      const clusterPoints = cluster.map(item => item.point);
      const otherPoints = features.filter((_, i) => 
        !cluster.some(item => item.originalIndex === i)
      );
      
      const dimensionImportance = dimensions.map((dim, dimIndex) => {
        const clusterValues = clusterPoints.map(point => point[dimIndex]);
        const otherValues = otherPoints.map(point => point[dimIndex]);
        
        const clusterMean = math.mean(clusterValues);
        const otherMean = math.mean(otherValues);
        const overallStd = math.std([...clusterValues, ...otherValues]);
        
        // Normalized difference as importance score
        const importance = Math.abs(clusterMean - otherMean) / (overallStd || 1);
        
        return {
          dimension: dim,
          importance,
          clusterMean,
          otherMean,
          difference: clusterMean - otherMean
        };
      });
      
      return {
        clusterId: clusterIndex,
        dimensions: dimensionImportance.sort((a, b) => b.importance - a.importance)
      };
    });
    
    return {
      clusters: clusterStats,
      representativeDimensions,
      iterations,
      converged,
      k
    };
  } catch (error) {
    console.error('Error in dimension clustering:', error);
    throw new Error(`Failed to perform dimension clustering: ${error.message}`);
  }
};

/**
 * Generates a lookup table for win rates by dimension combinations
 * @param {Array} opportunities - Array of opportunity objects
 * @param {Array} dimensions - Array of dimensions to use
 * @param {Number} maxCombinations - Maximum number of combinations to include
 * @returns {Object} Lookup table results
 */
const generateWinRateLookupTable = (opportunities, dimensions, maxCombinations = 1000) => {
  try {
    // Generate all possible combinations of dimension values
    const dimensionValues = {};
    dimensions.forEach(dim => {
      dimensionValues[dim] = [...new Set(opportunities.map(opp => opp[dim]))];
    });
    
    // Calculate total possible combinations
    const totalCombinations = Object.values(dimensionValues)
      .reduce((acc, values) => acc * values.length, 1);
    
    // If too many combinations, select only the most frequent values
    let selectedDimensionValues = dimensionValues;
    if (totalCombinations > maxCombinations) {
      selectedDimensionValues = {};
      dimensions.forEach(dim => {
        // Count frequency of each value
        const valueCounts = {};
        opportunities.forEach(opp => {
          const value = opp[dim];
          valueCounts[value] = (valueCounts[value] || 0) + 1;
        });
        
        // Sort by frequency and take top values
        const sortedValues = Object.entries(valueCounts)
          .sort((a, b) => b[1] - a[1])
          .map(entry => entry[0]);
        
        // Limit to keep combinations under maxCombinations
        const valueLimit = Math.max(
          2, 
          Math.floor(Math.pow(maxCombinations, 1/dimensions.length))
        );
        selectedDimensionValues[dim] = sortedValues.slice(0, valueLimit);
      });
    }
    
    // Generate the lookup table
    const lookupTable = [];
    
    // Helper function to generate combinations recursively
    const generateCombinations = (currentDimIndex, currentCombination, table) => {
      if (currentDimIndex >= dimensions.length) {
        // Calculate win rate for this combination
        const matchingOpps = opportunities.filter(opp => {
          return Object.entries(currentCombination).every(([dim, value]) => {
            return opp[dim] == value; // Use == for type coercion
          });
        });
        
        const wins = matchingOpps.filter(opp => opp.IsWon).length;
        const total = matchingOpps.length;
        const winRate = total > 0 ? (wins / total) * 100 : 0;
        
        // Calculate confidence interval
        let confidenceInterval = null;
        if (total > 0) {
          const z = 1.96; // 95% confidence
          const error = z * Math.sqrt((winRate/100 * (1 - winRate/100)) / total);
          confidenceInterval = [
            Math.max(0, winRate - error * 100),
            Math.min(100, winRate + error * 100)
          ];
        }
        
        table.push({
          ...currentCombination,
          winRate,
          sampleSize: total,
          confidenceInterval,
          isStatisticallySignificant: total >= 10 // Simple threshold
        });
        
        return;
      }
      
      const currentDim = dimensions[currentDimIndex];
      selectedDimensionValues[currentDim].forEach(value => {
        generateCombinations(
          currentDimIndex + 1,
          { ...currentCombination, [currentDim]: value },
          table
        );
      });
    };
    
    generateCombinations(0, {}, lookupTable);
    
    return {
      lookupTable,
      dimensions,
      totalCombinations: lookupTable.length,
      dimensionValues: selectedDimensionValues
    };
  } catch (error) {
    console.error('Error generating lookup table:', error);
    throw new Error(`Failed to generate win rate lookup table: ${error.message}`);
  }
};

module.exports = {
  performMultivariateRegression,
  performDimensionClustering,
  generateWinRateLookupTable
};