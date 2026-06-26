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
import { OtpInput } from '@/components/ui/otp-input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, auth } from '@/lib/api';

type Step = 'email' | 'verify';

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await auth.forgotPassword(email.trim());
      setDebugCode(r.debug_code);
      if (r.debug_code) setCode(r.debug_code);
      setStep('verify');
    } catch (err) {
      Alert.alert('Could not send code', err instanceof ApiError ? err.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetNow = async () => {
    if (code.length !== 6 || newPassword.length < 8) return;
    setLoading(true);
    try {
      await auth.resetPassword(email.trim(), code, newPassword);
      Alert.alert('Password reset', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      Alert.alert('Reset failed', err instanceof ApiError ? err.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        onBack={() => {
          if (step === 'verify') setStep('email');
          else router.back();
        }}
      />
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
            <Text style={styles.title}>
              {step === 'email' ? 'Forgot password?' : 'Enter reset code'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'email'
                ? 'Enter the email on your account. We\'ll send a 6-digit reset code.'
                : `We sent a code to ${email}. Enter it below and choose a new password.`}
            </Text>
          </View>

          {step === 'email' ? (
            <View style={styles.form}>
              <TextField
                label="Email"
                leftIcon="mail-outline"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Button label="Send code" onPress={sendCode} loading={loading} disabled={!email} />
            </View>
          ) : (
            <View style={styles.form}>
              {debugCode ? (
                <View style={styles.devHint}>
                  <Text style={styles.devLabel}>DEV · code from backend console</Text>
                  <Text style={styles.devCode}>{debugCode}</Text>
                </View>
              ) : null}

              <OtpInput value={code} onChange={setCode} />

              <TextField
                label="New password"
                leftIcon="lock-closed-outline"
                placeholder="At least 8 characters"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Button
                label="Reset password"
                onPress={resetNow}
                loading={loading}
                disabled={code.length !== 6 || newPassword.length < 8}
              />

              <Pressable onPress={sendCode} hitSlop={8} style={styles.resendBtn}>
                <Text style={styles.resendText}>Send a new code</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  header: { gap: Spacing.sm, marginTop: Spacing.sm },
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
  form: { gap: Spacing.lg },
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
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { fontSize: 14, fontWeight: '700', color: Brand.primary },
});
