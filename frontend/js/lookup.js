/**
 * Lookup Table module for Win Rate Analyzer
 * Handles win rate lookup table visualization and interaction
 */

const Lookup = (function() {
    // Private variables
    let lookupData = {};
    let selectedPrimaryDimension = '';
    let selectedSecondaryDimension = '';
    let selectedFilters = {};
    let filterValues = {};
    let heatmapChart = null;
    
    /**
     * Initialize the module
     */
    function initialize() {
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        loadLookupTableData();
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Primary dimension selector
        document.getElementById('primary-dimension-selector').addEventListener('change', function(e) {
            selectedPrimaryDimension = e.target.value;
            updateLookupTable();
        });
        
        // Secondary dimension selector
        document.getElementById('secondary-dimension-selector').addEventListener('change', function(e) {
            selectedSecondaryDimension = e.target.value;
            updateLookupTable();
        });
        
        // Refresh button
        document.getElementById('refresh-lookup-table').addEventListener('click', function() {
            loadLookupTableData();
        });
        
        // Export button
        document.getElementById('export-lookup-table').addEventListener('click', function() {
            exportLookupTable();
        });
        
        // Toggle heatmap button
        document.getElementById('toggle-heatmap').addEventListener('click', function() {
            toggleHeatmap();
        });
        
        // Listen for auth state changes
        Utils.eventBus.subscribe('auth:stateChanged', function(isAuthenticated) {
            if (isAuthenticated) {
                loadLookupTableData();
            } else {
                clearLookupTable();
            }
        });
        
        // Window resize event
        window.addEventListener('resize', Utils.debounce(function() {
            if (heatmapChart) {
                heatmapChart.resize();
            }
        }, 250));
    }
    
    /**
     * Load lookup table data from API
     */
    function loadLookupTableData() {
        showLoading(true);
        
        API.getLookupTableData()
            .then(function(data) {
                lookupData = data;
                
                // Initialize dimension selectors
                initializeDimensionSelectors();
                
                // Initialize filters
                initializeFilters();
                
                // Render lookup table
                renderLookupTable();
                
                showLoading(false);
            })
            .catch(function(error) {
                console.error('Error loading lookup table data:', error);
                showError('Failed to load lookup table data. Please try again.');
                showLoading(false);
            });
    }
    
    /**
     * Initialize dimension selectors
     */
    function initializeDimensionSelectors() {
        const primarySelector = document.getElementById('primary-dimension-selector');
        const secondarySelector = document.getElementById('secondary-dimension-selector');
        
        // Clear existing options
        primarySelector.innerHTML = '<option value="">Select Dimension</option>';
        secondarySelector.innerHTML = '<option value="">Select Dimension</option>';
        
        // Add options for each dimension
        lookupData.dimensions.forEach(dimension => {
            const primaryOption = document.createElement('option');
            primaryOption.value = dimension.id;
            primaryOption.textContent = formatDimensionName(dimension.name);
            primarySelector.appendChild(primaryOption);
            
            const secondaryOption = document.createElement('option');
            secondaryOption.value = dimension.id;
            secondaryOption.textContent = formatDimensionName(dimension.name);
            secondarySelector.appendChild(secondaryOption);
        });
        
        // Set initial selections
        if (lookupData.dimensions.length > 0) {
            selectedPrimaryDimension = lookupData.dimensions[0].id;
            primarySelector.value = selectedPrimaryDimension;
        }
        
        if (lookupData.dimensions.length > 1) {
            selectedSecondaryDimension = lookupData.dimensions[1].id;
            secondarySelector.value = selectedSecondaryDimension;
        }
    }
    
    /**
     * Initialize filter controls
     */
    function initializeFilters() {
        const filtersContainer = document.getElementById('lookup-filters');
        filtersContainer.innerHTML = '';
        
        // Create filter for each dimension (except primary and secondary)
        lookupData.dimensions.forEach(dimension => {
            // Skip if this is the primary or secondary dimension
            if (dimension.id === selectedPrimaryDimension || dimension.id === selectedSecondaryDimension) {
                return;
            }
            
            // Get unique values for this dimension
            const values = dimension.values || [];
            
            // Create filter control
            const filterControl = document.createElement('div');
            filterControl.className = 'filter-control';
            filterControl.innerHTML = `
                <label for="filter-${dimension.id}">${formatDimensionName(dimension.name)}</label>
                <select id="filter-${dimension.id}" class="form-control dimension-filter" data-dimension="${dimension.id}">
                    <option value="">All</option>
                    ${values.map(value => `<option value="${value}">${value}</option>`).join('')}
                </select>
            `;
            
            filtersContainer.appendChild(filterControl);
            
            // Initialize filter value
            filterValues[dimension.id] = values;
            selectedFilters[dimension.id] = '';
        });
        
        // Add event listeners to filters
        const filterSelects = document.querySelectorAll('.dimension-filter');
        filterSelects.forEach(select => {
            select.addEventListener('change', function() {
                const dimensionId = this.getAttribute('data-dimension');
                selectedFilters[dimensionId] = this.value;
                updateLookupTable();
            });
        });
    }
    
    /**
     * Update lookup table when selections change
     */
    function updateLookupTable() {
        // Check if primary and secondary dimensions are selected
        if (!selectedPrimaryDimension) {
            showError('Please select a primary dimension.');
            return;
        }
        
        // Reinitialize filters (in case primary/secondary changed)
        initializeFilters();
        
        // Render the lookup table
        renderLookupTable();
    }
    
    /**
     * Render the lookup table
     */
    function renderLookupTable() {
        const tableContainer = document.getElementById('lookup-table-container');
        
        // Get table data
        const tableData = generateLookupTableData();
        
        if (!tableData || !tableData.rows || !tableData.columns) {
            tableContainer.innerHTML = '<p>No data available for the selected dimensions.</p>';
            return;
        }
        
        // Generate HTML for table
        let html = `
            <div class="lookup-stats">
                <div class="stat-item">
                    <span class="stat-label">Data Points:</span>
                    <span class="stat-value">${tableData.totalCount}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Average Win Rate:</span>
                    <span class="stat-value">${Utils.formatPercentage(tableData.averageWinRate)}</span>
                </div>
            </div>
            
            <div class="table-scroll-container">
                <table class="lookup-table">
                    <thead>
                        <tr>
                            <th></th>
                            ${tableData.columns.map(col => `<th>${col.label}</th>`).join('')}
                            <th>Overall</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add rows
        tableData.rows.forEach(row => {
            html += `
                <tr>
                    <th>${row.label}</th>
                    ${row.cells.map(cell => `
                        <td class="${getCellClass(cell.winRate)}" 
                            title="Win Rate: ${Utils.formatPercentage(cell.winRate)}, Count: ${cell.count}">
                            ${Utils.formatPercentage(cell.winRate)}
                            <span class="cell-count">(${cell.count})</span>
                        </td>
                    `).join('')}
                    <td class="${getCellClass(row.totalWinRate)}">
                        ${Utils.formatPercentage(row.totalWinRate)}
                        <span class="cell-count">(${row.totalCount})</span>
                    </td>
                </tr>
            `;
        });
        
        // Add overall row
        html += `
                <tr class="overall-row">
                    <th>Overall</th>
                    ${tableData.columnTotals.map(total => `
                        <td class="${getCellClass(total.winRate)}">
                            ${Utils.formatPercentage(total.winRate)}
                            <span class="cell-count">(${total.count})</span>
                        </td>
                    `).join('')}
                    <td class="${getCellClass(tableData.averageWinRate)}">
                        ${Utils.formatPercentage(tableData.averageWinRate)}
                        <span class="cell-count">(${tableData.totalCount})</span>
                    </td>
                </tr>
            </tbody>
        </table>
        </div>
        
        <div class="table-actions">
            <button id="export-lookup-table" class="btn btn-outline-primary">Export Table</button>
            <button id="toggle-heatmap" class="btn btn-outline-primary">View as Heatmap</button>
        </div>
        `;
        
        tableContainer.innerHTML = html;
        
        // Re-attach event listeners
        document.getElementById('export-lookup-table').addEventListener('click', function() {
            exportLookupTable();
        });
        
        document.getElementById('toggle-heatmap').addEventListener('click', function() {
            toggleHeatmap();
        });
    }
    
    /**
     * Generate data for lookup table
     * @returns {Object} Table data
     */
    function generateLookupTableData() {
        // This is a simplified implementation
        // In a real app, this would use the actual data from lookupData
        
        // Check if we have necessary dimensions
        if (!selectedPrimaryDimension || !lookupData.dimensions) {
            return null;
        }
        
        // Find primary dimension
        const primaryDim = lookupData.dimensions.find(d => d.id === selectedPrimaryDimension);
        if (!primaryDim || !primaryDim.values) {
            return null;
        }
        
        // Find secondary dimension (if selected)
        let secondaryDim = null;
        if (selectedSecondaryDimension) {
            secondaryDim = lookupData.dimensions.find(d => d.id === selectedSecondaryDimension);
        }
        
        // Generate columns based on secondary dimension or default
        const columns = secondaryDim 
            ? secondaryDim.values.map(val => ({ id: val, label: val }))
            : [{ id: 'overall', label: 'Overall' }];
        
        // Generate rows based on primary dimension
        const rows = primaryDim.values.map(primaryVal => {
            // Generate cells for each column
            const cells = columns.map(column => {
                // In a real app, this would look up actual win rates from the data
                // For now, generate random demo data
                const winRate = Math.random();
                const count = Math.floor(Math.random() * 100) + 5;
                
                return {
                    primaryValue: primaryVal,
                    secondaryValue: column.id,
                    winRate,
                    count
                };
            });
            
            // Calculate row totals
            const totalCount = cells.reduce((sum, cell) => sum + cell.count, 0);
            const totalWins = cells.reduce((sum, cell) => sum + (cell.winRate * cell.count), 0);
            const totalWinRate = totalCount > 0 ? totalWins / totalCount : 0;
            
            return {
                id: primaryVal,
                label: primaryVal,
                cells,
                totalWinRate,
                totalCount
            };
        });
        
        // Calculate column totals
        const columnTotals = columns.map((column, colIndex) => {
            const colCells = rows.map(row => row.cells[colIndex]);
            const count = colCells.reduce((sum, cell) => sum + cell.count, 0);
            const wins = colCells.reduce((sum, cell) => sum + (cell.winRate * cell.count), 0);
            const winRate = count > 0 ? wins / count : 0;
            
            return {
                id: column.id,
                winRate,
                count
            };
        });
        
        // Calculate overall totals
        const totalCount = columnTotals.reduce((sum, col) => sum + col.count, 0);
        const totalWins = columnTotals.reduce((sum, col) => sum + (col.winRate * col.count), 0);
        const averageWinRate = totalCount > 0 ? totalWins / totalCount : 0;
        
        return {
            rows,
            columns,
            columnTotals,
            totalCount,
            averageWinRate
        };
    }
    
    /**
     * Toggle between table and heatmap view
     */
    function toggleHeatmap() {
        const tableContainer = document.getElementById('lookup-table-container');
        const heatmapContainer = document.getElementById('lookup-heatmap-container');
        
        if (heatmapContainer.style.display === 'none' || !heatmapContainer.style.display) {
            // Show heatmap
            tableContainer.style.display = 'none';
            heatmapContainer.style.display = 'block';
            
            // Create heatmap if it doesn't exist
            if (!heatmapChart) {
                createHeatmap();
            }
            
            document.getElementById('toggle-heatmap').textContent = 'View as Table';
        } else {
            // Show table
            tableContainer.style.display = 'block';
            heatmapContainer.style.display = 'none';
            document.getElementById('toggle-heatmap').textContent = 'View as Heatmap';
        }
    }
    
    /**
     * Create heatmap visualization
     */
    function createHeatmap() {
        const ctx = document.getElementById('heatmap-chart').getContext('2d');
        
        // Get table data
        const tableData = generateLookupTableData();
        
        if (!tableData) {
            return;
        }
        
        // Prepare data for heatmap
        const labels = tableData.rows.map(row => row.label);
        const datasets = tableData.columns.map((column, colIndex) => {
            return {
                label: column.label,
                data: tableData.rows.map(row => row.cells[colIndex].winRate * 100),
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                hoverBackgroundColor: 'rgba(54, 162, 235, 0.4)',
                hoverBorderColor: 'rgba(54, 162, 235, 1)'
            };
        });
        
        heatmapChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: formatDimensionName(lookupData.dimensions.find(d => d.id === selectedPrimaryDimension).name)
                        }
                    },
                    y: {
                        stacked: false,
                        title: {
                            display: true,
                            text: 'Win Rate (%)'
                        },
                        min: 0,
                        max: 100
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const rowIndex = context.dataIndex;
                                const colIndex = context.datasetIndex;
                                const cell = tableData.rows[rowIndex].cells[colIndex];
                                return [
                                    `Win Rate: ${Utils.formatPercentage(cell.winRate)}`,
                                    `Count: ${cell.count}`
                                ];
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
     * Export lookup table as CSV
     */
    function exportLookupTable() {
        // Get table data
        const tableData = generateLookupTableData();
        
        if (!tableData) {
            showError('No data available to export.');
            return;
        }
        
        // Generate CSV content
        let csv = 'Primary Dimension,Secondary Dimension,Win Rate,Count\n';
        
        tableData.rows.forEach(row => {
            row.cells.forEach((cell, colIndex) => {
                csv += `${row.label},${tableData.columns[colIndex].label},${cell.winRate},${cell.count}\n`;
            });
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `win-rate-lookup-${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Get CSS class for a cell based on win rate
     * @param {number} winRate - Win rate value
     * @returns {string} CSS class
     */
    function getCellClass(winRate) {
        if (winRate >= 0.7) {
            return 'high-rate';
        } else if (winRate >= 0.5) {
            return 'medium-rate';
        } else if (winRate >= 0.3) {
            return 'low-rate';
        } else {
            return 'very-low-rate';
        }
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
        const loadingElement = document.getElementById('lookup-loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to show
     */
    function showError(message) {
        const errorElement = document.getElementById('lookup-error');
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
     * Clear lookup table
     */
    function clearLookupTable() {
        // Destroy heatmap chart if exists
        if (heatmapChart) {
            heatmapChart.destroy();
            heatmapChart = null;
        }
        
        // Clear containers
        document.getElementById('lookup-table-container').innerHTML = '';
        document.getElementById('lookup-filters').innerHTML = '';
        
        // Reset selectors
        const primarySelector = document.getElementById('primary-dimension-selector');
        const secondarySelector = document.getElementById('secondary-dimension-selector');
        
        if (primarySelector) primarySelector.innerHTML = '';
        if (secondarySelector) secondarySelector.innerHTML = '';
        
        // Reset variables
        selectedPrimaryDimension = '';
        selectedSecondaryDimension = '';
        selectedFilters = {};
        filterValues = {};
    }
    
    // Public API
    return {
        initialize,
        loadLookupTableData
    };
})();

// Export for use in other modules
window.Lookup = Lookup;
