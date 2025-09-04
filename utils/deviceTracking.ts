import { Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';

/**
 * Device tracking for single session management
 * Ensures one user can only be logged in on one device at a time
 */

const DEVICE_ID_KEY = '@QuickBill:DeviceId';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'phone' | 'tablet' | 'desktop' | 'web';
  platform: string;
  osVersion: string;
  appVersion: string;
  lastActive: number;
}

/**
 * Get or create a unique device ID for this installation
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    // Try to get existing device ID
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate new device ID if not exists
      deviceId = uuid.v4() as string;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Fallback to a generated ID
    return uuid.v4() as string;
  }
};

/**
 * Get comprehensive device information
 */
export const getDeviceInfo = async (): Promise<DeviceInfo> => {
  const deviceId = await getDeviceId();
  
  // Determine device type
  let deviceType: DeviceInfo['deviceType'] = 'phone';
  if (Platform.OS === 'web') {
    deviceType = 'desktop';
  } else if (Device.deviceType === Device.DeviceType.TABLET) {
    deviceType = 'tablet';
  }
  
  return {
    deviceId,
    deviceName: Device.deviceName || `${Platform.OS} Device`,
    deviceType,
    platform: Platform.OS,
    osVersion: Platform.Version?.toString() || 'unknown',
    appVersion: '1.0.0', // You might want to get this from your app config
    lastActive: Date.now()
  };
};

/**
 * Check if current device matches the active session device
 */
export const isCurrentDeviceActive = (activeDeviceId: string | null): boolean => {
  if (!activeDeviceId) return false;
  
  return getDeviceId().then(currentId => currentId === activeDeviceId)
    .catch(() => false) as unknown as boolean;
};

/**
 * Format device info for display
 */
export const formatDeviceInfo = (device: DeviceInfo): string => {
  const typeEmoji = {
    phone: '📱',
    tablet: '📋',
    desktop: '💻',
    web: '🌐'
  };
  
  return `${typeEmoji[device.deviceType]} ${device.deviceName} (${device.platform})`;
};