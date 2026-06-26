import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { security, type LoginEventDTO } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Filter = 'all' | 'success' | 'failure' | 'blocked';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Successful' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'failure', label: 'Failed' },
];

const STATUS_META: Record<
  LoginEventDTO['status'],
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }
> = {
  success: {
    icon: 'checkmark-circle',
    color: Brand.success,
    bg: Brand.successSoft,
    label: 'Successful',
  },
  failure: {
    icon: 'close-circle',
    color: Brand.danger,
    bg: Brand.dangerSoft,
    label: 'Failed',
  },
  blocked: {
    icon: 'shield-checkmark',
    color: Brand.warning,
    bg: Brand.warningSoft,
    label: 'Blocked',
  },
};

export default function LoginHistoryScreen() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [events, setEvents] = useState<LoginEventDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    security.loginHistory(token, 100)
      .then((r) => { if (!cancelled) setEvents(r.items); })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const visible = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.status === filter)),
    [events, filter],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Login history</Text>
          <Text style={styles.subtitle}>
            Recent sign-in attempts on your account. Flag anything you don&apos;t recognise.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[styles.filter, active && styles.filterActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={Brand.primary} />
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((e) => {
              const meta = STATUS_META[e.status];
              return (
                <View key={e.id} style={styles.row}>
                  <View style={[styles.statusIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.device}>{e.device_name ?? 'Unknown device'}</Text>
                      <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {e.platform && <Text style={styles.meta}>{e.platform}</Text>}
                    <Text style={styles.meta}>
                      {[e.location, e.ip_address].filter(Boolean).join(' · ') || 'Location unknown'}
                    </Text>
                    {e.reason && <Text style={styles.meta}>Reason: {e.reason}</Text>}
                    <Text style={styles.timestamp}>{new Date(e.created_at).toLocaleString()}</Text>
                  </View>
                </View>
              );
            })}
            {visible.length === 0 && (
              <Text style={styles.empty}>No sign-ins match that filter.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg },
  header: { gap: Spacing.sm, marginTop: Spacing.sm },
  title: { fontSize: 26, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, lineHeight: 20, color: Brand.textSecondary },
  filterScroll: { flexGrow: 0 },
  filterRow: { gap: 8, paddingVertical: 4, alignItems: 'center' },
  filter: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: Brand.textSecondary },
  filterTextActive: { color: Brand.textOnPrimary },
  list: { gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  device: { fontSize: 14, fontWeight: '700', color: Brand.text },
  statusLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  meta: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  timestamp: { fontSize: 11, color: Brand.textMuted, marginTop: 4, fontStyle: 'italic' },
  empty: { textAlign: 'center', color: Brand.textMuted, paddingVertical: Spacing.xl },
});
