import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
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
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, auth } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const RESEND_SECONDS = 30;

/** Mask all but the last 3 digits, formatted as "+••• ••• ••• 421". */
function maskPhone(raw?: string | null): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return raw;
  const last3 = digits.slice(-3);
  return `••• ••• ••• ${last3}`;
}

export default function DeviceVerify() {
  const router = useRouter();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string>('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);

  const maskedPhone = useMemo(() => maskPhone(user?.phone), [user?.phone]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  // Auto-issue an OTP when this screen mounts.
  useEffect(() => {
    if (!user?.phone) return;
    auth.otp.send(user.phone, 'device_verify')
      .then((r) => {
        if (r.debug_code) {
          setDevCode(r.debug_code);
          setCode(r.debug_code);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value?: string) => {
    const candidate = value ?? code;
    if (candidate.length !== 6 || !user?.phone) return;
    setLoading(true);
    try {
      await auth.otp.verify(user.phone, candidate, 'device_verify');
      router.replace('/(app)/(tabs)');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Verification failed.';
      Alert.alert('Try again', msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (seconds > 0 || !user?.phone) return;
    try {
      const r = await auth.otp.send(user.phone, 'device_verify');
      if (r.debug_code) {
        setDevCode(r.debug_code);
        setCode(r.debug_code);
      }
      setSeconds(RESEND_SECONDS);
    } catch {
      // silent
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
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.iconBadgeOuter}>
              <View style={styles.iconBadgeInner}>
                <Ionicons name="shield-checkmark" size={28} color={Brand.primary} />
              </View>
            </View>
            <Text style={styles.title}>Verify this device</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to your number.
            </Text>
            {maskedPhone ? (
              <View style={styles.phonePill}>
                <Ionicons name="call-outline" size={13} color={Brand.text} />
                <Text style={styles.phonePillText}>{maskedPhone}</Text>
              </View>
            ) : null}
          </View>

          {/* OTP card */}
          <View style={styles.card}>
            {devCode ? (
              <View style={styles.devChip}>
                <Text style={styles.devChipLabel}>DEV CODE</Text>
                <Text style={styles.devChipValue}>{devCode}</Text>
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
                <Text style={styles.resendMuted}>
                  Didn&apos;t get it? Resend in{' '}
                  <Text style={styles.resendSeconds}>{seconds}s</Text>
                </Text>
              ) : (
                <Pressable onPress={resend} hitSlop={8} style={styles.resendBtn}>
                  <Ionicons name="refresh" size={14} color={Brand.primary} />
                  <Text style={styles.resendActive}>Resend code</Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label="Verify device"
            onPress={() => {
              Keyboard.dismiss();
              submit();
            }}
            disabled={code.length !== 6}
            loading={loading}
          />
          <Pressable
            onPress={() => router.replace('/(auth)/welcome')}
            style={styles.notMe}
            hitSlop={8}>
            <Text style={styles.notMeText}>This isn&apos;t me</Text>
          </Pressable>
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
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },

  hero: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBadgeOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(6,182,212,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    marginTop: 2,
  },
  phonePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    letterSpacing: 1,
  },

  card: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: Spacing.lg,
    alignItems: 'center',
  },

  devChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Brand.aiSoft,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  devChipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: Brand.ai,
    textTransform: 'uppercase',
  },
  devChipValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3,
    color: Brand.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },

  resendRow: {
    alignItems: 'center',
  },
  resendMuted: {
    fontSize: 13,
    color: Brand.textMuted,
  },
  resendSeconds: {
    fontWeight: '700',
    color: Brand.text,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendActive: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primary,
  },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  notMe: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  notMeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textMuted,
  },
});
