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

type Step = 'phone' | 'verify';

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (phone.trim().length < 6) return;
    setLoading(true);
    try {
      const r = await auth.otp.send(phone.trim(), 'forgot_password');
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
    if (code.length !== 6 || newPin.length !== 4) return;
    setLoading(true);
    try {
      await auth.resetPinPhone(phone.trim(), code, newPin);
      Alert.alert('PIN reset', 'You can now sign in with your new PIN.', [
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
          if (step === 'verify') setStep('phone');
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
              {step === 'phone' ? 'Forgot password?' : 'Enter reset code'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? 'Enter the mobile number on your account. We\'ll send a 6-digit reset code.'
                : `We sent a code to ${phone}. Enter it below and choose a new password.`}
            </Text>
          </View>

          {step === 'phone' ? (
            <View style={styles.form}>
              <TextField
                label="Mobile number"
                leftIcon="call-outline"
                placeholder="07XX XXX XXX"
                autoCapitalize="none"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
              />
              <Button
                label="Send code"
                onPress={sendCode}
                loading={loading}
                disabled={phone.trim().length < 6}
              />
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
                label="New PIN"
                leftIcon="lock-closed-outline"
                placeholder="4-digit PIN"
                keyboardType="number-pad"
                maxLength={4}
                password
                value={newPin}
                onChangeText={(t) => setNewPin(t.replace(/[^0-9]/g, ''))}
              />

              <Button
                label="Reset PIN"
                onPress={resetNow}
                loading={loading}
                disabled={code.length !== 6 || newPin.length !== 4}
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
