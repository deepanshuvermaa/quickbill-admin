/**
 * ParkEase Manager Module for QuickBill Admin Panel
 * Integrates ParkEase parking management system
 */

class ParkEaseManager {
    constructor() {
        this.apiBaseUrl = window.PARKEASE_CONFIG?.api?.baseUrl || 'https://glistening-rebirth-production.up.railway.app';
        this.refreshInterval = null;
        this.isOnline = false;
        this.stats = {};
        this.sessions = [];
        this.activities = [];
    }

    // Initialize ParkEase module
    async init() {
        console.log('🚀 Initializing ParkEase Manager...');
        await this.checkConnection();
        if (this.isOnline) {
            await this.loadData();
            this.startAutoRefresh();
        }
        this.setupEventListeners();
    }

    // Check backend connectivity
    async checkConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            this.isOnline = response.ok;
            this.updateConnectionStatus();
            if (!this.isOnline && response.status === 502) {
                console.warn('ParkEase backend is down (502). Railway may be rebuilding. Will retry in 30 seconds.');
            }
            return this.isOnline;
        } catch (error) {
            console.warn('ParkEase backend connection failed:', error.message);
            this.isOnline = false;
            this.updateConnectionStatus();
            return false;
        }
    }

    // Update connection status UI
    updateConnectionStatus() {
        const statusElement = document.getElementById('parkease-status');
        if (statusElement) {
            const statusDot = statusElement.querySelector('.w-3');
            const statusText = statusElement.querySelector('span');
            
            if (statusDot) {
                statusDot.className = this.isOnline 
                    ? 'w-3 h-3 rounded-full bg-green-400' 
                    : 'w-3 h-3 rounded-full bg-gray-400';
            }
            if (statusText) {
                statusText.textContent = this.isOnline ? 'Connected' : 'Offline';
                statusText.className = this.isOnline 
                    ? 'text-sm text-green-600' 
                    : 'text-sm text-gray-500';
            }
        }
    }

    // Load all ParkEase data
    async loadData() {
        if (!this.isOnline) {
            await this.checkConnection();
            if (!this.isOnline) return;
        }

        try {
            await Promise.all([
                this.loadStats(),
                this.loadActiveSessions(),
                this.loadRecentActivity(),
                this.loadExpiringSubscriptions()
            ]);
        } catch (error) {
            console.error('Error loading ParkEase data:', error);
            this.showNotification('Failed to load ParkEase data', 'error');
        }
    }

    // Load dashboard statistics
    async loadStats() {
        try {
            const response = await this.authenticatedFetch('/api/admin/parkease/stats');
            if (response.ok) {
                const data = await response.json();
                this.stats = data.stats;
                this.updateStatsUI();
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // Load active user sessions
    async loadActiveSessions() {
        try {
            const response = await this.authenticatedFetch('/api/admin/devices');
            if (response.ok) {
                const data = await response.json();
                this.sessions = data.devices;
                this.updateSessionsUI();
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
    }

    // Load recent activity
    async loadRecentActivity() {
        try {
            const response = await this.authenticatedFetch('/api/admin/parkease/activity');
            if (response.ok) {
                const data = await response.json();
                this.activities = data.activities;
                this.updateActivityUI();
            }
        } catch (error) {
            console.error('Error loading activity:', error);
        }
    }

    // Load expiring subscriptions
    async loadExpiringSubscriptions() {
        try {
            const response = await this.authenticatedFetch('/api/admin/expiring-subscriptions');
            if (response.ok) {
                const data = await response.json();
                this.updateSubscriptionStatsUI(data.data);
            }
        } catch (error) {
            console.error('Error loading expiring subscriptions:', error);
        }
    }

    // Update subscription stats UI
    updateSubscriptionStatsUI(data) {
        if (!data) return;
        
        const expiringCount = data.expiring_soon?.length || 0;
        const activeCount = data.active_subscriptions || 0;
        const trialCount = data.trial_users || 0;
        
        document.getElementById('parkease-expiring-count').textContent = expiringCount;
        document.getElementById('parkease-active-subs').textContent = activeCount;
        document.getElementById('parkease-trial-users').textContent = trialCount;
        
        // Display expiring users list
        const listContainer = document.getElementById('parkease-expiring-users-list');
        if (listContainer && data.expiring_soon && data.expiring_soon.length > 0) {
            let html = '<h4 class="font-semibold text-sm mb-2">Users Requiring Attention:</h4>';
            
            data.expiring_soon.forEach(user => {
                const daysLeft = user.days_remaining || 0;
                const alertClass = daysLeft <= 1 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
                const textClass = daysLeft <= 1 ? 'text-red-600' : 'text-yellow-600';
                
                html += `
                    <div class="flex justify-between items-center p-3 rounded-lg border ${alertClass}">
                        <div>
                            <p class="font-semibold text-sm">${user.username}</p>
                            <p class="text-xs text-gray-600">${user.is_trial ? 'Trial' : 'Subscription'} expires in ${daysLeft} day(s)</p>
                        </div>
                        <button onclick="window.parkease.extendSubscription('${user.id}')" 
                                class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm">
                            Extend
                        </button>
                    </div>
                `;
            });
            
            listContainer.innerHTML = html;
        } else if (listContainer) {
            listContainer.innerHTML = '<p class="text-sm text-gray-500">No users expiring soon</p>';
        }
    }

    // Extend user subscription
    async extendSubscription(userId) {
        const days = prompt('Enter number of days to extend:');
        if (!days || isNaN(days)) return;
        
        try {
            const response = await this.authenticatedFetch(`/api/admin/users/${userId}/extend-subscription`, {
                method: 'POST',
                body: JSON.stringify({ days: parseInt(days) })
            });
            
            if (response.ok) {
                this.showNotification('Subscription extended successfully', 'success');
                await this.loadExpiringSubscriptions();
            } else {
                this.showNotification('Failed to extend subscription', 'error');
            }
        } catch (error) {
            console.error('Error extending subscription:', error);
            this.showNotification('Failed to extend subscription', 'error');
        }
    }

    // Update stats cards UI
    updateStatsUI() {
        document.getElementById('parkease-active-users').textContent = this.stats.activeUsers || 0;
        document.getElementById('parkease-parked-vehicles').textContent = this.stats.parkedVehicles || 0;
        document.getElementById('parkease-today-revenue').textContent = `₹${this.stats.todayRevenue || 0}`;
        document.getElementById('parkease-active-sessions').textContent = this.stats.activeSessions || 0;
    }

    // Update sessions table UI
    updateSessionsUI() {
        const container = document.getElementById('parkease-sessions-list');
        if (!container) return;

        if (!this.sessions.length) {
            container.innerHTML = '<div class="text-center py-8 text-gray-500">No active sessions</div>';
            return;
        }

        let tableHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left">User</th>
                            <th class="px-4 py-2 text-left">Device</th>
                            <th class="px-4 py-2 text-left">Last Activity</th>
                            <th class="px-4 py-2 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.sessions.forEach(session => {
            const lastActivity = new Date(session.last_activity).toLocaleString();
            tableHTML += `
                <tr class="border-t hover:bg-gray-50">
                    <td class="px-4 py-2">
                        <div class="font-medium">${session.full_name}</div>
                        <div class="text-gray-500 text-xs">@${session.username}</div>
                    </td>
                    <td class="px-4 py-2">
                        <div class="font-medium">${session.device_name || 'Mobile Device'}</div>
                        <div class="text-gray-500 text-xs">${session.device_id.substring(0, 8)}...</div>
                    </td>
                    <td class="px-4 py-2">${lastActivity}</td>
                    <td class="px-4 py-2">
                        <button onclick="parkease.forceLogout('${session.user_id}', '${session.device_id}')" 
                                class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">
                            Logout
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHTML += '</tbody></table></div>';
        container.innerHTML = tableHTML;
    }

    // Update activity feed UI
    updateActivityUI() {
        const container = document.getElementById('parkease-activity-list');
        if (!container) return;

        if (!this.activities.length) {
            container.innerHTML = '<div class="text-center py-8 text-gray-500">No recent activity</div>';
            return;
        }

        let activityHTML = '';
        this.activities.forEach(activity => {
            const timestamp = new Date(activity.timestamp).toLocaleString();
            const typeIcon = this.getActivityIcon(activity.type);
            const typeColor = this.getActivityColor(activity.type);

            activityHTML += `
                <div class="flex items-center space-x-3 py-2 px-4 hover:bg-gray-50 border-b">
                    <div class="w-8 h-8 rounded-full ${typeColor} flex items-center justify-center">
                        <i class="text-white text-sm">${typeIcon}</i>
                    </div>
                    <div class="flex-1">
                        <div class="font-medium">${activity.description}</div>
                        <div class="text-gray-500 text-xs">
                            ${activity.user_name ? `by ${activity.user_name} • ` : ''}${timestamp}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = activityHTML;
    }

    // Get activity type icon
    getActivityIcon(type) {
        const icons = {
            'vehicle_entry': '🚗',
            'vehicle_exit': '✅',
            'user_login': '👤',
            'payment': '💳',
            'system': '⚙️'
        };
        return icons[type] || '📝';
    }

    // Get activity type color
    getActivityColor(type) {
        const colors = {
            'vehicle_entry': 'bg-blue-500',
            'vehicle_exit': 'bg-green-500', 
            'user_login': 'bg-purple-500',
            'payment': 'bg-yellow-500',
            'system': 'bg-gray-500'
        };
        return colors[type] || 'bg-gray-500';
    }

    // Force logout specific user
    async forceLogout(userId, deviceId) {
        if (!confirm('Are you sure you want to force logout this user?')) return;

        try {
            const response = await this.authenticatedFetch('/api/admin/force-logout', {
                method: 'POST',
                body: JSON.stringify({ userId, deviceId })
            });

            if (response.ok) {
                this.showNotification('User logged out successfully', 'success');
                await this.loadActiveSessions();
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to logout user', 'error');
            }
        } catch (error) {
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    // Force logout all users
    async forceLogoutAll() {
        if (!confirm('Are you sure you want to force logout ALL ParkEase users? This cannot be undone.')) return;

        try {
            const response = await this.authenticatedFetch('/api/admin/force-logout-all', {
                method: 'POST'
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification(result.message, 'success');
                await this.loadActiveSessions();
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to logout all users', 'error');
            }
        } catch (error) {
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    // Broadcast message to all devices
    async broadcastMessage() {
        const message = prompt('Enter message to broadcast to all ParkEase devices:');
        if (!message || message.trim().length === 0) return;

        try {
            const response = await this.authenticatedFetch('/api/admin/parkease/broadcast', {
                method: 'POST',
                body: JSON.stringify({ message: message.trim(), type: 'info' })
            });

            if (response.ok) {
                this.showNotification('Message broadcasted successfully', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to broadcast message', 'error');
            }
        } catch (error) {
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    // Clear system cache
    async clearCache() {
        if (!confirm('Are you sure you want to clear the ParkEase system cache?')) return;

        try {
            const response = await this.authenticatedFetch('/api/admin/parkease/clear-cache', {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('System cache cleared successfully', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.message || 'Failed to clear cache', 'error');
            }
        } catch (error) {
            this.showNotification('Error: ' + error.message, 'error');
        }
    }

    // Make authenticated request
    async authenticatedFetch(endpoint, options = {}) {
        const authToken = localStorage.getItem('adminToken');
        if (!authToken) {
            throw new Error('No authentication token found');
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        return fetch(`${this.apiBaseUrl}${endpoint}`, mergedOptions);
    }

    // Setup event listeners
    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('parkease-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }

        // Control buttons
        const forceLogoutAllBtn = document.getElementById('parkease-force-logout-all');
        if (forceLogoutAllBtn) {
            forceLogoutAllBtn.addEventListener('click', () => this.forceLogoutAll());
        }

        const broadcastBtn = document.getElementById('parkease-broadcast');
        if (broadcastBtn) {
            broadcastBtn.addEventListener('click', () => this.broadcastMessage());
        }

        const clearCacheBtn = document.getElementById('parkease-clear-cache');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => this.clearCache());
        }
    }

    // Start auto refresh
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(async () => {
            if (this.isOnline) {
                await this.loadData();
            } else {
                await this.checkConnection();
            }
        }, 30000); // Refresh every 30 seconds
    }

    // Stop auto refresh
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded shadow-lg text-white z-50 transition-all duration-300 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('opacity-100'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('opacity-0');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Cleanup on destroy
    destroy() {
        this.stopAutoRefresh();
        console.log('🔥 ParkEase Manager destroyed');
    }
}

// Global ParkEase instance
window.parkease = new ParkEaseManager();