import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { PinDots, PinPad } from '@/components/ui/pin-pad';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Spacing } from '@/constants/theme';
import { ApiError, auth } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDevice } from '@/lib/device-context';
import { describeDevice } from '@/lib/device-fingerprint';

const LOGO = require('@/assets/images/splashlogo.png');

const PIN_LENGTH = 4;

export default function Login() {
  const router = useRouter();
  const { setSession } = useAuth();
  const { fingerprint } = useDevice();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

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
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
            <Text style={styles.title}>Welcome Back</Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Mobile number"
              leftIcon="call-outline"
              autoCapitalize="none"
              autoComplete="tel"
              keyboardType="phone-pad"
              placeholder="07XX XXX XXX"
              value={phone}
              onChangeText={(t) => {
                const digits = t.replace(/[^0-9]/g, '').slice(0, 10);
                setPhone(digits);
                // Full number entered — hide the keyboard so the PIN pad is usable.
                if (digits.length === 10) Keyboard.dismiss();
              }}
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
              <Text style={styles.forgot}>Forgot PIN?</Text>
            </Pressable>
          </View>
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
    gap: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  logo: {
    width: 200,
    height: 96,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.4,
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
  forgotWrap: {
    alignSelf: 'center',
  },
  forgot: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.primary,
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
