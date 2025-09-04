import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall, authenticatedApiCall, API_ENDPOINTS } from '@/utils/api';
import { getDeviceInfo, DeviceInfo } from '@/utils/deviceTracking';

// Admin email that has full access
const ADMIN_EMAIL = 'deepanshuverma966@gmail.com';

interface User {
  id: string;
  email: string;
  name: string;
  businessName: string;
  phone?: string;
  isEmailVerified: boolean;
  createdAt: number;
  role?: 'user' | 'admin';
}

interface Subscription {
  id: string;
  plan: 'trial' | 'silver' | 'gold' | 'platinum' | 'monthly' | 'quarterly' | 'yearly';
  planDisplayName?: string;
  tierLevel?: 'silver' | 'gold' | 'platinum';
  status: 'active' | 'expired' | 'cancelled' | 'grace_period' | 'trial' | 'disabled';
  isTrial?: boolean;
  trialDaysRemaining?: number;
  startDate: number;
  endDate: number;
  gracePeriodEnd?: number;
  isInGracePeriod: boolean;
  daysRemaining: number;
  graceDaysRemaining?: number;
  features?: {
    hasInventory: boolean;
    hasTaxReports: boolean;
    hasCustomerReports: boolean;
    hasUserReports: boolean;
    hasKotBilling: boolean;
    maxUsers: number;
  };
  autoRenew?: boolean;
}

interface Session {
  sessionId: string;
  deviceInfo: DeviceInfo;
  createdAt: number;
  lastActive: number;
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  token: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  currentDevice: DeviceInfo | null;
  activeSession: Session | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  lastSyncTime: number | null;
  isHydrated: boolean;
  sessionCheckInterval: NodeJS.Timeout | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  updateSubscription: (subscription: Subscription) => void;
  checkSubscriptionStatus: () => Promise<boolean>;
  setLoading: (loading: boolean) => void;
  hasAccess: (feature: string) => boolean;
  checkSessionValidity: () => Promise<void>;
  forceLogoutOtherDevices: () => Promise<void>;
  syncDataOnDeviceSwitch: () => Promise<void>;
  disableUserAccount: (userId: string) => Promise<void>;
  enableUserAccount: (userId: string) => Promise<void>;
  startSessionCheck: () => void;
  stopSessionCheck: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      subscription: null,
      token: null,
      refreshToken: null,
      sessionId: null,
      currentDevice: null,
      activeSession: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      lastSyncTime: null,
      isHydrated: false,
      sessionCheckInterval: null,
      
