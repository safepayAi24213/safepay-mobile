import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, auth, type OtpPurpose } from '@/lib/api';

const RESEND_SECONDS = 30;

type Next = 'verify-id' | 'create-pin' | 'login' | 'device-verify' | 'home';

export default function OtpVerification() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    next?: Next;
    phone?: string;
    context?: string;
    purpose?: OtpPurpose;
    dev_code?: string;
  }>();
  const next: Next = params.next ?? 'home';
  const phone = params.phone ?? '';
  const purpose: OtpPurpose = params.purpose ?? 'register';

  // In dev the backend echoes the raw code so we can self-fill. Empty in prod.
  const [code, setCode] = useState(params.dev_code ?? '');
  const [devCode, setDevCode] = useState(params.dev_code ?? '');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  const goNext = () => {
    if (next === 'verify-id') {
      router.replace({ pathname: '/(auth)/verify-id', params: { phone } });
    } else if (next === 'create-pin') router.replace('/(auth)/create-pin');
    else if (next === 'device-verify') router.replace('/(auth)/device-verify');
    else if (next === 'login') router.replace('/(auth)/login');
    else router.replace('/(app)/(tabs)');
  };

  const submit = async (value?: string) => {
    const candidate = value ?? code;
    if (candidate.length !== 6) return;
    if (!phone) {
      Alert.alert('Missing phone', 'Restart the signup flow.');
      return;
    }
    setLoading(true);
    try {
      await auth.otp.verify(phone, candidate, purpose);
      goNext();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Verification failed.';
      Alert.alert('Try again', msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (seconds > 0 || !phone) return;
    setLoading(true);
    try {
      const otp = await auth.otp.send(phone, purpose);
      setDevCode(otp.debug_code ?? '');
      setCode(otp.debug_code ?? '');
      setSeconds(RESEND_SECONDS);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not resend code.';
      Alert.alert('Resend failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Verify your number</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code we sent to{' '}
              <Text style={styles.subtitleBold}>{phone || 'your number'}</Text>.
            </Text>
          </View>

          {devCode ? (
            <View style={styles.devHint}>
              <Text style={styles.devLabel}>DEV · code from backend console</Text>
              <Text style={styles.devCode}>{devCode}</Text>
            </View>
          ) : null}

          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(v) => {
              Keyboard.dismiss();
              submit(v);
            }}
          />

          <View style={styles.resendRow}>
            {seconds > 0 ? (
              <Text style={styles.resendMuted}>Resend code in {seconds}s</Text>
            ) : (
              <Pressable onPress={resend} hitSlop={8}>
                <Text style={styles.resendActive}>Resend code</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            label="Verify"
            onPress={() => {
              Keyboard.dismiss();
              submit();
            }}
            disabled={code.length !== 6}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
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
    gap: Spacing.xl,
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
  },
  subtitleBold: {
    color: Brand.primary,
    fontWeight: '700',
  },
  devHint: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Brand.aiSoft,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    alignItems: 'center',
    gap: 2,
  },
  devLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Brand.ai,
    textTransform: 'uppercase',
  },
  devCode: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    color: Brand.text,
    fontFamily: 'Courier',
  },
  resendRow: {
    alignItems: 'center',
  },
  resendMuted: {
    fontSize: 14,
    color: Brand.textMuted,
  },
  resendActive: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primary,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
});
