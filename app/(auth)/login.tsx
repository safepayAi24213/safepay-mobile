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
import { PinDots, PinPad } from '@/components/ui/pin-pad';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, auth } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { authenticateBiometric, useBiometrics } from '@/lib/biometrics';
import { useDevice } from '@/lib/device-context';
import { describeDevice } from '@/lib/device-fingerprint';
import { clearSession, loadSession, type StoredSession } from '@/lib/session-store';

type Mode = 'pin' | 'password';

const PIN_LENGTH = 4;

export default function Login() {
  const router = useRouter();
  const { setSession, restore } = useAuth();
  const { capability, enabled: bioEnabled } = useBiometrics();
  const { fingerprint } = useDevice();
  const [mode, setMode] = useState<Mode>('pin');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [stored, setStored] = useState<StoredSession | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const autoPrompted = useRef(false);

  // Look for a previously-saved session that Face ID can unlock.
  useEffect(() => {
    loadSession().then(setStored);
  }, []);

  const deviceCtx = fingerprint
    ? {
        device_id: fingerprint.id,
        device_name: describeDevice(fingerprint),
        platform: fingerprint.platform,
      }
    : undefined;

  const handlePinLogin = async (fullPin: string) => {
    if (loading) return;
    if (phone.trim().length < 6) {
      Alert.alert('Mobile number needed', 'Enter the mobile number on your account first.');
      setPin('');
      return;
    }
    setLoading(true);
    try {
      const result = await auth.loginPin(phone.trim(), fullPin, deviceCtx);
      setSession(result);
      router.replace('/(app)/(tabs)');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
      Alert.alert('Login failed', msg);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= PIN_LENGTH || loading) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) handlePinLogin(next);
  };

  const handlePasswordLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Missing info', 'Enter email or phone and your password to continue.');
      return;
    }
    setLoading(true);
    try {
      const result = await auth.login(identifier.trim(), password, deviceCtx);
      setSession(result);
      router.replace('/(app)/(tabs)');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
      Alert.alert('Login failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    if (bioBusy) return;
    if (!stored) {
      Alert.alert(
        `Set up ${capability.label} first`,
        'Sign in with your PIN once, then enable Face ID in Profile to use it next time.',
      );
      return;
    }
    setBioBusy(true);
    try {
      const ok = await authenticateBiometric(`Sign in with ${capability.label}`);
      if (!ok) return;
      // Make sure the saved token is still valid before trusting it.
      try {
        await auth.me(stored.token);
      } catch {
        await clearSession();
        setStored(null);
        Alert.alert('Session expired', 'Please sign in with your PIN to continue.');
        return;
      }
      restore(stored.token, stored.user);
      router.replace('/(app)/(tabs)');
    } finally {
      setBioBusy(false);
    }
  };

  const showBiometric =
    !!stored && bioEnabled && capability.available && capability.enrolled;
  const bioIcon: keyof typeof Ionicons.glyphMap =
    capability.kind === 'face' ? 'scan-outline' : 'finger-print-outline';

  // Auto-prompt Face ID once when a saved session is available — feels like a
  // native "unlock" rather than making the user hunt for the button.
  useEffect(() => {
    if (showBiometric && !autoPrompted.current) {
      autoPrompted.current = true;
      handleBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBiometric]);

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
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              {mode === 'pin'
                ? 'Enter your mobile number and PIN to continue.'
                : 'Log in with your email or phone and password.'}
            </Text>
          </View>

          {mode === 'pin' ? (
            <View style={styles.form}>
              <TextField
                label="Mobile number"
                leftIcon="call-outline"
                autoCapitalize="none"
                autoComplete="tel"
                keyboardType="phone-pad"
                placeholder="07XX XXX XXX"
                value={phone}
                onChangeText={setPhone}
              />

              <View style={styles.pinBlock}>
                <Text style={styles.pinLabel}>Enter your PIN</Text>
                <PinDots length={PIN_LENGTH} filled={pin.length} />
                <PinPad
                  onDigit={handlePinDigit}
                  onBackspace={() => setPin((p) => p.slice(0, -1))}
                />
              </View>

              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                hitSlop={8}
                style={styles.forgotWrap}>
                <Text style={styles.forgot}>Forgot PIN or password?</Text>
              </Pressable>

              {showBiometric && (
                <>
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  <Pressable
                    onPress={handleBiometric}
                    disabled={bioBusy}
                    style={({ pressed }) => [styles.bioBtn, pressed && { opacity: 0.85 }]}>
                    <Ionicons name={bioIcon} size={22} color={Brand.primary} />
                    <Text style={styles.bioBtnLabel}>
                      {bioBusy ? 'Unlocking…' : `Unlock with ${capability.label}`}
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable
                onPress={() => {
                  setMode('password');
                  setPin('');
                }}
                hitSlop={8}
                style={styles.altWrap}>
                <Text style={styles.altText}>Use email &amp; password instead</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <TextField
                label="Email or phone"
                leftIcon="person-outline"
                autoCapitalize="none"
                autoComplete="username"
                keyboardType="email-address"
                placeholder="Enter email or phone number"
                value={identifier}
                onChangeText={setIdentifier}
              />
              <TextField
                label="Password"
                leftIcon="lock-closed-outline"
                password
                autoComplete="password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
              />

              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                hitSlop={8}
                style={styles.forgotWrap}>
                <Text style={styles.forgot}>Forgot password?</Text>
              </Pressable>

              <Button label="Log in" onPress={handlePasswordLogin} loading={loading} />

              <Pressable
                onPress={() => {
                  setMode('pin');
                  setPassword('');
                }}
                hitSlop={8}
                style={styles.altWrap}>
                <Text style={styles.altText}>Use mobile number &amp; PIN instead</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to SafePay? </Text>
        <Pressable onPress={() => router.replace('/(auth)/register')} hitSlop={8}>
          <Text style={styles.footerLink}>Create account</Text>
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
    paddingBottom: Spacing.xl,
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
  form: {
    gap: Spacing.md,
  },
  pinBlock: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  pinLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: Spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Brand.border },
  dividerText: { fontSize: 11, color: Brand.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    backgroundColor: Brand.primarySoft,
  },
  bioBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.primary,
    letterSpacing: 0.2,
  },
  forgotWrap: {
    alignSelf: 'center',
  },
  forgot: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primary,
  },
  altWrap: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
  },
  altText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.textSecondary,
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
