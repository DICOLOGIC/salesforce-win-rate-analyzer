/**
 * Main application module for Win Rate Analyzer
 * Orchestrates other modules and handles navigation
 */

const App = (function() {
    // Private variables
    let currentSection = 'dashboard';
    let isInitialized = false;
    
    /**
     * Initialize the application
     */
    function initialize() {
        if (isInitialized) {
            return;
        }
        
        // Initialize API
        API.initialize();
        
        // Initialize Auth module
        Auth.initialize();
        
        // Set up event listeners
        setupEventListeners();
        
        // Set initial page based on URL hash
        setInitialPage();
        
        // Mark as initialized
        isInitialized = true;
        
        console.log('Win Rate Analyzer initialized successfully.');
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const section = this.getAttribute('data-section');
                navigateTo(section);
            });
        });
        
        // Listen for navigation events from other modules
        Utils.eventBus.subscribe('navigation:change', function(section) {
            navigateTo(section);
        });
        
        // Listen for auth state changes
        Utils.eventBus.subscribe('auth:stateChanged', function(isAuthenticated) {
            updateUIForAuthState(isAuthenticated);
        });
        
        // Window popstate event for browser back/forward buttons
        window.addEventListener('popstate', function(e) {
            if (e.state && e.state.section) {
                switchSection(e.state.section);
            }
        });
        
        // Opportunity selection
        Utils.eventBus.subscribe('opportunity:selected', function(opportunityId) {
            showOpportunityDetails(opportunityId);
        });
    }
    
    /**
     * Set initial page based on URL hash
     */
    function setInitialPage() {
        const hash = window.location.hash.substring(1);
        
        if (hash) {
            // Check if hash corresponds to a valid section
            const section = getSectionFromHash(hash);
            if (section) {
                switchSection(section);
                return;
            }
        }
        
        // Default to dashboard
        switchSection('dashboard');
    }
    
    /**
     * Get section from URL hash
     * @param {string} hash - URL hash
     * @returns {string|null} Section name or null if not found
     */
    function getSectionFromHash(hash) {
        const validSections = [
            'dashboard', 
            'dimension-impact', 
            'clustering', 
            'prediction', 
            'lookup', 
            'settings'
        ];
        
        return validSections.includes(hash) ? hash : null;
    }
    
    /**
     * Navigate to a section
     * @param {string} section - Section to navigate to
     */
    function navigateTo(section) {
        // Update URL hash
        window.history.pushState({ section }, '', `#${section}`);
        
        // Switch to the section
        switchSection(section);
    }
    
    /**
     * Switch active section
     * @param {string} section - Section to switch to
     */
    function switchSection(section) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show selected section
        const sectionElement = document.getElementById(`${section}-section`);
        if (sectionElement) {
            sectionElement.style.display = 'block';
        }
        
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const navLink = document.querySelector(`.nav-link[data-section="${section}"]`);
        if (navLink) {
            navLink.classList.add('active');
        }
        
        // Initialize section if needed
        initializeSection(section);
        
        // Update current section
        currentSection = section;
        
        // Update page title
        Utils.setPageTitle(formatSectionName(section));
    }
    
    /**
     * Initialize section if not already initialized
     * @param {string} section - Section to initialize
     */
    function initializeSection(section) {
        switch (section) {
            case 'dashboard':
                if (!window.Dashboard.initialized) {
                    window.Dashboard.initialize();
                    window.Dashboard.initialized = true;
                }
                break;
                
            case 'dimension-impact':
                if (!window.DimensionImpact.initialized) {
                    window.DimensionImpact.initialize();
                    window.DimensionImpact.initialized = true;
                }
                break;
                
            case 'clustering':
                if (!window.Clustering.initialized) {
                    window.Clustering.initialize();
                    window.Clustering.initialized = true;
                }
                break;
                
            case 'prediction':
                if (!window.Prediction.initialized) {
                    window.Prediction.initialize();
                    window.Prediction.initialized = true;
                }
                break;
                
            case 'lookup':
                if (!window.Lookup.initialized) {
                    window.Lookup.initialize();
                    window.Lookup.initialized = true;
                }
                break;
                
            case 'settings':
                if (!window.Settings.initialized) {
                    window.Settings.initialize();
                    window.Settings.initialized = true;
                }
                break;
        }
    }
    
    /**
     * Show opportunity details
     * @param {string} opportunityId - Opportunity ID
     */
    function showOpportunityDetails(opportunityId) {
        // Navigate to prediction section
        navigateTo('prediction');
        
        // Trigger opportunity loading in prediction module
        Utils.eventBus.publish('prediction:loadOpportunity', opportunityId);
    }
    
    /**
     * Update UI based on authentication state
     * @param {boolean} isAuthenticated - Whether user is authenticated
     */
    function updateUIForAuthState(isAuthenticated) {
        const authContainer = document.getElementById('auth-container');
        const mainContent = document.getElementById('main-content');
        const userInfo = document.getElementById('user-info');
        
        if (isAuthenticated) {
            // Show main content
            authContainer.style.display = 'none';
            mainContent.style.display = 'flex';
            
            // Update user info
            const user = Auth.getCurrentUser();
            if (user && userInfo) {
                userInfo.innerHTML = `
                    <span class="user-name">${user.name}</span>
                    <button id="logout-button" class="btn btn-sm btn-outline-light">Logout</button>
                `;
                
                // Add logout handler
                document.getElementById('logout-button').addEventListener('click', function() {
                    Auth.logout();
                });
            }
            
            // Initialize current section
            initializeSection(currentSection);
        } else {
            // Show auth container
            authContainer.style.display = 'block';
            mainContent.style.display = 'none';
            
            // Clear user info
            if (userInfo) {
                userInfo.innerHTML = '';
            }
        }
    }
    
    /**
     * Format section name for display
     * @param {string} section - Section name
     * @returns {string} Formatted section name
     */
    function formatSectionName(section) {
        return section
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    // Public API
    return {
        initialize
    };
})();

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    App.initialize();
});

// Export for use in other modules
window.App = App;
