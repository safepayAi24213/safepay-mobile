import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinDots, PinPad } from '@/components/ui/pin-pad';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Spacing } from '@/constants/theme';
import { ApiError, onboarding } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const PIN_LENGTH = 4;

type Step = 'create' | 'confirm';

export default function CreatePin() {
  const router = useRouter();
  const { token } = useAuth();
  const [step, setStep] = useState<Step>('create');
  const [created, setCreated] = useState('');
  const [confirming, setConfirming] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = step === 'create' ? created : confirming;

  const savePin = async (pin: string) => {
    if (!token) return;
    try {
      await onboarding.setPin(token, pin);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not save your PIN.';
      Alert.alert('PIN error', msg);
    }
  };

  const onDigit = (d: string) => {
    setError(null);
    if (current.length >= PIN_LENGTH) return;
    const next = current + d;

    if (step === 'create') {
      setCreated(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => setStep('confirm'), 180);
      }
    } else {
      setConfirming(next);
      if (next.length === PIN_LENGTH) {
        if (next === created) {
          // Save PIN to backend, then continue.
          savePin(created).finally(() => {
            setTimeout(() => router.replace('/(auth)/link-money'), 220);
          });
        } else {
          setError('PINs don’t match. Try again.');
          setTimeout(() => setConfirming(''), 600);
        }
      }
    }
  };

  const onBackspace = () => {
    setError(null);
    if (step === 'create') setCreated((p) => p.slice(0, -1));
    else setConfirming((p) => p.slice(0, -1));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        onBack={() => {
          if (step === 'confirm') {
            setStep('create');
            setConfirming('');
            setError(null);
          } else {
            router.back();
          }
        }}
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'create'
              ? 'Choose a 4-digit PIN. You’ll use it to sign in and approve payments.'
              : 'Re-enter the PIN you just chose to confirm.'}
          </Text>
        </View>

        <View style={styles.dotsWrap}>
          <PinDots length={PIN_LENGTH} filled={current.length} />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <View style={styles.padWrap}>
          <PinPad onDigit={onDigit} onBackspace={onBackspace} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  dotsWrap: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  error: {
    fontSize: 13,
    color: Brand.danger,
    fontWeight: '600',
  },
  padWrap: {
    paddingBottom: Spacing.md,
  },
});
