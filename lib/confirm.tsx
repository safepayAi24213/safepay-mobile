import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Shadow, Spacing } from '@/constants/theme';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

type Pending = { opts: ConfirmOptions; resolve: (ok: boolean) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      const p: Pending = { opts, resolve };
      ref.current = p;
      setPending(p);
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    const p = ref.current;
    ref.current = null;
    setPending(null);
    p?.resolve(ok);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmModal pending={pending} onClose={close} />
    </ConfirmContext.Provider>
  );
}

function ConfirmModal({ pending, onClose }: { pending: Pending | null; onClose: (ok: boolean) => void }) {
  const opts = pending?.opts;
  const destructive = !!opts?.destructive;
  const confirmTint = destructive ? Brand.danger : Brand.primary;

  return (
    <Modal
      visible={!!pending}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onClose(false)}>
      <View style={styles.root}>
        {/* Blurred backdrop — tap outside to dismiss */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 28 : 60}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={[StyleSheet.absoluteFill, styles.dim]} onPress={() => onClose(false)} />

        {/* Centered card */}
        <View style={[styles.card, Shadow.lg]}>
          {opts?.icon && (
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: destructive ? Brand.dangerSoft : Brand.primarySoft },
              ]}>
              <Ionicons name={opts.icon} size={28} color={confirmTint} />
            </View>
          )}
          <Text style={styles.title}>{opts?.title}</Text>
          {!!opts?.message && <Text style={styles.message}>{opts.message}</Text>}

          <View style={styles.actions}>
            <Pressable
              onPress={() => onClose(false)}
              style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.cancelText}>{opts?.cancelLabel ?? 'Cancel'}</Text>
            </Pressable>
            <Pressable
              onPress={() => onClose(true)}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: confirmTint },
                pressed && { opacity: 0.9 },
              ]}>
              <Text style={[styles.confirmText, destructive && { color: '#FFFFFF' }]}>
                {opts?.confirmLabel ?? 'Confirm'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dim: {
    backgroundColor: 'rgba(2,6,12,0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Brand.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textSecondary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: Brand.text },
  confirmText: { fontSize: 15, fontWeight: '800', color: Brand.textOnPrimary },
});
