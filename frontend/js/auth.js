/**
 * Authentication Module for Salesforce Win Rate Analyzer
 * Handles user authentication with Salesforce
 */

const Auth = (() => {
  // Private variables
  let currentUser = null;
  let authStatus = {
    isAuthenticated: false,
    isAuthenticating: false
  };
  
  /**
   * Handles OAuth callback from Salesforce
   * @private
   */
  const handleOAuthCallback = async () => {
    try {
      const params = Utils.parseQueryParams();
      
      if (params.code && params.state) {
        Utils.showLoading('Completing authentication...');
        authStatus.isAuthenticating = true;
        
        // Process OAuth callback
        const response = await AuthAPI.handleCallback(params.code, params.state);
        
        // Remove query parameters from URL without refreshing the page
        window.history.replaceState({}, document.title, window.location.pathname);
        
        if (response && response.user) {
          setCurrentUser(response.user);
          
          // Trigger auth success event
          const event = new CustomEvent('auth:success', { detail: response.user });
          document.dispatchEvent(event);
        }
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      Utils.showError('Failed to complete authentication. Please try again.', error);
      
      // Trigger auth error event
      const event = new CustomEvent('auth:error', { detail: error });
      document.dispatchEvent(event);
    } finally {
      authStatus.isAuthenticating = false;
      Utils.hideLoading();
    }
  };
  
  /**
   * Updates the UI based on authentication status
   * @private
   */
  const updateAuthUI = () => {
    const loginSection = document.getElementById('loginSection');
    const mainContent = document.getElementById('mainContent');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    
    if (authStatus.isAuthenticated && currentUser) {
      // User is authenticated, show main content
      if (loginSection) loginSection.classList.add('d-none');
      if (mainContent) mainContent.classList.remove('d-none');
      
      // Update user info
      if (userName) {
        userName.textContent = currentUser.name || currentUser.username || 'Authenticated User';
      }
      
      if (userInfo) {
        userInfo.classList.remove('d-none');
      }
    } else {
      // User is not authenticated, show login section
      if (loginSection) loginSection.classList.remove('d-none');
      if (mainContent) mainContent.classList.add('d-none');
      
      if (userInfo) {
        userInfo.classList.add('d-none');
      }
    }
  };
  
  /**
   * Sets the current user and updates auth status
   * @param {Object} user - User object
   * @private
   */
  const setCurrentUser = (user) => {
    currentUser = user;
    authStatus.isAuthenticated = !!user;
    
    // Update UI
    updateAuthUI();
    
    // Store auth status in session storage
    if (user) {
      try {
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('userInfo', JSON.stringify({
          name: user.name || user.username,
          id: user.id
        }));
      } catch (error) {
        console.warn('Failed to store auth status in session storage:', error);
      }
    } else {
      try {
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('userInfo');
      } catch (error) {
        console.warn('Failed to remove auth status from session storage:', error);
      }
    }
  };
  
  /**
   * Initializes the authentication module
   * @public
   */
  const init = async () => {
    try {
      // Check for OAuth callback
      const params = Utils.parseQueryParams();
      if (params.code && params.state) {
        await handleOAuthCallback();
        return;
      }
      
      // Check if user is already authenticated
      let storedAuthStatus = false;
      try {
        storedAuthStatus = sessionStorage.getItem('isAuthenticated') === 'true';
      } catch (error) {
        console.warn('Failed to read auth status from session storage:', error);
      }
      
      if (storedAuthStatus) {
        Utils.showLoading('Verifying authentication...');
        
        try {
          // Verify auth status with server
          const status = await AuthAPI.checkStatus();
          
          if (status && status.authenticated && status.user) {
            setCurrentUser(status.user);
          } else {
            setCurrentUser(null);
          }
        } catch (error) {
          console.error('Auth check error:', error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      
      Utils.hideLoading();
      
      // Attach event listeners
      attachEventListeners();
      
      // Check for token refresh interval
      startTokenRefreshTimer();
    } catch (error) {
      console.error('Auth initialization error:', error);
      Utils.hideLoading();
      setCurrentUser(null);
    }
  };
  
  /**
   * Attaches event listeners for authentication events
   * @private
   */
  const attachEventListeners = () => {
    // Login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await login();
      });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await logout();
      });
    }
  };
  
  /**
   * Starts timer for token refresh
   * @private
   */
  const startTokenRefreshTimer = () => {
    // Refresh token every 50 minutes to avoid expiration (assuming 1 hour expiration)
    const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes in milliseconds
    
    setInterval(async () => {
      if (authStatus.isAuthenticated) {
        try {
          const response = await AuthAPI.refreshToken();
          
          if (response && response.user) {
            setCurrentUser(response.user);
          }
        } catch (error) {
          console.error('Token refresh error:', error);
          
          // If refresh fails, prompt user to re-login
          if (error.status === 401) {
            setCurrentUser(null);
            Utils.showError('Your session has expired. Please log in again.');
          }
        }
      }
    }, REFRESH_INTERVAL);
  };
  
  /**
   * Initiates the login process
   * @public
   */
  const login = async () => {
    try {
      if (authStatus.isAuthenticating) {
        return;
      }
      
      Utils.showLoading('Connecting to Salesforce...');
      authStatus.isAuthenticating = true;
      
      // Get login URL from server
      const response = await AuthAPI.login();
      
      if (response && response.url) {
        // Redirect to Salesforce login page
        window.location.href = response.url;
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error) {
      console.error('Login error:', error);
      Utils.showError('Failed to connect to Salesforce. Please try again.', error);
      authStatus.isAuthenticating = false;
      Utils.hideLoading();
    }
  };
  
  /**
   * Logs out the current user
   * @public
   */
  const logout = async () => {
    try {
      Utils.showLoading('Logging out...');
      
      // Call logout API
      await AuthAPI.logout();
      
      // Clear user data
      setCurrentUser(null);
      
      // Trigger logout event
      const event = new CustomEvent('auth:logout');
      document.dispatchEvent(event);
      
      Utils.hideLoading();
    } catch (error) {
      console.error('Logout error:', error);
      Utils.showError('Failed to log out. Please try again.', error);
      Utils.hideLoading();
    }
  };
  
  /**
   * Gets the current authenticated user
   * @public
   * @returns {Object|null} Current user or null if not authenticated
   */
  const getCurrentUser = () => {
    return currentUser;
  };
  
  /**
   * Checks if the user is authenticated
   * @public
   * @returns {boolean} True if authenticated, false otherwise
   */
  const isAuthenticated = () => {
    return authStatus.isAuthenticated;
  };
  
  // Public interface
  return {
    init,
    login,
    logout,
    getCurrentUser,
    isAuthenticated
  };
})();

// Initialize authentication when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});
