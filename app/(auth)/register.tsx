import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Spacing } from '@/constants/theme';
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
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = name && email && phone && password.length >= 6 && agreed;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      // 1. Create the account in Postgres + sign in.
      const token = await auth.register({
        email: email.trim(),
        full_name: name.trim(),
        phone: phone.trim(),
        password,
      }, deviceCtx);
      setSession(token);

      // 2. Issue an OTP for phone verification. The backend prints the code to
      // its console; in production this would be an SMS.
      const otp = await auth.otp.send(phone.trim(), 'register');

      // 3. Move to the OTP screen. In dev we pre-fill via params so the user
      // can see the code; in production debug_code will be null.
      router.push({
        pathname: '/(auth)/otp',
        params: {
          next: 'verify-id',
          phone: phone.trim(),
          context: 'register',
          purpose: 'register',
          dev_code: otp.debug_code ?? '',
        },
      });
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
            <Text style={styles.subtitle}>We&apos;ll send a code to verify your phone.</Text>
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
              label="Email"
              leftIcon="mail-outline"
              placeholder="Enter your email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="Phone number"
              leftIcon="call-outline"
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              autoComplete="tel"
              value={phone}
              onChangeText={setPhone}
            />
            <TextField
              label="Password"
              leftIcon="lock-closed-outline"
              placeholder="Create a password"
              password
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />

            <Pressable
              onPress={() => setAgreed((v) => !v)}
              style={styles.terms}
              hitSlop={6}>
              <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed && <Ionicons name="checkmark" size={16} color={Brand.textOnPrimary} />}
              </View>
              <Text style={styles.termsText}>
                I agree to SafePay&apos;s <Text style={styles.link}>Terms</Text> and{' '}
                <Text style={styles.link}>Privacy Policy</Text>.
              </Text>
            </Pressable>

            <Button
              label="Continue"
              onPress={handleSubmit}
              loading={loading}
              disabled={!canSubmit}
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