      login: async (email: string, password: string) => {
        set({ isLoading: true });
        
        try {
          // Get device info for session tracking
          const deviceInfo = await getDeviceInfo();
          
          // Real API call to Railway backend with device info
          const response = await apiCall(API_ENDPOINTS.AUTH.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ 
              email, 
              password,
              deviceInfo,
              forceLogin: true // This will logout other devices
            }),
          });
          
          // Check if user is admin
          const isAdmin = email === ADMIN_EMAIL;
          
          // If another device is active, we'll receive a warning but still login (last-write-wins)
          if (response.activeDeviceWarning) {
            console.log('Another device was logged out:', response.previousDevice);
          }
          
          // Create session object
          const session: Session = {
            sessionId: response.sessionId,
            deviceInfo,
            createdAt: Date.now(),
            lastActive: Date.now(),
            isActive: true
          };
          
          set({
            user: {
              ...response.user,
              role: isAdmin ? 'admin' : 'user'
            },
            subscription: response.subscription,
            token: response.token,
            refreshToken: response.refreshToken,
            sessionId: response.sessionId,
            currentDevice: deviceInfo,
            activeSession: session,
            isAuthenticated: true,
            isAdmin,
            lastSyncTime: Date.now(),
          });
          
          // Start session validity checking
          get().startSessionCheck();
          
        } catch (error) {
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      
      register: async (userData: any) => {
        set({ isLoading: true });
        
        try {
          // Get device info for session tracking
          const deviceInfo = await getDeviceInfo();
          
          // Check if registering user is admin
          const isAdmin = userData.email === ADMIN_EMAIL;
          
          const response = await apiCall(API_ENDPOINTS.AUTH.REGISTER, {
            method: 'POST',
            body: JSON.stringify({
              ...userData,
              deviceInfo,
              role: isAdmin ? 'admin' : 'user'
            }),
          });
          
          const session: Session = {
            sessionId: response.sessionId,
            deviceInfo,
            createdAt: Date.now(),
            lastActive: Date.now(),
            isActive: true
          };
          
          set({
            user: {
              ...response.user,
              role: isAdmin ? 'admin' : 'user'
            },
            subscription: response.subscription,
            token: response.token,
            refreshToken: response.refreshToken,
            sessionId: response.sessionId,
            currentDevice: deviceInfo,
            activeSession: session,
            isAuthenticated: true,
            isAdmin,
            lastSyncTime: Date.now(),
          });
          
          // Start session validity checking
          get().startSessionCheck();
          
        } catch (error) {
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      
      logout: async () => {
        const { token, sessionId } = get();
        
        // Clear session check interval
        get().stopSessionCheck();
        
        try {
          if (token && sessionId) {
            // Notify backend about logout
            await authenticatedApiCall(
              API_ENDPOINTS.AUTH.LOGOUT,
              token,
              {
                method: 'POST',
                body: JSON.stringify({ sessionId })
              }
            );
          }
        } catch (error) {
          console.error('Logout API call failed:', error);
        }
        
        // Clear local state
        set({
          user: null,
          subscription: null,
          token: null,
          refreshToken: null,
          sessionId: null,
          currentDevice: null,
          activeSession: null,
          isAuthenticated: false,
          isAdmin: false,
          lastSyncTime: null,
        });
      },
      
      refreshTokens: async () => {
        const { refreshToken, sessionId } = get();
        if (!refreshToken) throw new Error('No refresh token');
        
        try {
          const deviceInfo = await getDeviceInfo();
          
          const response = await apiCall(API_ENDPOINTS.AUTH.REFRESH, {
            method: 'POST',
            body: JSON.stringify({ 
              refreshToken,
              sessionId,
              deviceInfo 
            }),
          });
          
          set({
            token: response.token,
            refreshToken: response.refreshToken,
            sessionId: response.sessionId || sessionId,
          });
        } catch (error) {
          // If refresh fails, logout user
          get().logout();
          throw error;
        }
      },
      
      checkSessionValidity: async () => {
        const { token, sessionId } = get();
        if (!token || !sessionId) return;
        
        try {
          const response = await authenticatedApiCall(
            '/auth/check-session',
            token,
            {
              method: 'POST',
              body: JSON.stringify({ sessionId })
            }
          );
          
          if (!response.isValid) {
            // Session is invalid (user logged in elsewhere)
            console.log('Session invalidated - logged in on another device');
            await get().logout();
            
            // Show alert to user
            if (typeof window !== 'undefined') {
              alert('You have been logged out because your account was accessed from another device.');
            }
          } else {
            // Update last active time
            const currentSession = get().activeSession;
            if (currentSession) {
              set({
                activeSession: {
                  ...currentSession,
                  lastActive: Date.now()
                }
              });
            }
          }
        } catch (error) {
          console.error('Session check failed:', error);
        }
      },
      
      forceLogoutOtherDevices: async () => {
        const { token } = get();
        if (!token) throw new Error('Not authenticated');
        
        try {
          const deviceInfo = await getDeviceInfo();
          
          await authenticatedApiCall(
            '/auth/force-logout-others',
            token,
            {
              method: 'POST',
              body: JSON.stringify({ deviceInfo })
            }
          );
        } catch (error) {
          throw error;
        }
      },
      
      syncDataOnDeviceSwitch: async () => {
        const { token } = get();
        if (!token) return;
        
        try {
          // Sync all local data to cloud before switching
          // This would sync bills, items, customers etc.
          await authenticatedApiCall(
            '/sync/upload',
            token,
            {
              method: 'POST',
              body: JSON.stringify({
                // Include all local data that needs syncing
                lastSyncTime: get().lastSyncTime
              })
            }
          );
          
          // After successful sync, update last sync time
          set({ lastSyncTime: Date.now() });
        } catch (error) {
          console.error('Data sync failed:', error);
          throw error;
        }
      },
      
      disableUserAccount: async (userId: string) => {
        const { token, isAdmin } = get();
        if (!token || !isAdmin) throw new Error('Unauthorized');
        
        try {
          await authenticatedApiCall(
            `/admin/users/${userId}/disable`,
            token,
            { method: 'POST' }
          );
        } catch (error) {
          throw error;
        }
      },
      
      enableUserAccount: async (userId: string) => {
        const { token, isAdmin } = get();
        if (!token || !isAdmin) throw new Error('Unauthorized');
        
        try {
          await authenticatedApiCall(
            `/admin/users/${userId}/enable`,
            token,
            { method: 'POST' }
          );
        } catch (error) {
          throw error;
        }
      },
      
      updateSubscription: (subscription: Subscription) => {
        set({ subscription });
      },
      
      checkSubscriptionStatus: async () => {
        const { token, isAdmin } = get();
        
        if (!token) return false;
        
        // Admin always has access
        if (isAdmin) {
          set({
            subscription: {
              id: 'admin',
              plan: 'platinum',
              planDisplayName: 'Admin Access',
              tierLevel: 'platinum',
              status: 'active',
              startDate: Date.now(),
              endDate: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
              isInGracePeriod: false,
              daysRemaining: 365,
              features: {
                hasInventory: true,
                hasTaxReports: true,
                hasCustomerReports: true,
                hasUserReports: true,
                hasKotBilling: true,
                maxUsers: 999
              },
              autoRenew: true
            }
          });
          return true;
        }
        
        try {
          const response = await authenticatedApiCall(
            API_ENDPOINTS.AUTH.SUBSCRIPTION_REFRESH,
            token
          );
          
          if (response.subscription) {
            set({
              subscription: response.subscription,
              lastSyncTime: Date.now(),
            });
          }
          
          return true;
        } catch (error) {
          console.error('Failed to check subscription status:', error);
          return false;
        }
      },
      
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
      
      hasAccess: (feature: string) => {
        const { subscription, isAdmin } = get();
        
        // Admin has access to everything
        if (isAdmin) return true;
        
        // Check if subscription is disabled
        if (subscription?.status === 'disabled') return false;
        
        if (!subscription || subscription.status !== 'active') {
          return false;
        }
        
        const features = subscription.features;
        if (!features) return false;
        
        switch (feature) {
          case 'inventory': return features.hasInventory;
          case 'taxReports': return features.hasTaxReports;
          case 'customerReports': return features.hasCustomerReports;
          case 'userReports': return features.hasUserReports;
          case 'kotBilling': return features.hasKotBilling;
          default: return false;
        }
      },
      
      // Helper methods for session checking
      startSessionCheck: () => {
        // Check session validity every 30 seconds
        const interval = setInterval(() => {
          get().checkSessionValidity();
        }, 30000);
        
        set({ sessionCheckInterval: interval });
      },
      
      stopSessionCheck: () => {
        const { sessionCheckInterval } = get();
        if (sessionCheckInterval) {
          clearInterval(sessionCheckInterval);
          set({ sessionCheckInterval: null });
        }
      },
    }),
    {
      name: 'quickbill-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        subscription: state.subscription,
        token: state.token,
        refreshToken: state.refreshToken,
        sessionId: state.sessionId,
        currentDevice: state.currentDevice,
        activeSession: state.activeSession,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
        lastSyncTime: state.lastSyncTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
          // Start session checking after rehydration if authenticated
          if (state.isAuthenticated && state.token) {
            state.startSessionCheck();
          }
        }
      },
    }
  )
);