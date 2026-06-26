import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { PinDots, PinPad } from '@/components/ui/pin-pad';
import { Brand, Radius, Shadow, Spacing } from '@/constants/theme';
import { ApiError, auth, onboarding } from './api';
import { useAuth } from './auth-context';

export type Method = 'otp' | 'pin';

export type MFAOptions = {
  reason: string;
  method?: Method;
  amount?: string;
};

type MFAContextValue = {
  requireMFA: (opts: MFAOptions) => Promise<boolean>;
  /** Whether step-up MFA is enabled (high-risk transactions always step up). */
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Preferred step-up method when a caller doesn't force one. */
  method: Method;
  setMethod: (m: Method) => void;
};

const MFAContext = createContext<MFAContextValue>({
  requireMFA: async () => false,
  enabled: true,
  setEnabled: () => {},
  method: 'otp',
  setMethod: () => {},
});

type PendingRequest = {
  opts: MFAOptions;
  resolve: (ok: boolean) => void;
};

export function MFAProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [method, setMethod] = useState<Method>('otp');
  const pendingRef = useRef<PendingRequest | null>(null);

  const open = useCallback((opts: MFAOptions) => {
    return new Promise<boolean>((resolve) => {
      const req: PendingRequest = { opts, resolve };
      pendingRef.current = req;
      setPending(req);
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    const req = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    req?.resolve(ok);
  }, []);

  const value = useMemo<MFAContextValue>(
    () => ({ requireMFA: open, enabled, setEnabled, method, setMethod }),
    [open, enabled, method],
  );

  return (
    <MFAContext.Provider value={value}>
      {children}
      <MFAModal pending={pending} preferredMethod={method} onClose={close} />
    </MFAContext.Provider>
  );
}

export function useMFA() {
  return useContext(MFAContext);
}

type ModalProps = {
  pending: PendingRequest | null;
  preferredMethod: Method;
  onClose: (ok: boolean) => void;
};

function MFAModal({ pending, preferredMethod, onClose }: ModalProps) {
  const { token, user } = useAuth();
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const method: Method = pending?.opts.method ?? preferredMethod;

  const reset = () => {
    setCode('');
    setPin('');
    setVerifying(false);
    setError(null);
  };

  const handleClose = (ok: boolean) => {
    reset();
    onClose(ok);
  };

  const verify = async (value: string) => {
    if (verifying || !token) return;
    setVerifying(true);
    setError(null);
    try {
      if (method === 'pin') {
        await onboarding.verifyPin(token, value);
      } else {
        if (!user?.phone) throw new ApiError('No phone on file for OTP', 400, null);
        await auth.otp.verify(user.phone, value, 'sensitive_action');
      }
      handleClose(true);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Verification failed.';
      setError(msg);
      if (method === 'pin') setPin('');
      else setCode('');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      transparent
      visible={!!pending}
      animationType="fade"
      onRequestClose={() => handleClose(false)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.iconBadge}>
            <Ionicons name="shield-checkmark" size={28} color={Brand.primary} />
          </View>

          <Text style={styles.title}>Confirm it&apos;s you</Text>
          <Text style={styles.reason}>{pending?.opts.reason}</Text>

          {pending?.opts.amount && (
            <View style={styles.amountPill}>
              <Text style={styles.amountText}>{pending.opts.amount}</Text>
            </View>
          )}

          <View style={styles.body}>
            {method === 'otp' ? (
              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={(v) => verify(v)}
                autoFocus
              />
            ) : (
              <View style={{ gap: Spacing.lg }}>
                <PinDots length={4} filled={pin.length} />
                <PinPad
                  onDigit={(d) => {
                    if (pin.length >= 4) return;
                    const next = pin + d;
                    setPin(next);
                    if (next.length === 4) verify(next);
                  }}
                  onBackspace={() => setPin((p) => p.slice(0, -1))}
                />
              </View>
            )}
          </View>

          {verifying && (
            <View style={styles.verifyingRow}>
              <ActivityIndicator color={Brand.primary} />
              <Text style={styles.verifyingText}>Verifying…</Text>
            </View>
          )}

          {error && !verifying && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {method === 'otp' && !verifying && (
            <Button
              label="Confirm"
              onPress={() => verify(code)}
              disabled={code.length !== 6}
            />
          )}

          <Pressable onPress={() => handleClose(false)} hitSlop={8} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Brand.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: Brand.border,
    ...Shadow.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.border,
    marginBottom: Spacing.sm,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.35)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.3,
  },
  reason: {
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  amountPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Brand.aiSoft,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.ai,
    letterSpacing: 0.2,
  },
  body: {
    width: '100%',
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyingText: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.textMuted,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.danger,
  },
});
