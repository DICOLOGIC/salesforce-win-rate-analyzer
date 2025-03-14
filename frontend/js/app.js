/**
 * Main Application Module
 * 
 * This is the main entry point for the Win Rate Analyzer application.
 * It initializes all the modules and handles navigation between different views.
 */

import DimensionImpact from './dimensionImpact.js';
import Clustering from './clustering.js';
import Prediction from './prediction.js';
import Dashboard from './dashboard.js';
import LookupTable from './lookup.js';
import Settings from './settings.js';
import Utils from './utils.js';

// Main application module
const App = (function() {
    // Private members
    let currentView = '';
    let isInitialized = false;
    let authToken = null;
    let userData = null;
    
    // DOM Element references
    const elements = {
        app: null,
        navigation: null,
        contentArea: null,
        loadingIndicator: null,
        userInfo: null,
        errorContainer: null
    };
    
    // Module references for views
    const modules = {
        dashboard: Dashboard,
        dimensionImpact: DimensionImpact,
        clustering: Clustering,
        prediction: Prediction,
        lookup: LookupTable,
        settings: Settings
    };
    
    /**
     * Initializes the application
     */
    function init() {
        if (isInitialized) return;
        
        // Cache DOM elements
        _cacheDOMElements();
        
        // Set up event listeners
        _setupEventListeners();
        
        // Check authentication
        _checkAuthentication()
            .then(() => {
                // Initialize global settings
                Settings.init(document.getElementById('settings-container'));
                
                // Apply settings
                _applyGlobalSettings();
                
                // Load initial view (based on settings or default to dashboard)
                const defaultView = Settings.getSetting('ui.defaultView', 'dashboard');
                _loadView(defaultView);
                
                // Set initialized flag
                isInitialized = true;
                
                // Hide loading indicator
                _hideLoading();
            })
            .catch(error => {
                console.error('Initialization error:', error);
                _showError('Failed to initialize the application. Please check your connection and reload the page.');
            });
            
        // Listen for settings changes
        Settings.onSettingsChange(_handleSettingsChange);
    }
    
    /**
     * Caches DOM elements for future use
     * @private
     */
    function _cacheDOMElements() {
        elements.app = document.getElementById('app');
        elements.navigation = document.getElementById('main-navigation');
        elements.contentArea = document.getElementById('main-content');
        elements.loadingIndicator = document.getElementById('loading-indicator');
        elements.userInfo = document.getElementById('user-info');
        elements.errorContainer = document.getElementById('error-container');
    }
    
    /**
     * Sets up event listeners
     * @private
     */
    function _setupEventListeners() {
        // Navigation click event
        if (elements.navigation) {
            elements.navigation.addEventListener('click', (e) => {
                const navLink = e.target.closest('[data-view]');
                if (navLink) {
                    e.preventDefault();
                    const view = navLink.dataset.view;
                    _loadView(view);
                }
            });
        }
        
        // Listen for popstate events (browser back/forward)
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view) {
                _loadView(e.state.view, true); // Don't push state again
            }
        });
        
        // Error container close button
        if (elements.errorContainer) {
            const closeButton = elements.errorContainer.querySelector('.close');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    _hideError();
                });
            }
        }
    }
    
    /**
     * Checks user authentication state
     * @returns {Promise} - Resolves when authentication is confirmed
     * @private
     */
    function _checkAuthentication() {
        _showLoading('Checking authentication...');
        
        return fetch('/api/auth/status')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Authentication failed');
                }
                return response.json();
            })
            .then(data => {
                if (!data.authenticated) {
                    // Redirect to login page
                    window.location.href = '/login.html';
                    throw new Error('Not authenticated');
                }
                
                // Store auth data
                authToken = data.token;
                userData = data.user;
                
                // Update UI with user info
                if (elements.userInfo && userData) {
                    elements.userInfo.innerHTML = `
                        <span class="user-name">${Utils.escapeHtml(userData.name)}</span>
                        <small class="user-org">${Utils.escapeHtml(userData.org)}</small>
                    `;
                }
                
                return data;
            });
    }
    
    /**
     * Loads a specific view
     * @param {string} view - The view to load
     * @param {boolean} skipPushState - If true, doesn't push new browser history state
     * @private
     */
    function _loadView(view, skipPushState = false) {
        if (!view || view === currentView) return;
        
        _showLoading(`Loading ${view} view...`);
        
        // Update navigation
        _updateNavigation(view);
        
        // Clear previous view content
        if (elements.contentArea) {
            elements.contentArea.innerHTML = '';
            
            // Create container for the view
            const viewContainer = document.createElement('div');
            viewContainer.id = `${view}-container`;
            viewContainer.className = 'view-container';
            elements.contentArea.appendChild(viewContainer);
            
            // Initialize the view module
            if (modules[view] && typeof modules[view].init === 'function') {
                try {
                    modules[view].init(viewContainer);
                } catch (error) {
                    console.error(`Error initializing ${view} module:`, error);
                    _showError(`Failed to load ${view} view. Please try again.`);
                }
            } else {
                _showError(`View "${view}" not found or not implemented.`);
            }
        }
        
        // Update URL if not from browser navigation
        if (!skipPushState) {
            const url = `?view=${view}`;
            window.history.pushState({ view: view }, `Win Rate Analyzer - ${view}`, url);
        }
        
        // Update current view
        currentView = view;
        
        // Hide loading indicator
        _hideLoading();
    }
    
    /**
     * Updates the navigation to highlight the current view
     * @param {string} view - Current view
     * @private
     */
    function _updateNavigation(view) {
        if (!elements.navigation) return;
        
        // Remove active class from all nav items
        const navItems = elements.navigation.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to current view's nav item
        const activeItem = elements.navigation.querySelector(`[data-view="${view}"]`);
        if (activeItem) {
            const navItem = activeItem.closest('.nav-item');
            if (navItem) {
                navItem.classList.add('active');
            }
        }
    }
    
    /**
     * Applies global settings to the application
     * @private
     */
    function _applyGlobalSettings() {
        const settings = Settings.getSettings();
        
        // Apply color scheme
        _applyColorScheme(settings.ui.colorScheme);
        
        // Apply other global settings
        document.body.classList.toggle('animations-enabled', settings.ui.chartAnimations);
    }
    
    /**
     * Applies color scheme based on settings
     * @param {string} scheme - Color scheme name
     * @private
     */
    function _applyColorScheme(scheme) {
        // Remove existing scheme classes
        document.body.classList.remove('color-scheme-default');
        document.body.classList.remove('color-scheme-salesforce');
        document.body.classList.remove('color-scheme-monochrome');
        document.body.classList.remove('color-scheme-highcontrast');
        
        // Add new scheme class
        document.body.classList.add(`color-scheme-${scheme}`);
        
        // Update theme color meta tag
        let themeColor = '#0070d2'; // Default blue
        
        switch (scheme) {
            case 'salesforce':
                themeColor = '#00a1e0';
                break;
            case 'monochrome':
                themeColor = '#333333';
                break;
            case 'highcontrast':
                themeColor = '#000000';
                break;
        }
        
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', themeColor);
        }
    }
    
    /**
     * Handles settings changes
     * @param {Object} newSettings - The updated settings
     * @private
     */
    function _handleSettingsChange(newSettings) {
        // Apply global settings
        _applyGlobalSettings();
        
        // Notify current view of settings changes
        if (currentView && modules[currentView] && typeof modules[currentView].onSettingsChange === 'function') {
            modules[currentView].onSettingsChange(newSettings);
        }
    }
    
    /**
     * Shows the loading indicator
     * @param {string} message - Loading message to display
     * @private
     */
    function _showLoading(message = 'Loading...') {
        if (!elements.loadingIndicator) return;
        
        const messageElement = elements.loadingIndicator.querySelector('.loading-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        elements.loadingIndicator.classList.remove('d-none');
    }
    
    /**
     * Hides the loading indicator
     * @private
     */
    function _hideLoading() {
        if (!elements.loadingIndicator) return;
        elements.loadingIndicator.classList.add('d-none');
    }
    
    /**
     * Shows an error message
     * @param {string} message - Error message to display
     * @private
     */
    function _showError(message) {
        if (!elements.errorContainer) return;
        
        const messageElement = elements.errorContainer.querySelector('.error-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        elements.errorContainer.classList.remove('d-none');
        _hideLoading();
    }
    
    /**
     * Hides the error message
     * @private
     */
    function _hideError() {
        if (!elements.errorContainer) return;
        elements.errorContainer.classList.add('d-none');
    }
    
    /**
     * Logs the user out
     */
    function logout() {
        fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(() => {
            // Redirect to login page
            window.location.href = '/login.html';
        })
        .catch(error => {
            console.error('Logout error:', error);
            // Redirect anyway
            window.location.href = '/login.html';
        });
    }
    
    /**
     * Gets the authenticated user data
     * @returns {Object|null} - User data or null if not authenticated
     */
    function getUser() {
        return userData;
    }
    
    /**
     * Gets the current view name
     * @returns {string} - Current view name
     */
    function getCurrentView() {
        return currentView;
    }
    
    /**
     * Gets the authentication token
     * @returns {string|null} - Auth token or null if not authenticated
     */
    function getAuthToken() {
        return authToken;
    }
    
    // Public API
    return {
        init: init,
        logout: logout,
        getUser: getUser,
        getCurrentView: getCurrentView,
        getAuthToken: getAuthToken
    };
})();

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export the module
export default App;