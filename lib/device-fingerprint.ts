import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type DeviceFingerprint = {
  id: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  osName: string;
  osVersion: string;
  model: string;
  brand: string;
  deviceType: string;
  appVersion: string;
  installationId: string;
  capturedAt: string;
};

const DEVICE_TYPE_LABEL: Record<number, string> = {
  0: 'unknown',
  1: 'phone',
  2: 'tablet',
  3: 'desktop',
  4: 'tv',
};

async function platformInstallationId(): Promise<string> {
  if (Platform.OS === 'ios') {
    return (await Application.getIosIdForVendorAsync()) ?? 'unknown';
  }
  if (Platform.OS === 'android') {
    return Application.getAndroidId() ?? 'unknown';
  }
  return 'web';
}

export async function captureDeviceFingerprint(): Promise<DeviceFingerprint> {
  const installationId = await platformInstallationId();
  const seed = [
    installationId,
    Device.modelId ?? '',
    Device.modelName ?? '',
    Device.osName ?? '',
    Device.osVersion ?? '',
    Application.applicationId ?? '',
  ].join('|');

  const id = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);

  return {
    id,
    platform: (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
      ? Platform.OS
      : 'unknown') as DeviceFingerprint['platform'],
    osName: Device.osName ?? 'unknown',
    osVersion: Device.osVersion ?? 'unknown',
    model: Device.modelName ?? 'unknown',
    brand: Device.brand ?? 'unknown',
    deviceType: DEVICE_TYPE_LABEL[Device.deviceType ?? 0] ?? 'unknown',
    appVersion: Application.nativeApplicationVersion ?? 'unknown',
    installationId,
    capturedAt: new Date().toISOString(),
  };
}

export function describeDevice(fp: DeviceFingerprint): string {
  return `${fp.brand} ${fp.model} · ${fp.osName} ${fp.osVersion}`.trim();
}
