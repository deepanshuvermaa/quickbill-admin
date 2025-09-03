/**
 * Configuration file for ParkEase-QuickBill Admin Integration
 */

window.PARKEASE_CONFIG = {
    // API Configuration
    api: {
        baseUrl: 'https://glistening-rebirth-production.up.railway.app',
        healthEndpoint: '/health',
        endpoints: {
            stats: '/api/admin/parkease/stats',
            devices: '/api/admin/devices',
            activity: '/api/admin/parkease/activity',
            forceLogout: '/api/admin/force-logout',
            forceLogoutAll: '/api/admin/force-logout-all',
            broadcast: '/api/admin/parkease/broadcast',
            clearCache: '/api/admin/parkease/clear-cache'
        }
    },

    // UI Configuration
    ui: {
        refreshInterval: 30000, // 30 seconds
        notificationDuration: 3000, // 3 seconds
        theme: {
            colors: {
                online: '#10b981',
                offline: '#f59e0b',
                primary: '#3b82f6',
                success: '#10b981',
                error: '#ef4444',
                warning: '#f59e0b'
            }
        }
    },

    // Feature Flags
    features: {
        autoRefresh: true,
        realTimeUpdates: true,
        notifications: true,
        activityLog: true,
        sessionManagement: true
    },

    // Admin Permissions
    permissions: {
        forceLogout: true,
        broadcastMessages: true,
        clearCache: true,
        viewStats: true,
        viewActivity: true
    },

    // Integration Settings
    integration: {
        tabName: 'parkease',
        tabTitle: 'ParkEase Manager',
        priority: 4, // Tab order position
        autoInitialize: true
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.PARKEASE_CONFIG;
}