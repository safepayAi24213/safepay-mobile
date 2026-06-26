/**
 * Account-level kill switch. When frozen:
 *  - Send Money and Pay Bills sheets refuse to complete
 *  - A persistent red banner appears across the app
 *  - User must explicitly unfreeze from Profile/Security
 *
 * Reason is shown in the banner + recorded for audit (when wired to backend).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type FreezeReason =
  | 'user_request'           // User froze proactively
  | 'fraud_report'           // After reporting an alert as fraud
  | 'too_many_failed_attempts'; // Backend-triggered (placeholder)

export type FrozenState = {
  frozen: boolean;
  reason: FreezeReason | null;
  since: string | null;
};

type AccountStateValue = FrozenState & {
  freeze: (reason: FreezeReason) => void;
  unfreeze: () => void;
};

const AccountStateCtx = createContext<AccountStateValue>({
  frozen: false,
  reason: null,
  since: null,
  freeze: () => {},
  unfreeze: () => {},
});

export const REASON_COPY: Record<FreezeReason, string> = {
  user_request: 'You froze this account from Profile',
  fraud_report: 'Frozen after a fraud report',
  too_many_failed_attempts: 'Frozen after suspicious activity',
};

export function AccountStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FrozenState>({
    frozen: false,
    reason: null,
    since: null,
  });

  const freeze = useCallback((reason: FreezeReason) => {
    setState({ frozen: true, reason, since: new Date().toISOString() });
  }, []);

  const unfreeze = useCallback(() => {
    setState({ frozen: false, reason: null, since: null });
  }, []);

  const value = useMemo<AccountStateValue>(
    () => ({ ...state, freeze, unfreeze }),
    [state, freeze, unfreeze],
  );

  return <AccountStateCtx.Provider value={value}>{children}</AccountStateCtx.Provider>;
}

export function useAccountState() {
  return useContext(AccountStateCtx);
}
