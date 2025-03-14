/**
 * Win Rate Lookup Table Module
 * 
 * This module implements the Win Rate Lookup Table feature described in section 3.2.3 of the PRD.
 * It generates a multi-dimensional reference table showing win rates for various dimension combinations.
 */

const LookupTable = (function() {
    // Private members
    let tableData = [];
    let selectedDimensions = [];
    let containerElement = null;
    let isLoading = false;
    
    /**
     * Initializes the lookup table module
     * @param {HTMLElement} container - The container element for the lookup table
     */
    function init(container) {
        containerElement = container;
        
        // Initialize dimension selector
        _initDimensionSelector();
        
        // Initialize table export buttons
        _initExportButtons();
        
        // Set up event listeners
        _setupEventListeners();
        
        // Load default dimensions
        _loadDefaultDimensions();
    }
    
    /**
     * Initializes the dimension selector UI
     * @private
     */
    function _initDimensionSelector() {
        const dimensionSelector = document.createElement('div');
        dimensionSelector.className = 'lookup-dimension-selector mb-4';
        dimensionSelector.innerHTML = `
            <h5>Select Dimensions for Lookup Table</h5>
            <div class="alert alert-info">
                <small>Select up to 3 dimensions to include in the lookup table. More dimensions will make the table larger.</small>
            </div>
            <div class="form-row dimension-checkboxes">
                <div class="col-12 text-center">
                    <p class="loading-dimensions">Loading available dimensions...</p>
                </div>
            </div>
            <div class="form-row mt-3">
                <div class="col-12">
                    <button id="generate-lookup-table" class="btn btn-primary">Generate Lookup Table</button>
                </div>
            </div>
        `;
        
        containerElement.appendChild(dimensionSelector);
        
        // Load available dimensions from the API
        _loadAvailableDimensions();
    }
    
    /**
     * Initializes the export buttons for the lookup table
     * @private
     */
    function _initExportButtons() {
        const exportButtons = document.createElement('div');
        exportButtons.className = 'lookup-export-buttons mb-4 d-none';
        exportButtons.innerHTML = `
            <div class="btn-group">
                <button id="export-csv" class="btn btn-sm btn-outline-secondary">Export as CSV</button>
                <button id="export-excel" class="btn btn-sm btn-outline-secondary">Export as Excel</button>
            </div>
        `;
        
        containerElement.appendChild(exportButtons);
    }
    
    /**
     * Sets up event listeners for the module
     * @private
     */
    function _setupEventListeners() {
        // Generate lookup table button
        containerElement.addEventListener('click', function(e) {
            if (e.target.id === 'generate-lookup-table') {
                _generateLookupTable();
            } else if (e.target.id === 'export-csv') {
                _exportTableAsCSV();
            } else if (e.target.id === 'export-excel') {
                _exportTableAsExcel();
            }
        });
        
        // Dimension selection changes
        containerElement.addEventListener('change', function(e) {
            if (e.target.closest('.dimension-checkbox')) {
                _updateSelectedDimensions();
            }
        });
    }
    
    /**
     * Loads the available dimensions from the API
     * @private
     */
    function _loadAvailableDimensions() {
        fetch('/api/dimensions')
            .then(response => response.json())
            .then(dimensions => {
                _renderDimensionCheckboxes(dimensions);
            })
            .catch(error => {
                console.error('Error loading dimensions:', error);
                const checkboxesContainer = containerElement.querySelector('.dimension-checkboxes');
                checkboxesContainer.innerHTML = `
                    <div class="col-12">
                        <div class="alert alert-danger">
                            Failed to load dimensions. Please try refreshing the page.
                        </div>
                    </div>
                `;
            });
    }
    
    /**
     * Renders dimension checkboxes for selection
     * @param {Array} dimensions - List of available dimensions
     * @private
     */
    function _renderDimensionCheckboxes(dimensions) {
        const checkboxesContainer = containerElement.querySelector('.dimension-checkboxes');
        
        if (!dimensions || dimensions.length === 0) {
            checkboxesContainer.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-warning">
                        No dimensions available for lookup table.
                    </div>
                </div>
            `;
            return;
        }
        
        // Clear loading indicator
        checkboxesContainer.innerHTML = '';
        
        // Create checkbox for each dimension
        dimensions.forEach(dimension => {
            const col = document.createElement('div');
            col.className = 'col-md-4 col-sm-6 mb-2';
            col.innerHTML = `
                <div class="custom-control custom-checkbox dimension-checkbox">
                    <input type="checkbox" class="custom-control-input" id="dim-${dimension.id}" data-dimension-id="${dimension.id}" data-dimension-name="${dimension.name}">
                    <label class="custom-control-label" for="dim-${dimension.id}">${dimension.name}</label>
                </div>
            `;
            checkboxesContainer.appendChild(col);
        });
    }
    
    /**
     * Loads default dimensions for the lookup table
     * @private
     */
    function _loadDefaultDimensions() {
        // You could pre-select some default dimensions based on your application needs
        // This would typically be loaded from user preferences or application settings
    }
    
    /**
     * Updates the list of selected dimensions based on checkbox state
     * @private
     */
    function _updateSelectedDimensions() {
        selectedDimensions = [];
        
        const checkboxes = containerElement.querySelectorAll('.dimension-checkbox input:checked');
        checkboxes.forEach(checkbox => {
            selectedDimensions.push({
                id: checkbox.dataset.dimensionId,
                name: checkbox.dataset.dimensionName
            });
        });
        
        // Disable additional checkboxes if maximum is reached
        const allCheckboxes = containerElement.querySelectorAll('.dimension-checkbox input');
        if (selectedDimensions.length >= 3) {
            allCheckboxes.forEach(checkbox => {
                if (!checkbox.checked) {
                    checkbox.disabled = true;
                }
            });
        } else {
            allCheckboxes.forEach(checkbox => {
                checkbox.disabled = false;
            });
        }
        
        // Enable/disable generate button based on selection
        const generateButton = containerElement.querySelector('#generate-lookup-table');
        generateButton.disabled = selectedDimensions.length === 0;
    }
    
    /**
     * Generates the lookup table based on selected dimensions
     * @private
     */
    function _generateLookupTable() {
        if (selectedDimensions.length === 0) {
            alert('Please select at least one dimension for the lookup table.');
            return;
        }
        
        if (isLoading) return;
        isLoading = true;
        
        // Show loading indicator
        _showLoadingIndicator();
        
        // Prepare dimensions for API request
        const dimensionIds = selectedDimensions.map(dim => dim.id);
        
        // Request lookup table data from API
        fetch('/api/lookup-table', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dimensions: dimensionIds
            })
        })
        .then(response => response.json())
        .then(data => {
            tableData = data;
            _renderLookupTable(data);
            // Show export buttons
            containerElement.querySelector('.lookup-export-buttons').classList.remove('d-none');
            isLoading = false;
        })
        .catch(error => {
            console.error('Error generating lookup table:', error);
            _showErrorMessage('Failed to generate lookup table. Please try again.');
            isLoading = false;
        });
    }
    
    /**
     * Renders the lookup table with the provided data
     * @param {Object} data - Table data from the API
     * @private
     */
    function _renderLookupTable(data) {
        // Remove any existing table
        const existingTable = containerElement.querySelector('.lookup-table-container');
        if (existingTable) {
            existingTable.remove();
        }
        
        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'lookup-table-container mt-4';
        
        // For simplicity, we'll implement a 2D table rendering
        // In a complete implementation, this would handle N dimensions with appropriate nesting
        
        if (selectedDimensions.length === 1) {
            // Single dimension table (simplest case)
            _renderOneDimensionalTable(tableContainer, data);
        } else if (selectedDimensions.length === 2) {
            // Two-dimensional table (rows and columns)
            _renderTwoDimensionalTable(tableContainer, data);
        } else {
            // Multi-dimensional table (would be more complex in real implementation)
            _renderMultiDimensionalTable(tableContainer, data);
        }
        
        containerElement.appendChild(tableContainer);
        
        // Initialize heat map coloring for the table cells
        _applyHeatMapColoring();
    }
    
    /**
     * Renders a one-dimensional lookup table
     * @param {HTMLElement} container - Container for the table
     * @param {Object} data - Table data
     * @private
     */
    function _renderOneDimensionalTable(container, data) {
        const dimensionName = selectedDimensions[0].name;
        
        const tableHtml = `
            <h5>Win Rate by ${dimensionName}</h5>
            <div class="table-responsive">
                <table class="table table-bordered lookup-table">
                    <thead>
                        <tr>
                            <th>${dimensionName}</th>
                            <th>Win Rate</th>
                            <th>Sample Size</th>
                            <th>Confidence</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.rows.map(row => `
                            <tr>
                                <td>${row.value}</td>
                                <td class="win-rate-cell" data-value="${row.winRate}">${(row.winRate * 100).toFixed(1)}%</td>
                                <td>${row.sampleSize}</td>
                                <td>${_getConfidenceLabel(row.confidence)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = tableHtml;
    }
    
    /**
     * Renders a two-dimensional lookup table
     * @param {HTMLElement} container - Container for the table
     * @param {Object} data - Table data
     * @private
     */
    function _renderTwoDimensionalTable(container, data) {
        const rowDimension = selectedDimensions[0].name;
        const colDimension = selectedDimensions[1].name;
        
        let tableHtml = `
            <h5>Win Rate by ${rowDimension} and ${colDimension}</h5>
            <div class="table-responsive">
                <table class="table table-bordered lookup-table">
                    <thead>
                        <tr>
                            <th>${rowDimension} \\ ${colDimension}</th>
        `;
        
        // Add column headers
        data.columnValues.forEach(colValue => {
            tableHtml += `<th>${colValue}</th>`;
        });
        
        tableHtml += `
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add rows with data cells
        data.rows.forEach(row => {
            tableHtml += `
                <tr>
                    <th>${row.value}</th>
            `;
            
            // Add cells for each column
            row.cells.forEach(cell => {
                const winRateDisplay = cell.winRate ? (cell.winRate * 100).toFixed(1) + '%' : 'N/A';
                const confidence = cell.confidence || 0;
                
                tableHtml += `
                    <td class="win-rate-cell" 
                        data-value="${cell.winRate || 0}" 
                        data-sample-size="${cell.sampleSize || 0}"
                        data-confidence="${confidence}">
                        <div>${winRateDisplay}</div>
                        <small>${cell.sampleSize || 0} opp</small>
                    </td>
                `;
            });
            
            tableHtml += `
                </tr>
            `;
        });
        
        tableHtml += `
                    </tbody>
                </table>
            </div>
            <div class="text-muted mt-2">
                <small>Cells are colored by win rate percentage. Hover over cells to see details.</small>
            </div>
        `;
        
        container.innerHTML = tableHtml;
    }
    
    /**
     * Renders a multi-dimensional lookup table
     * @param {HTMLElement} container - Container for the table
     * @param {Object} data - Table data
     * @private
     */
    function _renderMultiDimensionalTable(container, data) {
        // In a full implementation, this would handle 3+ dimensions
        // For simplicity, we'll show a message that this is complex and offer a different view
        
        container.innerHTML = `
            <div class="alert alert-info">
                <h5>Multi-dimensional View</h5>
                <p>You've selected ${selectedDimensions.length} dimensions. For better visualization, we recommend:</p>
                <ul>
                    <li>Using the 'interactive filters' below to isolate specific dimension combinations</li>
                    <li>Or, select fewer dimensions for a simpler table view</li>
                </ul>
            </div>
            
            <div class="multi-dim-controls">
                <h6>Interactive Filters</h6>
                ${selectedDimensions.map((dim, index) => `
                    <div class="form-group">
                        <label for="filter-dim-${index}">${dim.name}</label>
                        <select id="filter-dim-${index}" class="form-control multi-dim-filter" data-dimension-id="${dim.id}">
                            <option value="all">All values</option>
                            ${data.dimensionValues[dim.id].map(value => `
                                <option value="${value}">${value}</option>
                            `).join('')}
                        </select>
                    </div>
                `).join('')}
                <button id="apply-multi-filters" class="btn btn-sm btn-primary">Apply Filters</button>
            </div>
            
            <div class="filtered-results mt-4">
                <div class="alert alert-secondary">
                    <p>Select filters above and click 'Apply Filters' to see win rates for specific combinations.</p>
                </div>
            </div>
        `;
        
        // Set up event listener for the multi-dimensional filter
        const applyButton = container.querySelector('#apply-multi-filters');
        applyButton.addEventListener('click', () => {
            _applyMultiDimensionalFilters(container, data);
        });
    }
    
    /**
     * Applies the heat map coloring to win rate cells
     * @private
     */
    function _applyHeatMapColoring() {
        const cells = containerElement.querySelectorAll('.win-rate-cell');
        
        cells.forEach(cell => {
            const value = parseFloat(cell.dataset.value);
            if (!isNaN(value)) {
                // Generate color from red (0%) to green (100%)
                const red = Math.floor(255 * (1 - value));
                const green = Math.floor(255 * value);
                const blue = 0;
                
                // Apply more subtle coloring
                const alpha = 0.2 + (value * 0.6); // Range from 0.2 to 0.8 for better visibility
                cell.style.backgroundColor = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
                
                // Add dark text for light backgrounds and light text for dark backgrounds
                cell.style.color = value > 0.5 ? '#000' : '#fff';
            }
        });
    }
    
    /**
     * Shows a loading indicator while generating the table
     * @private
     */
    function _showLoadingIndicator() {
        // Remove any existing table
        const existingTable = containerElement.querySelector('.lookup-table-container');
        if (existingTable) {
            existingTable.remove();
        }
        
        // Create loading indicator
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'lookup-table-container mt-4';
        loadingContainer.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
                <p class="mt-2">Generating lookup table...</p>
                <p class="text-muted"><small>This may take a moment for complex tables</small></p>
            </div>
        `;
        
        containerElement.appendChild(loadingContainer);
    }
    
    /**
     * Shows an error message
     * @param {string} message - Error message to display
     * @private
     */
    function _showErrorMessage(message) {
        // Remove any existing table or loading indicator
        const existingTable = containerElement.querySelector('.lookup-table-container');
        if (existingTable) {
            existingTable.remove();
        }
        
        // Create error message
        const errorContainer = document.createElement('div');
        errorContainer.className = 'lookup-table-container mt-4';
        errorContainer.innerHTML = `
            <div class="alert alert-danger">
                <p>${message}</p>
            </div>
        `;
        
        containerElement.appendChild(errorContainer);
    }
    
    /**
     * Gets a confidence level label based on the confidence value
     * @param {number} confidence - Confidence value (0-1)
     * @returns {string} - HTML for the confidence label
     * @private
     */
    function _getConfidenceLabel(confidence) {
        if (confidence >= 0.9) {
            return '<span class="badge badge-success">High</span>';
        } else if (confidence >= 0.7) {
            return '<span class="badge badge-warning">Medium</span>';
        } else {
            return '<span class="badge badge-danger">Low</span>';
        }
    }
    
    /**
     * Applies filters to the multi-dimensional table view
     * @param {HTMLElement} container - Table container element
     * @param {Object} data - Table data
     * @private
     */
    function _applyMultiDimensionalFilters(container, data) {
        // Get selected filter values
        const filters = {};
        container.querySelectorAll('.multi-dim-filter').forEach(filter => {
            const dimensionId = filter.dataset.dimensionId;
            const value = filter.value;
            
            if (value !== 'all') {
                filters[dimensionId] = value;
            }
        });
        
        // Find matching records based on filters
        const filteredRecords = data.records.filter(record => {
            return Object.keys(filters).every(dimId => {
                return record.dimensions[dimId] === filters[dimId];
            });
        });
        
        // Render the filtered results
        const resultsContainer = container.querySelector('.filtered-results');
        
        if (filteredRecords.length === 0) {
            resultsContainer.innerHTML = `
                <div class="alert alert-warning">
                    <p>No opportunities match the selected filter criteria.</p>
                </div>
            `;
            return;
        }
        
        // Calculate aggregate win rate for the filtered records
        const wonCount = filteredRecords.filter(record => record.won).length;
        const winRate = wonCount / filteredRecords.length;
        
        resultsContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h6>Filtered Results</h6>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h3 class="mb-0">${(winRate * 100).toFixed(1)}%</h3>
                            <p class="text-muted">Win Rate</p>
                        </div>
                        <div class="col-md-6">
                            <h3 class="mb-0">${filteredRecords.length}</h3>
                            <p class="text-muted">Opportunities</p>
                        </div>
                    </div>
                    
                    <hr>
                    
                    <h6>Applied Filters:</h6>
                    <ul>
                        ${Object.keys(filters).map(dimId => {
                            const dimension = selectedDimensions.find(d => d.id === dimId);
                            return `<li>${dimension.name}: ${filters[dimId]}</li>`;
                        }).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    /**
     * Exports the current table as a CSV file
     * @private
     */
    function _exportTableAsCSV() {
        if (!tableData || !tableData.rows) {
            alert('No data available for export.');
            return;
        }
        
        let csvContent = '';
        
        // Handle export based on number of dimensions
        if (selectedDimensions.length === 1) {
            // Header row
            csvContent += `${selectedDimensions[0].name},Win Rate,Sample Size,Confidence\n`;
            
            // Data rows
            tableData.rows.forEach(row => {
                csvContent += `${row.value},${(row.winRate * 100).toFixed(1)}%,${row.sampleSize},${row.confidence}\n`;
            });
        } else if (selectedDimensions.length === 2) {
            // Header row
            csvContent += `${selectedDimensions[0].name} / ${selectedDimensions[1].name}`;
            tableData.columnValues.forEach(colValue => {
                csvContent += `,${colValue}`;
            });
            csvContent += '\n';
            
            // Data rows
            tableData.rows.forEach(row => {
                csvContent += row.value;
                row.cells.forEach(cell => {
                    csvContent += `,${cell.winRate ? (cell.winRate * 100).toFixed(1) + '%' : 'N/A'}`;
                });
                csvContent += '\n';
            });
        } else {
            // Multi-dimensional export (simplified for this implementation)
            csvContent += 'Multi-dimensional export not fully implemented in this version.\n';
        }
        
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'win_rate_lookup_table.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Exports the current table as an Excel file
     * Note: In a real implementation, this would use a library like SheetJS
     * @private
     */
    function _exportTableAsExcel() {
        alert('Excel export feature will be implemented in a future update. Please use CSV export for now.');
    }
    
    // Public API
    return {
        init: init
    };
})();

// Export the module
export default LookupTable;