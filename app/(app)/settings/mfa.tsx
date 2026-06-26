import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, auth } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useBiometrics } from '@/lib/biometrics';
import { useMFA, type Method } from '@/lib/mfa';

type Option = {
  value: Method;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
};

const OPTIONS: Option[] = [
  {
    value: 'otp',
    icon: 'chatbubble-ellipses-outline',
    title: 'SMS one-time code',
    detail: 'We text a 6-digit code to your registered mobile number each time.',
  },
  {
    value: 'pin',
    icon: 'keypad-outline',
    title: 'App PIN / biometric',
    detail: 'Confirm with your transaction PIN (or biometric) right inside the app.',
  },
];

export default function MfaSetupScreen() {
  const { user } = useAuth();
  const { enabled: bioEnabled } = useBiometrics();
  const { enabled, setEnabled, method, setMethod } = useMFA();
  const [sending, setSending] = useState(false);

  const sendTestCode = async () => {
    if (!user?.phone) {
      Alert.alert('No mobile number', 'Add a mobile number to your account to use SMS codes.');
      return;
    }
    setSending(true);
    try {
      const res = await auth.otp.send(user.phone, 'sensitive_action');
      Alert.alert(
        'Code sent',
        res.debug_code
          ? `A verification code was sent to ${user.phone}.\n\nDev code: ${res.debug_code}`
          : `A verification code was sent to ${user.phone}.`,
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not send a code right now.';
      Alert.alert('Failed to send', msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconBadge}>
          <Ionicons name="shield-checkmark" size={30} color={Brand.primary} />
        </View>
        <Text style={styles.title}>Two-factor verification</Text>
        <Text style={styles.subtitle}>
          An extra check when SafePay AI flags a high-risk transaction. This always applies to
          high-risk payments — choose how you&apos;d like to confirm.
        </Text>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={[styles.rowIcon, { backgroundColor: Brand.primarySoft }]}>
              <Ionicons name="lock-closed-outline" size={20} color={Brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Extra verification</Text>
              <Text style={styles.rowHint}>
                {enabled
                  ? 'On — also step up for sensitive account changes'
                  : 'High-risk payments still require it'}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: Brand.border, true: Brand.primary }}
              thumbColor={Brand.text}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Verification method</Text>
        <View style={styles.options}>
          {OPTIONS.map((opt) => {
            const active = method === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setMethod(opt.value)}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && { opacity: 0.9 },
                ]}>
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: active ? Brand.primarySoft : Brand.surfaceElevated },
                  ]}>
                  <Ionicons name={opt.icon} size={20} color={active ? Brand.primary : Brand.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{opt.title}</Text>
                  <Text style={styles.rowHint}>{opt.detail}</Text>
                </View>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={active ? Brand.primary : Brand.textMuted}
                />
              </Pressable>
            );
          })}
        </View>

        {method === 'otp' && (
          <Pressable
            onPress={sendTestCode}
            disabled={sending}
            style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.85 }]}>
            <Ionicons name="paper-plane-outline" size={18} color={Brand.primary} />
            <Text style={styles.testText}>
              {sending ? 'Sending…' : 'Send me a test code'}
            </Text>
          </Pressable>
        )}

        {method === 'pin' && !bioEnabled && (
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={Brand.textMuted} />
            <Text style={styles.noteText}>
              Tip: turn on biometric sign-in in Profile to confirm with Face ID / fingerprint
              instead of typing your PIN.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.35)',
    alignSelf: 'center',
    marginTop: Spacing.sm,
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
    marginBottom: Spacing.sm,
  },
  card: {
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginTop: Spacing.sm,
  },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  optionActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primarySoft,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 14, fontWeight: '700', color: Brand.text },
  rowHint: { fontSize: 11, color: Brand.textMuted, marginTop: 2, lineHeight: 15 },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Brand.primary,
    backgroundColor: Brand.primarySoft,
    marginTop: Spacing.sm,
  },
  testText: { fontSize: 15, fontWeight: '700', color: Brand.primary },
  note: {
    flexDirection: 'row',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surfaceElevated,
    marginTop: Spacing.xs,
  },
  noteText: { flex: 1, fontSize: 12, color: Brand.textSecondary, lineHeight: 17 },
});
