import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinDots, PinPad } from '@/components/ui/pin-pad';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Spacing } from '@/constants/theme';
import { ApiError, onboarding } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Step = 'current' | 'new' | 'confirm';

const PIN_LENGTH = 4;

const COPY: Record<Step, { title: string; hint: string }> = {
  current: { title: 'Enter current PIN', hint: 'Confirm it’s really you before changing it.' },
  new: { title: 'Choose a new PIN', hint: 'Pick 4 digits you’ll remember.' },
  confirm: { title: 'Confirm new PIN', hint: 'Enter your new PIN once more.' },
};

export default function ChangePinScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [step, setStep] = useState<Step>('current');
  const [entry, setEntry] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = async (value: string) => {
    if (!token) return;
    setError(null);

    if (step === 'current') {
      setBusy(true);
      try {
        await onboarding.verifyPin(token, value);
        setCurrentPin(value);
        setStep('new');
        setEntry('');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Incorrect PIN.');
        setEntry('');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (step === 'new') {
      if (value === currentPin) {
        setError('Choose a PIN different from your current one.');
        setEntry('');
        return;
      }
      setNewPin(value);
      setStep('confirm');
      setEntry('');
      return;
    }

    // confirm
    if (value !== newPin) {
      setError('PINs don’t match. Start the new PIN again.');
      setNewPin('');
      setStep('new');
      setEntry('');
      return;
    }
    setBusy(true);
    try {
      await onboarding.setPin(token, value);
      Alert.alert('PIN updated', 'Your transaction PIN has been changed.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update PIN.');
      setEntry('');
    } finally {
      setBusy(false);
    }
  };

  const onDigit = (d: string) => {
    if (busy || entry.length >= PIN_LENGTH) return;
    const next = entry + d;
    setEntry(next);
    if (next.length === PIN_LENGTH) advance(next);
  };

  const copy = COPY[step];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <View style={styles.content}>
        <View style={styles.iconBadge}>
          <Ionicons name="key-outline" size={28} color={Brand.primary} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.hint}>{copy.hint}</Text>

        <View style={styles.dots}>
          <PinDots length={PIN_LENGTH} filled={entry.length} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : <View style={styles.errorSpacer} />}

        <PinPad onDigit={onDigit} onBackspace={() => setEntry((p) => p.slice(0, -1))} />

        <View style={styles.steps}>
          {(['current', 'new', 'confirm'] as Step[]).map((s) => (
            <View
              key={s}
              style={[styles.stepDot, step === s && styles.stepDotActive]}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
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
    marginTop: Spacing.sm,
  },
  title: { fontSize: 22, fontWeight: '800', color: Brand.text, letterSpacing: -0.3 },
  hint: {
    fontSize: 14,
    color: Brand.textSecondary,
    textAlign: 'center',
    marginTop: -Spacing.sm,
  },
  dots: { marginVertical: Spacing.md },
  error: { fontSize: 13, fontWeight: '600', color: Brand.danger, textAlign: 'center' },
  errorSpacer: { height: 18 },
  steps: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 'auto',
    marginBottom: Spacing.xl,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.border,
  },
  stepDotActive: { backgroundColor: Brand.primary, width: 22 },
});
