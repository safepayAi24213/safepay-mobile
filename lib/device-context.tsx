import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { captureDeviceFingerprint, type DeviceFingerprint } from './device-fingerprint';

type DeviceContextValue = {
  fingerprint: DeviceFingerprint | null;
  loading: boolean;
};

const DeviceContext = createContext<DeviceContextValue>({ fingerprint: null, loading: true });

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [fingerprint, setFingerprint] = useState<DeviceFingerprint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    captureDeviceFingerprint()
      .then((fp) => {
        if (!cancelled) setFingerprint(fp);
      })
      .catch(() => {
        // swallow — fingerprint is best-effort, app stays functional without it
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DeviceContext.Provider value={{ fingerprint, loading }}>{children}</DeviceContext.Provider>
  );
}

export function useDevice() {
  return useContext(DeviceContext);
}
