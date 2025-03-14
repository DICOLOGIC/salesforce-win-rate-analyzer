/**
 * Clustering module for Win Rate Analyzer
 * Handles dimension clustering visualization and interaction
 */

const Clustering = (function() {
    // Private variables
    let clusteringData = {};
    let selectedTimePeriod = 'last_90_days';
    let selectedDimensions = [];
    let charts = {};
    let clusteringWorker = null;
    let pcaData = null;
    
    /**
     * Initialize the module
     */
    function initialize() {
        // Initialize the worker
        initializeWorker();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        loadClusteringData();
    }
    
    /**
     * Initialize the clustering worker
     */
    function initializeWorker() {
        try {
            clusteringWorker = new Worker('./js/workers/clusteringWorker.js');
            
            // Set up event listener for worker messages
            clusteringWorker.addEventListener('message', handleWorkerMessage);
        } catch (error) {
            console.error('Failed to initialize clustering worker:', error);
            showError('Failed to initialize clustering analysis. Browser may not support Web Workers.');
        }
    }
    
    /**
     * Handle messages from the worker
     * @param {MessageEvent} event - Message event from worker
     */
    function handleWorkerMessage(event) {
        const { success, id, result, error } = event.data;
        
        if (!success) {
            console.error('Worker error:', error);
            showError(`Analysis error: ${error}`);
            showLoading(false);
            return;
        }
        
        // Handle different worker responses based on id
        switch (id) {
            case 'kmeans_clustering':
                handleKMeansResult(result);
                break;
                
            case 'dimensionality_reduction':
                handlePCAResult(result);
                break;
                
            case 'cluster_analysis':
                handleClusterAnalysisResult(result);
                break;
                
            default:
                console.warn('Unknown worker response id:', id);
        }
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Time period selector
        document.getElementById('clustering-time-period-selector').addEventListener('change', function(e) {
            selectedTimePeriod = e.target.value;
            loadClusteringData();
        });
        
        // Run clustering button
        document.getElementById('run-clustering-analysis').addEventListener('click', function() {
            runClusteringAnalysis();
        });
        
        // Clustering params form
        document.getElementById('clustering-params-form').addEventListener('submit', function(e) {
            e.preventDefault();
            runClusteringAnalysis();
        });
        
        // Export clusters button
        document.getElementById('export-clusters').addEventListener('click', function() {
            exportClustersData();
        });
        
        // Window resize event for responsive charts
        window.addEventListener('resize', Utils.debounce(function() {
            resizeCharts();
        }, 250));
        
        // Listen for auth state changes
        Utils.eventBus.subscribe('auth:stateChanged', function(isAuthenticated) {
            if (isAuthenticated) {
                loadClusteringData();
            } else {
                clearClustering();
            }
        });
    }
    
    /**
     * Load clustering data from API
     */
    function loadClusteringData() {
        showLoading(true);
        
        API.getClusteringData(selectedTimePeriod)
            .then(function(data) {
                clusteringData = data;
                renderClusteringInterface();
                showLoading(false);
            })
            .catch(function(error) {
                console.error('Error loading clustering data:', error);
                showError('Failed to load clustering data. Please try again.');
                showLoading(false);
            });
    }
    
    /**
     * Render clustering interface
     */
    function renderClusteringInterface() {
        // Clear existing content
        clearClustering();
        
        // Render dimension selection
        renderDimensionSelection();
        
        // Render clusters if we have them
        if (clusteringData.clusters) {
            renderClusterResults();
        }
    }
    
    /**
     * Render dimension selection interface
     */
    function renderDimensionSelection() {
        const container = document.getElementById('dimension-selection-clustering');
        
        if (!clusteringData.dimensions || clusteringData.dimensions.length === 0) {
            container.innerHTML = '<p>No dimensions available for clustering.</p>';
            return;
        }
        
        // Create HTML for dimension selection
        let html = `
            <h3>Select Dimensions for Clustering</h3>
            <p>Choose the dimensions you want to include in the clustering analysis.</p>
            <div class="dimension-selection-grid">
        `;
        
        // Add checkbox for each dimension
        clusteringData.dimensions.forEach(dimension => {
            html += `
                <div class="dimension-checkbox-container">
                    <input type="checkbox" class="dimension-clustering-checkbox" 
                        id="cluster-${dimension.id}" value="${dimension.id}" 
                        ${dimension.recommended ? 'checked' : ''}>
                    <label for="cluster-${dimension.id}">${formatDimensionName(dimension.name)}</label>
                    ${dimension.recommended ? '<span class="recommended-badge">Recommended</span>' : ''}
                </div>
            `;
        });
        
        html += `
            </div>
            <div class="clustering-options">
                <h4>Clustering Options</h4>
                <form id="clustering-params-form">
                    <div class="form-group">
                        <label for="num-clusters">Number of Clusters</label>
                        <select id="num-clusters" class="form-control">
                            <option value="2">2</option>
                            <option value="3" selected>3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="clustering-method">Clustering Method</label>
                        <select id="clustering-method" class="form-control">
                            <option value="kmeans" selected>K-Means</option>
                            <option value="hierarchical">Hierarchical</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary" id="run-clustering-analysis">
                        Run Clustering Analysis
                    </button>
                </form>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    /**
     * Run clustering analysis
     */
    function runClusteringAnalysis() {
        // Show loading state
        showLoading(true);
        
        // Get selected dimensions
        const selectedDimensions = getSelectedDimensions();
        
        if (selectedDimensions.length < 2) {
            showError('Please select at least two dimensions for clustering.');
            showLoading(false);
            return;
        }
        
        // Get clustering options
        const numClusters = parseInt(document.getElementById('num-clusters').value);
        const clusteringMethod = document.getElementById('clustering-method').value;
        
        // Prepare data for clustering
        const clusteringDataPoints = prepareClusteringData(selectedDimensions);
        
        // Perform dimensionality reduction first if we have more than 2 dimensions
        if (selectedDimensions.length > 2) {
            clusteringWorker.postMessage({
                action: 'dimensionality_reduction',
                id: 'dimensionality_reduction',
                data: {
                    points: clusteringDataPoints.points,
                    dimensions: 2 // Reduce to 2D for visualization
                }
            });
        } else {
            // We can proceed directly to clustering
            performClustering(clusteringDataPoints, numClusters, clusteringMethod);
        }
    }
    
    /**
     * Perform clustering after data preparation
     * @param {Object} data - Prepared clustering data
     * @param {number} numClusters - Number of clusters
     * @param {string} method - Clustering method
     */
    function performClustering(data, numClusters, method) {
        // Send clustering request to worker
        if (method === 'kmeans') {
            clusteringWorker.postMessage({
                action: 'kmeans_clustering',
                id: 'kmeans_clustering',
                data: {
                    points: data.points,
                    k: numClusters,
                    maxIterations: 100
                }
            });
        } else if (method === 'hierarchical') {
            clusteringWorker.postMessage({
                action: 'hierarchical_clustering',
                id: 'hierarchical_clustering',
                data: {
                    points: data.points,
                    maxClusters: numClusters,
                    linkageMethod: 'average'
                }
            });
        }
    }
    
    /**
     * Get selected dimensions from checkboxes
     * @returns {Array} Array of selected dimension IDs
     */
    function getSelectedDimensions() {
        const checkboxes = document.querySelectorAll('.dimension-clustering-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    /**
     * Prepare data for clustering analysis
     * @param {Array} selectedDimensions - IDs of selected dimensions
     * @returns {Object} Prepared clustering data
     */
    function prepareClusteringData(selectedDimensions) {
        // Filter opportunities data to include only selected dimensions
        const opportunities = clusteringData.opportunities || [];
        const dimensionMap = {};
        
        clusteringData.dimensions.forEach(dim => {
            if (selectedDimensions.includes(dim.id)) {
                dimensionMap[dim.id] = dim;
            }
        });
        
        // Prepare points array
        const points = [];
        const originalData = [];
        const opportunityIds = [];
        
        opportunities.forEach(opp => {
            const point = [];
            
            selectedDimensions.forEach(dimId => {
                // Handle different data types appropriately
                const dimension = dimensionMap[dimId];
                const value = opp.dimensions[dimId];
                
                if (dimension.type === 'categorical') {
                    // For categorical variables, we'd need encoding
                    // This is a simplified approach
                    point.push(dimension.categories.indexOf(value));
                } else {
                    // For numerical variables, use the value directly
                    point.push(parseFloat(value) || 0);
                }
            });
            
            points.push(point);
            originalData.push({
                ...opp,
                point
            });
            opportunityIds.push(opp.id);
        });
        
        return {
            points,
            originalData,
            opportunityIds,
            dimensions: selectedDimensions.map(id => dimensionMap[id])
        };
    }
    
    /**
     * Handle PCA result from worker
     * @param {Object} result - PCA result
     */
    function handlePCAResult(result) {
        // Store PCA data for later use
        pcaData = result;
        
        // Get clustering options
        const numClusters = parseInt(document.getElementById('num-clusters').value);
        const clusteringMethod = document.getElementById('clustering-method').value;
        
        // We now have reduced data, proceed to clustering
        const selectedDimensions = getSelectedDimensions();
        const clusteringDataPoints = prepareClusteringData(selectedDimensions);
        
        // Replace original points with reduced points
        clusteringDataPoints.points = result.reducedData;
        
        // Perform clustering on reduced data
        performClustering(clusteringDataPoints, numClusters, clusteringMethod);
    }
    
    /**
     * Handle K-means clustering result from worker
     * @param {Object} result - K-means result
     */
    function handleKMeansResult(result) {
        // Store clustering results in data
        clusteringData.clusters = result.clusters;
        clusteringData.centroids = result.centroids;
        clusteringData.clusterMetrics = {
            silhouetteScore: result.silhouetteScore,
            withinClusterDistances: result.withinClusterDistances
        };
        
        // Prepare data for cluster analysis
        const selectedDimensions = getSelectedDimensions();
        const clusteringDataPoints = prepareClusteringData(selectedDimensions);
        
        // Run cluster analysis to get insights
        clusteringWorker.postMessage({
            action: 'cluster_analysis',
            id: 'cluster_analysis',
            data: {
                clusters: result.clusters,
                originalData: clusteringDataPoints.originalData,
                dimensions: clusteringDataPoints.dimensions.map(d => d.name)
            }
        });
    }
    
    /**
     * Handle cluster analysis result from worker
     * @param {Object} result - Cluster analysis result
     */
    function handleClusterAnalysisResult(result) {
        // Store cluster analysis results
        clusteringData.clusterAnalysis = result.clusterAnalysis;
        
        // Render the clustering results
        renderClusterResults();
        
        // Hide loading state
        showLoading(false);
    }
    
    /**
     * Render clustering results
     */
    function renderClusterResults() {
        const container = document.getElementById('cluster-results');
        
        if (!clusteringData.clusters || !clusteringData.clusterAnalysis) {
            container.innerHTML = '<p>No clustering results available. Run an analysis to see results.</p>';
            return;
        }
        
        // Create HTML structure for results
        let html = `
            <div class="cluster-viz-container">
                <h3>Cluster Visualization</h3>
                <canvas id="cluster-scatter-plot"></canvas>
            </div>
            
            <div class="cluster-metrics">
                <h3>Clustering Metrics</h3>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h4>Silhouette Score</h4>
                        <p class="metric-value">${clusteringData.clusterMetrics.silhouetteScore.toFixed(3)}</p>
                        <p class="metric-note">Values close to 1 indicate well-defined clusters</p>
                    </div>
                    <div class="metric-card">
                        <h4>Number of Clusters</h4>
                        <p class="metric-value">${clusteringData.clusters.length}</p>
                    </div>
                </div>
            </div>
            
            <div class="cluster-details">
                <h3>Cluster Analysis</h3>
                <div class="cluster-tabs">
                    <div class="tabs-header">
        `;
        
        // Add tab headers
        clusteringData.clusterAnalysis.forEach((cluster, index) => {
            html += `
                <div class="tab-header ${index === 0 ? 'active' : ''}" data-tab="cluster-${index}">
                    Cluster ${index + 1} (${cluster.size})
                </div>
            `;
        });
        
        html += `
                    </div>
                    <div class="tabs-content">
        `;
        
        // Add tab content
        clusteringData.clusterAnalysis.forEach((cluster, index) => {
            html += `
                <div class="tab-content ${index === 0 ? 'active' : ''}" id="cluster-${index}-content">
                    <div class="cluster-summary">
                        <h4>Cluster ${index + 1} Summary</h4>
                        <p>Size: ${cluster.size} opportunities</p>
                        <p>Cohesion: ${cluster.cohesion.toFixed(3)}</p>
                        ${cluster.winRateInfo ? 
                            `<p>Win Rate: ${Utils.formatPercentage(cluster.winRateInfo.average)}</p>` : ''}
                    </div>
                    
                    <div class="cluster-dimensions">
                        <h4>Distinctive Dimensions</h4>
                        <div class="dimension-bars-container">
                            <canvas id="cluster-${index}-dimensions"></canvas>
                        </div>
                    </div>
                    
                    <div class="cluster-opportunities">
                        <h4>Sample Opportunities</h4>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Stage</th>
                                    <th>Amount</th>
                                    <th>Win Probability</th>
                                </tr>
                            </thead>
                            <tbody id="cluster-${index}-opportunities">
                                <!-- Will be populated with sample opportunities -->
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
            
            <div class="action-buttons">
                <button class="btn btn-primary" id="export-clusters">Export Clusters</button>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Create scatter plot
        createClusterScatterPlot();
        
        // Create dimension importance charts for each cluster
        clusteringData.clusterAnalysis.forEach((cluster, index) => {
            createClusterDimensionChart(cluster, index);
        });
        
        // Populate sample opportunities for each cluster
        populateSampleOpportunities();
        
        // Add tab switching functionality
        setupTabSwitching();
    }
    
    /**
     * Create cluster scatter plot
     */
    function createClusterScatterPlot() {
        const ctx = document.getElementById('cluster-scatter-plot').getContext('2d');
        
        // Prepare data for scatter plot
        const datasets = [];
        const selectedDimensions = getSelectedDimensions();
        const clusteringDataPoints = prepareClusteringData(selectedDimensions);
        
        // Use PCA data if available, otherwise use first two dimensions
        const pointsToPlot = pcaData ? pcaData.reducedData : clusteringDataPoints.points;
        
        // Define colors for clusters
        const clusterColors = [
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(255, 205, 86, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)',
            'rgba(201, 203, 207, 0.7)'
        ];
        
        // Create dataset for each cluster
        clusteringData.clusters.forEach((clusterPoints, clusterIndex) => {
            const data = clusterPoints.map(pointIndex => ({
                x: pointsToPlot[pointIndex][0],
                y: pointsToPlot[pointIndex].length > 1 ? pointsToPlot[pointIndex][1] : 0
            }));
            
            datasets.push({
                label: `Cluster ${clusterIndex + 1}`,
                data: data,
                backgroundColor: clusterColors[clusterIndex % clusterColors.length],
                borderColor: clusterColors[clusterIndex % clusterColors.length].replace('0.7', '1'),
                borderWidth: 1,
                pointRadius: 5,
                pointHoverRadius: 7
            });
        });
        
        // Add centroids if available
        if (clusteringData.centroids) {
            const centroidData = clusteringData.centroids.map((centroid, i) => ({
                x: centroid[0],
                y: centroid.length > 1 ? centroid[1] : 0,
                label: `Centroid ${i + 1}`
            }));
            
            datasets.push({
                label: 'Centroids',
                data: centroidData,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderColor: 'rgba(0, 0, 0, 1)',
                borderWidth: 1,
                pointRadius: 7,
                pointStyle: 'triangle',
                pointHoverRadius: 9
            });
        }
        
        // Create chart
        charts['clusterScatter'] = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: pcaData ? 'Principal Component 1' : formatDimensionName(clusteringDataPoints.dimensions[0].name)
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: pcaData ? 'Principal Component 2' : 
                                  (clusteringDataPoints.dimensions.length > 1 ? 
                                   formatDimensionName(clusteringDataPoints.dimensions[1].name) : '')
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const datasetLabel = context.dataset.label || '';
                                const dataPoint = context.raw;
                                if (context.dataset.label === 'Centroids') {
                                    return dataPoint.label;
                                }
                                return `${datasetLabel}: (${dataPoint.x.toFixed(2)}, ${dataPoint.y.toFixed(2)})`;
                            }
                        }
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    /**
     * Create dimension importance chart for a cluster
     * @param {Object} cluster - Cluster data
     * @param {number} index - Cluster index
     */
    function createClusterDimensionChart(cluster, index) {
        const ctx = document.getElementById(`cluster-${index}-dimensions`).getContext('2d');
        
        // Sort dimensions by distinctiveness
        const sortedDimensions = [...cluster.distinctiveDimensions]
            .sort((a, b) => b.distinctiveness - a.distinctiveness);
        
        // Take top 5 dimensions
        const topDimensions = sortedDimensions.slice(0, 5);
        
        // Prepare data
        const labels = topDimensions.map(d => formatDimensionName(d.dimension));
        const values = topDimensions.map(d => d.distinctiveness * 100);
        const backgroundColors = values.map(v => v >= 0 ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)');
        
        // Create chart
        charts[`clusterDim${index}`] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Distinctiveness',
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(c => c.replace('0.7', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Distinctiveness (%)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `Distinctiveness: ${value.toFixed(1)}%`;
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    /**
     * Populate sample opportunities for each cluster
     */
    function populateSampleOpportunities() {
        // Get opportunity data
        const opportunities = clusteringData.opportunities || [];
        
        // For each cluster, display a few sample opportunities
        clusteringData.clusters.forEach((clusterPoints, clusterIndex) => {
            const container = document.getElementById(`cluster-${clusterIndex}-opportunities`);
            
            // Take up to 5 opportunities from this cluster
            const sampleIndices = clusterPoints.slice(0, 5);
            
            // Create HTML for each opportunity
            let html = '';
            sampleIndices.forEach(index => {
                const opp = opportunities[index];
                html += `
                    <tr data-opp-id="${opp.id}">
                        <td>${opp.name}</td>
                        <td>${opp.stage}</td>
                        <td>${Utils.formatNumber(opp.amount, 2)}</td>
                        <td>
                            <div class="progress-bar">
                                <div class="progress" style="width: ${opp.winProbability * 100}%"></div>
                                <span>${Utils.formatPercentage(opp.winProbability)}</span>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            container.innerHTML = html;
            
            // Add click handlers for rows
            const rows = container.querySelectorAll('tr');
            rows.forEach(row => {
                row.addEventListener('click', function() {
                    const oppId = this.getAttribute('data-opp-id');
                    if (oppId) {
                        Utils.eventBus.publish('opportunity:selected', oppId);
                    }
                });
            });
        });
    }
    
    /**
     * Set up tab switching functionality
     */
    function setupTabSwitching() {
        const tabHeaders = document.querySelectorAll('.tab-header');
        
        tabHeaders.forEach(header => {
            header.addEventListener('click', function() {
                // Remove active class from all headers and contents
                document.querySelectorAll('.tab-header').forEach(h => h.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked header
                this.classList.add('active');
                
                // Get tab ID and activate corresponding content
                const tabId = this.getAttribute('data-tab');
                document.getElementById(`${tabId}-content`).classList.add('active');
            });
        });
    }
    
    /**
     * Export clusters data
     */
    function exportClustersData() {
        if (!clusteringData.clusters || !clusteringData.clusterAnalysis) {
            showError('No clustering results to export. Run an analysis first.');
            return;
        }
        
        // Create CSV content
        const csvContent = generateClustersCSV();
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `opportunity-clusters-${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Generate CSV content for clusters export
     * @returns {string} CSV content
     */
    function generateClustersCSV() {
        const opportunities = clusteringData.opportunities || [];
        const selectedDimensions = getSelectedDimensions();
        
        // Create header row
        let csv = 'Opportunity ID,Name,Cluster,Amount,Stage,Win Probability';
        
        // Add selected dimensions to header
        selectedDimensions.forEach(dimId => {
            const dimension = clusteringData.dimensions.find(d => d.id === dimId);
            if (dimension) {
                csv += `,${formatDimensionName(dimension.name)}`;
            }
        });
        
        csv += '\n';
        
        // Add data rows
        clusteringData.clusters.forEach((clusterPoints, clusterIndex) => {
            clusterPoints.forEach(pointIndex => {
                const opp = opportunities[pointIndex];
                
                // Basic opportunity info
                csv += `${opp.id},${opp.name},${clusterIndex + 1},${opp.amount},${opp.stage},${opp.winProbability}`;
                
                // Add dimension values
                selectedDimensions.forEach(dimId => {
                    csv += `,${opp.dimensions[dimId]}`;
                });
                
                csv += '\n';
            });
        });
        
        return csv;
    }
    
    /**
     * Format dimension name for display
     * @param {string} dimension - Dimension name
     * @returns {string} Formatted dimension name
     */
    function formatDimensionName(dimension) {
        // Convert camelCase or snake_case to Title Case
        return dimension
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, str => str.toUpperCase());
    }
    
    /**
     * Show or hide loading indicator
     * @param {boolean} show - Whether to show loading indicator
     */
    function showLoading(show) {
        const loadingElement = document.getElementById('clustering-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to show
     */
    function showError(message) {
        const errorElement = document.getElementById('clustering-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Hide after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
    }
    
    /**
     * Clear all clustering elements
     */
    function clearClustering() {
        // Destroy existing charts
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        charts = {};
        
        // Clear containers
        document.getElementById('dimension-selection-clustering').innerHTML = '';
        document.getElementById('cluster-results').innerHTML = '';
    }
    
    /**
     * Resize charts when window size changes
     */
    function resizeCharts() {
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
    }
    
    // Public API
    return {
        initialize,
        loadClusteringData
    };
})();

// Export for use in other modules
window.Clustering = Clustering;
