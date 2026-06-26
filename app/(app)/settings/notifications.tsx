import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, users, type NotificationPrefs } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Row = {
  key: keyof NotificationPrefs;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CHANNELS: Row[] = [
  { key: 'push_enabled', label: 'Push notifications', hint: 'Alerts on this device', icon: 'phone-portrait-outline' },
  { key: 'sms_enabled', label: 'SMS', hint: 'Text messages', icon: 'chatbox-outline' },
  { key: 'email_enabled', label: 'Email', hint: 'Email updates', icon: 'mail-outline' },
];
const CATEGORIES: Row[] = [
  { key: 'txn_alerts', label: 'Transaction alerts', hint: 'Every payment you make or receive', icon: 'swap-horizontal-outline' },
  { key: 'fraud_alerts', label: 'Fraud alerts', hint: 'When SafePay AI flags something risky', icon: 'shield-checkmark-outline' },
  { key: 'marketing', label: 'Offers & news', hint: 'Occasional product updates', icon: 'megaphone-outline' },
];

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    users.notifications
      .get(token)
      .then(setPrefs)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load preferences.'));
  }, [token]);

  const toggle = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!token || !prefs) return;
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value }); // optimistic
    try {
      const updated = await users.notifications.update(token, { [key]: value });
      setPrefs(updated);
    } catch (e) {
      setPrefs(prev); // revert on failure
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <View style={styles.content}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.sub}>Choose how and what SafePay tells you.</Text>

        {!prefs ? (
          <ActivityIndicator color={Brand.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <>
            <Section title="Channels" rows={CHANNELS} prefs={prefs} onToggle={toggle} />
            <Section title="What to notify me about" rows={CATEGORIES} prefs={prefs} onToggle={toggle} />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

function Section({
  title,
  rows,
  prefs,
  onToggle,
}: {
  title: string;
  rows: Row[];
  prefs: NotificationPrefs;
  onToggle: (key: keyof NotificationPrefs, value: boolean) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Ionicons name={r.icon} size={20} color={Brand.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowHint}>{r.hint}</Text>
            </View>
            <Switch
              value={prefs[r.key]}
              onValueChange={(v) => onToggle(r.key, v)}
              trackColor={{ false: Brand.border, true: Brand.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: Brand.textSecondary, marginTop: -Spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Brand.textMuted,
    marginLeft: 2,
  },
  card: {
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Brand.border },
  rowLabel: { fontSize: 14, fontWeight: '700', color: Brand.text },
  rowHint: { fontSize: 12, color: Brand.textMuted, marginTop: 2 },
  error: { fontSize: 13, fontWeight: '600', color: Brand.danger },
});
