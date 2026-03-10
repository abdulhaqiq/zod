/**
 * Collects device fingerprint data to be sent with OTP requests.
 * Used for monitoring, fraud detection, and rate-limit enforcement.
 *
 * What we collect:
 *   ip_address   — local network IP (from expo-network)
 *   device_id    — persistent unique device identifier
 *                  iOS: identifierForVendor  Android: androidId
 *   device_model — e.g. "iPhone 15 Pro", "Pixel 8"
 *   device_os    — e.g. "iOS 17.4", "Android 14"
 *   network_type — "wifi" | "cellular" | "unknown"
 *
 * Note: MAC address is blocked by iOS 7+ and Android 6+ at the OS level.
 * device_id is the recommended privacy-safe substitute.
 */

import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

export interface DeviceInfo {
  ip_address: string | null;
  device_id: string | null;
  device_model: string | null;
  device_os: string | null;
  network_type: string | null;
}

/**
 * Returns a DeviceInfo object. All fields are nullable — a failure in any
 * individual lookup does not prevent the OTP request from going through.
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const [ipResult, networkResult, deviceIdResult] = await Promise.allSettled([
    Network.getIpAddressAsync(),
    Network.getNetworkStateAsync(),
    getDeviceId(),
  ]);

  const ip = ipResult.status === 'fulfilled' ? ipResult.value : null;
  const network = networkResult.status === 'fulfilled' ? networkResult.value : null;
  const deviceId = deviceIdResult.status === 'fulfilled' ? deviceIdResult.value : null;

  const networkType = resolveNetworkType(network?.type ?? null);

  const model = Device.modelName ?? null;
  const osName = Device.osName ?? Platform.OS;
  const osVersion = Device.osVersion ?? null;
  const deviceOs = osVersion ? `${osName} ${osVersion}` : osName;

  return {
    ip_address: ip,
    device_id: deviceId,
    device_model: model,
    device_os: deviceOs,
    network_type: networkType,
  };
}

async function getDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      return await Application.getIosIdForVendorAsync();
    }
    if (Platform.OS === 'android') {
      return Application.getAndroidId();
    }
    return null;
  } catch {
    return null;
  }
}

function resolveNetworkType(type: Network.NetworkStateType | null): string | null {
  if (!type) return null;
  switch (type) {
    case Network.NetworkStateType.WIFI:
      return 'wifi';
    case Network.NetworkStateType.CELLULAR:
      return 'cellular';
    case Network.NetworkStateType.NONE:
    case Network.NetworkStateType.UNKNOWN:
      return 'unknown';
    default:
      return 'unknown';
  }
}
