import * as LocalAuthentication from 'expo-local-authentication';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getBiometricEnabled, setBiometricEnabled as persistBiometricEnabled } from './session-store';

export type BiometricKind = 'face' | 'fingerprint' | 'iris' | 'none';

export type BiometricCapability = {
  available: boolean;
  enrolled: boolean;
  kind: BiometricKind;
  label: string; // user-facing name e.g., "Face ID", "Touch ID", "Fingerprint"
};

async function detectCapability(): Promise<BiometricCapability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { available: false, enrolled: false, kind: 'none', label: 'Biometrics' };

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let kind: BiometricKind = 'none';
    let label = 'Biometrics';

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      kind = 'face';
      label = 'Face ID';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      kind = 'fingerprint';
      label = 'Fingerprint';
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      kind = 'iris';
      label = 'Iris';
    }

    return { available: true, enrolled, kind, label };
  } catch {
    return { available: false, enrolled: false, kind: 'none', label: 'Biometrics' };
  }
}

export async function authenticateBiometric(prompt: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: 'Use PIN instead',
      // Keep the prompt on Face ID / fingerprint only — don't fall back to the
      // device passcode. The app's own PIN screen is the fallback.
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}

// ─── Preference context ──────────────────────────────────────────────────

type BiometricsValue = {
  capability: BiometricCapability;
  enabled: boolean;       // user toggle in Profile
  setEnabled: (v: boolean) => void;
  refresh: () => void;
};

const BiometricsCtx = createContext<BiometricsValue>({
  capability: { available: false, enrolled: false, kind: 'none', label: 'Biometrics' },
  enabled: false,
  setEnabled: () => {},
  refresh: () => {},
});

export function BiometricsProvider({ children }: { children: ReactNode }) {
  const [capability, setCapability] = useState<BiometricCapability>({
    available: false,
    enrolled: false,
    kind: 'none',
    label: 'Biometrics',
  });
  const [enabled, setEnabledState] = useState(false);

  const refresh = useCallback(() => {
    detectCapability().then(setCapability);
  }, []);

  useEffect(() => {
    refresh();
    // Restore the persisted toggle so Face ID stays on across app restarts.
    getBiometricEnabled().then(setEnabledState);
  }, [refresh]);

  // Persist whenever the toggle changes.
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    void persistBiometricEnabled(v);
  }, []);

  const value = useMemo<BiometricsValue>(
    () => ({ capability, enabled, setEnabled, refresh }),
    [capability, enabled, setEnabled, refresh],
  );

  return <BiometricsCtx.Provider value={value}>{children}</BiometricsCtx.Provider>;
}

export function useBiometrics() {
  return useContext(BiometricsCtx);
}
