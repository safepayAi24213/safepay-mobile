import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, auth } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDevice } from '@/lib/device-context';
import { describeDevice } from '@/lib/device-fingerprint';

export default function Register() {
  const router = useRouter();
  const { setSession } = useAuth();
  const { fingerprint } = useDevice();
  const deviceCtx = fingerprint
    ? {
        device_id: fingerprint.id,
        device_name: describeDevice(fingerprint),
        platform: fingerprint.platform,
      }
    : undefined;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentForPhone, setSentForPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Send (or resend) the SMS OTP for a given phone number.
  const sendOtp = async (target: string) => {
    if (sending) return;
    setSending(true);
    try {
      const otp = await auth.otp.send(target, 'register');
      setSentForPhone(target);
      setOtpSent(true);
      setVerified(false);
      setDevCode(otp.debug_code ?? null);
      setCode(otp.debug_code ?? '');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not send the code. Try again.';
      Alert.alert('Could not send code', msg);
    } finally {
      setSending(false);
    }
  };

  const onChangePhone = (t: string) => {
    const digits = t.replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(digits);
    if (digits.length < 10) {
      // Editing the number invalidates any sent/verified code.
      if (otpSent || verified) {
        setOtpSent(false);
        setVerified(false);
        setCode('');
        setDevCode(null);
        setSentForPhone('');
      }
    } else if (digits !== sentForPhone) {
      // Number complete — auto-send the verification code.
      sendOtp(digits);
    }
  };

  // Auto-verify once all 6 digits are present (covers both typed and the
  // dev-prefilled code). A ref guards against concurrent verifies — we
  // deliberately keep `verifying` out of the deps so toggling it can't
  // re-trigger / cancel the in-flight request.
  const verifyingRef = useRef(false);
  useEffect(() => {
    if (!otpSent || verified || code.length !== 6 || verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    (async () => {
      try {
        await auth.otp.verify(sentForPhone || phone, code, 'register');
        setVerified(true);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Incorrect or expired code.';
        Alert.alert('Invalid code', msg);
        setCode('');
      } finally {
        setVerifying(false);
        verifyingRef.current = false;
      }
    })();
  }, [code, otpSent, verified, sentForPhone, phone]);

  const canContinue = name.trim().length >= 2 && verified && agreed;

  const handleContinue = async () => {
    if (!canContinue) return;
    setLoading(true);
    try {
      // Passwordless signup — backend stores a random hash; the user sets a PIN
      // in the next onboarding steps.
      const token = await auth.register(
        { full_name: name.trim(), phone: phone.trim() },
        deviceCtx,
      );
      setSession(token);
      router.replace({ pathname: '/(auth)/verify-id', params: { phone: phone.trim() } });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
      Alert.alert('Registration failed', msg);
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets>
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>We&apos;ll text a code to verify your phone.</Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Full name"
              leftIcon="person-outline"
              placeholder="Enter your full name"
              autoComplete="name"
              value={name}
              onChangeText={setName}
            />
            <TextField
              label="Phone number"
              leftIcon="call-outline"
              placeholder="07XX XXX XXX"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phone}
              onChangeText={onChangePhone}
            />

            {/* Fallback button if the auto-send failed for a complete number. */}
            {phone.length === 10 && !otpSent && (
              <Button
                label={sending ? 'Sending…' : 'Send code'}
                variant="secondary"
                onPress={() => sendOtp(phone)}
                loading={sending}
              />
            )}

            {otpSent && (
              <View style={styles.otpSection}>
                {verified ? (
                  <View style={styles.verifiedRow}>
                    <Ionicons name="checkmark-circle" size={20} color={Brand.success} />
                    <Text style={styles.verifiedText}>Phone number verified</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.otpLabel}>Enter the 6-digit code sent to {phone}</Text>
                    <OtpInput value={code} onChange={setCode} />

                    {devCode ? (
                      <View style={styles.devHint}>
                        <Text style={styles.devLabel}>DEV · code from backend console</Text>
                        <Text style={styles.devCode}>{devCode}</Text>
                      </View>
                    ) : null}

                    {verifying ? (
                      <Text style={styles.verifyingText}>Verifying…</Text>
                    ) : (
                      <Pressable onPress={() => sendOtp(phone)} hitSlop={8} style={styles.resendBtn}>
                        <Text style={styles.resendText}>Resend code</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            )}

            {verified && (
              <Pressable onPress={() => setAgreed((v) => !v)} style={styles.terms} hitSlop={6}>
                <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                  {agreed && <Ionicons name="checkmark" size={16} color={Brand.textOnPrimary} />}
                </View>
                <Text style={styles.termsText}>
                  I agree to SafePay&apos;s <Text style={styles.link}>Terms</Text> and{' '}
                  <Text style={styles.link}>Privacy Policy</Text>.
                </Text>
              </Pressable>
            )}

            <Button
              label="Continue"
              onPress={handleContinue}
              loading={loading}
              disabled={!canContinue}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
          <Text style={styles.footerLink}>Log in</Text>
        </Pressable>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
    gap: Spacing.xl,
    flexGrow: 1,
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
  form: {
    gap: Spacing.md,
  },
  otpSection: {
    gap: Spacing.sm,
  },
  otpLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textSecondary,
    textAlign: 'center',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
  },
  verifiedText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.success,
  },
  verifyingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textMuted,
    textAlign: 'center',
  },
  resendBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.xs,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primary,
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
  terms: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: Brand.surface,
  },
  checkboxOn: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Brand.textSecondary,
  },
  link: {
    color: Brand.primary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  footerText: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primary,
  },
});
