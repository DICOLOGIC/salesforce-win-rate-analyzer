/**
 * Dashboard module for Win Rate Analyzer
 * Handles dashboard visualization and interaction
 */

const Dashboard = (function() {
    // Private variables
    let dashboardData = {};
    let selectedTimePeriod = 'last_90_days';
    let selectedDimensions = [];
    let charts = {};
    
    /**
     * Initialize the dashboard
     */
    function initialize() {
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        loadDashboardData();
    }
    
    /**
     * Set up event listeners for dashboard controls
     */
    function setupEventListeners() {
        // Time period selector
        document.getElementById('time-period-selector').addEventListener('change', function(e) {
            selectedTimePeriod = e.target.value;
            loadDashboardData();
        });
        
        // Dimension selector
        const dimensionCheckboxes = document.querySelectorAll('.dimension-checkbox');
        dimensionCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                updateSelectedDimensions();
                updateDimensionCharts();
            });
        });
        
        // Refresh button
        document.getElementById('refresh-dashboard').addEventListener('click', function() {
            loadDashboardData();
        });
        
        // Export data button
        document.getElementById('export-dashboard-data').addEventListener('click', function() {
            exportDashboardData();
        });
        
        // Window resize event for responsive charts
        window.addEventListener('resize', Utils.debounce(function() {
            resizeCharts();
        }, 250));
        
        // Listen for auth state changes
        Utils.eventBus.subscribe('auth:stateChanged', function(isAuthenticated) {
            if (isAuthenticated) {
                loadDashboardData();
            } else {
                // Clear dashboard if user is logged out
                clearDashboard();
            }
        });
    }
    
    /**
     * Update selected dimensions based on checkboxes
     */
    function updateSelectedDimensions() {
        const dimensionCheckboxes = document.querySelectorAll('.dimension-checkbox:checked');
        selectedDimensions = Array.from(dimensionCheckboxes).map(checkbox => checkbox.value);
    }
    
    /**
     * Load dashboard data from API
     */
    function loadDashboardData() {
        // Show loading state
        showLoading(true);
        
        // Get data from API
        API.getDashboardData(selectedTimePeriod)
            .then(function(data) {
                dashboardData = data;
                renderDashboard();
                showLoading(false);
            })
            .catch(function(error) {
                console.error('Error loading dashboard data:', error);
                showError('Failed to load dashboard data. Please try again.');
                showLoading(false);
            });
    }
    
    /**
     * Render dashboard with current data
     */
    function renderDashboard() {
        // Clear existing dashboard
        clearDashboard();
        
        // Render summary metrics
        renderSummaryMetrics();
        
        // Render win rate by dimension charts
        renderWinRateByDimensionCharts();
        
        // Render win rate trend chart
        renderWinRateTrendChart();
        
        // Render top opportunities
        renderTopOpportunities();
        
        // Check if we have dimension impact data
        if (dashboardData.dimensionImpact) {
            renderDimensionImpactSection();
        }
    }
    
    /**
     * Render summary metrics section
     */
    function renderSummaryMetrics() {
        const summaryContainer = document.getElementById('summary-metrics');
        
        if (!dashboardData.summary) {
            summaryContainer.innerHTML = '<p>No summary data available.</p>';
            return;
        }
        
        const summary = dashboardData.summary;
        
        // Create HTML for summary metrics
        const html = `
            <div class="metric-card">
                <h3>Overall Win Rate</h3>
                <p class="metric-value">${Utils.formatPercentage(summary.overallWinRate)}</p>
                <p class="metric-change ${summary.winRateChange >= 0 ? 'positive' : 'negative'}">
                    ${summary.winRateChange >= 0 ? '↑' : '↓'} ${Utils.formatPercentage(Math.abs(summary.winRateChange))}
                </p>
            </div>
            <div class="metric-card">
                <h3>Open Opportunities</h3>
                <p class="metric-value">${Utils.formatNumber(summary.openOpportunities)}</p>
                <p class="metric-secondary">Value: ${Utils.formatNumber(summary.openValue, 2)}</p>
            </div>
            <div class="metric-card">
                <h3>Avg Days to Close</h3>
                <p class="metric-value">${Utils.formatNumber(summary.avgDaysToClose, 1)}</p>
                <p class="metric-change ${summary.daysToCloseChange <= 0 ? 'positive' : 'negative'}">
                    ${summary.daysToCloseChange <= 0 ? '↓' : '↑'} ${Utils.formatNumber(Math.abs(summary.daysToCloseChange), 1)}
                </p>
            </div>
            <div class="metric-card">
                <h3>Closed Opportunities</h3>
                <p class="metric-value">${Utils.formatNumber(summary.closedOpportunities)}</p>
                <p class="metric-secondary">Won: ${Utils.formatNumber(summary.wonOpportunities)}</p>
            </div>
        `;
        
        summaryContainer.innerHTML = html;
    }
    
    /**
     * Render win rate by dimension charts
     */
    function renderWinRateByDimensionCharts() {
        const chartsContainer = document.getElementById('dimension-charts');
        
        if (!dashboardData.winRateByDimension || Object.keys(dashboardData.winRateByDimension).length === 0) {
            chartsContainer.innerHTML = '<p>No dimension data available.</p>';
            return;
        }
        
        // Clear container
        chartsContainer.innerHTML = '';
        
        // Get dimensions to display (either selected or all if none selected)
        const dimensionsToDisplay = selectedDimensions.length > 0 
            ? selectedDimensions 
            : Object.keys(dashboardData.winRateByDimension);
        
        // Create a chart for each dimension
        dimensionsToDisplay.forEach(dimension => {
            if (dashboardData.winRateByDimension[dimension]) {
                createDimensionChart(dimension, dashboardData.winRateByDimension[dimension], chartsContainer);
            }
        });
    }
    
    /**
     * Create a chart for a single dimension
     * @param {string} dimension - Dimension name
     * @param {Array} data - Dimension data
     * @param {HTMLElement} container - Container element
     */
    function createDimensionChart(dimension, data, container) {
        // Create chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h3>${formatDimensionName(dimension)}</h3>
            <canvas id="chart-${dimension}"></canvas>
        `;
        container.appendChild(chartContainer);
        
        // Prepare data for Chart.js
        const labels = data.map(item => item.value);
        const winRates = data.map(item => item.winRate * 100);
        const counts = data.map(item => item.count);
        
        // Create chart
        const ctx = document.getElementById(`chart-${dimension}`).getContext('2d');
        charts[dimension] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Win Rate (%)',
                        data: winRates,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Count',
                        data: counts,
                        type: 'line',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Win Rate (%)'
                        },
                        min: 0,
                        max: 100
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Count'
                        },
                        min: 0,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.raw;
                                if (context.datasetIndex === 0) {
                                    return `${label}: ${value.toFixed(1)}%`;
                                } else {
                                    return `${label}: ${value}`;
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Render win rate trend chart
     */
    function renderWinRateTrendChart() {
        const container = document.getElementById('win-rate-trend');
        
        if (!dashboardData.winRateTrend || dashboardData.winRateTrend.length === 0) {
            container.innerHTML = '<p>No trend data available.</p>';
            return;
        }
        
        // Create chart container
        container.innerHTML = '<canvas id="trend-chart"></canvas>';
        
        // Prepare data for Chart.js
        const labels = dashboardData.winRateTrend.map(item => item.period);
        const winRates = dashboardData.winRateTrend.map(item => item.winRate * 100);
        const counts = dashboardData.winRateTrend.map(item => item.count);
        
        // Create chart
        const ctx = document.getElementById('trend-chart').getContext('2d');
        charts['trend'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Win Rate (%)',
                        data: winRates,
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2,
                        tension: 0.1,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Opportunities',
                        data: counts,
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        tension: 0.1,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Win Rate (%)'
                        },
                        min: 0,
                        suggestedMax: 100
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Opportunity Count'
                        },
                        min: 0,
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Render top opportunities section
     */
    function renderTopOpportunities() {
        const container = document.getElementById('top-opportunities');
        
        if (!dashboardData.topOpportunities || dashboardData.topOpportunities.length === 0) {
            container.innerHTML = '<p>No opportunity data available.</p>';
            return;
        }
        
        // Create table
        const tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Stage</th>
                        <th>Amount</th>
                        <th>Close Date</th>
                        <th>Win Probability</th>
                    </tr>
                </thead>
                <tbody>
                    ${dashboardData.topOpportunities.map(opp => `
                        <tr>
                            <td>${opp.name}</td>
                            <td>${opp.stage}</td>
                            <td>${Utils.formatNumber(opp.amount, 2)}</td>
                            <td>${Utils.formatDate(opp.closeDate)}</td>
                            <td>
                                <div class="progress-bar">
                                    <div class="progress" style="width: ${opp.winProbability * 100}%"></div>
                                    <span>${Utils.formatPercentage(opp.winProbability)}</span>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = tableHtml;
        
        // Add click handler for opportunity rows
        const rows = container.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            row.addEventListener('click', function() {
                const opportunityId = dashboardData.topOpportunities[index].id;
                Utils.eventBus.publish('opportunity:selected', opportunityId);
            });
        });
    }
    
    /**
     * Render dimension impact section
     */
    function renderDimensionImpactSection() {
        const container = document.getElementById('dimension-impact');
        
        if (!dashboardData.dimensionImpact || dashboardData.dimensionImpact.dimensions.length === 0) {
            container.innerHTML = '<p>No dimension impact data available.</p>';
            return;
        }
        
        // Sort dimensions by impact
        const sortedDimensions = [...dashboardData.dimensionImpact.dimensions]
            .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
        
        // Create HTML
        const html = `
            <div class="impact-summary">
                <div class="metric-card">
                    <h3>Model Accuracy</h3>
                    <p class="metric-value">${Utils.formatPercentage(dashboardData.dimensionImpact.modelAccuracy)}</p>
                </div>
                <div class="metric-card">
                    <h3>Top Factor</h3>
                    <p class="metric-value">${formatDimensionName(sortedDimensions[0].name)}</p>
                    <p class="metric-secondary">Impact: ${Utils.formatPercentage(sortedDimensions[0].impact)}</p>
                </div>
            </div>
            
            <div class="impact-chart-container">
                <h3>Dimension Impact on Win Rate</h3>
                <canvas id="impact-chart"></canvas>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Create impact chart
        createImpactChart(sortedDimensions);
        
        // Add link to detailed analysis
        const linkContainer = document.createElement('div');
        linkContainer.className = 'text-center mt-3';
        linkContainer.innerHTML = `
            <button id="view-detailed-impact" class="btn btn-primary">
                View Detailed Impact Analysis
            </button>
        `;
        container.appendChild(linkContainer);
        
        // Add event listener for detailed analysis button
        document.getElementById('view-detailed-impact').addEventListener('click', function() {
            navigateToDimensionImpact();
        });
    }
    
    /**
     * Create impact chart
     * @param {Array} dimensions - Dimension impact data
     */
    function createImpactChart(dimensions) {
        const ctx = document.getElementById('impact-chart').getContext('2d');
        
        // Prepare data
        const labels = dimensions.slice(0, 10).map(d => formatDimensionName(d.name));
        const impacts = dimensions.slice(0, 10).map(d => d.impact * 100);
        const backgroundColors = impacts.map(impact => 
            impact >= 0 ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)'
        );
        const borderColors = impacts.map(impact => 
            impact >= 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'
        );
        
        // Create chart
        charts['impact'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Impact on Win Rate (%)',
                    data: impacts,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
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
                            text: 'Impact on Win Rate (%)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `Impact: ${value.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Update dimension charts based on selection
     */
    function updateDimensionCharts() {
        // Only update if we have data
        if (dashboardData.winRateByDimension) {
            renderWinRateByDimensionCharts();
        }
    }
    
    /**
     * Clear all dashboard elements
     */
    function clearDashboard() {
        // Destroy existing charts
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        charts = {};
        
        // Clear containers
        document.getElementById('summary-metrics').innerHTML = '';
        document.getElementById('dimension-charts').innerHTML = '';
        document.getElementById('win-rate-trend').innerHTML = '';
        document.getElementById('top-opportunities').innerHTML = '';
        document.getElementById('dimension-impact').innerHTML = '';
    }
    
    /**
     * Show or hide loading indicator
     * @param {boolean} show - Whether to show loading indicator
     */
    function showLoading(show) {
        const loadingElement = document.getElementById('dashboard-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to show
     */
    function showError(message) {
        const errorElement = document.getElementById('dashboard-error');
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
     * Export dashboard data to CSV
     */
    function exportDashboardData() {
        // Convert data to CSV format
        const csvData = convertDataToCSV();
        
        // Create download link
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `win-rate-analysis-${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Convert dashboard data to CSV format
     * @returns {string} CSV data
     */
    function convertDataToCSV() {
        // Implementation depends on data structure
        let csv = 'Dimension,Value,Win Rate,Count\n';
        
        // Add data for each dimension
        Object.keys(dashboardData.winRateByDimension || {}).forEach(dimension => {
            const dimensionData = dashboardData.winRateByDimension[dimension];
            dimensionData.forEach(item => {
                csv += `${dimension},${item.value},${item.winRate},${item.count}\n`;
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
     * Resize charts when window size changes
     */
    function resizeCharts() {
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
    }
    
    /**
     * Navigate to dimension impact analysis page
     */
    function navigateToDimensionImpact() {
        // Use event bus to trigger navigation
        Utils.eventBus.publish('navigation:change', 'dimension-impact');
    }
    
    // Public API
    return {
        initialize,
        loadDashboardData
    };
})();

// Export for use in other modules
window.Dashboard = Dashboard;
