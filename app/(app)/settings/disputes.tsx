import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { alerts as apiAlerts, type ApiFraudAlert } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const LEVEL_COLOR: Record<string, string> = {
  low: Brand.success,
  medium: Brand.warning,
  high: Brand.danger,
  blocked: Brand.critical,
};

function statusMeta(a: ApiFraudAlert): { label: string; color: string; bg: string } {
  if (a.resolved_at && a.status === 'reported') {
    return { label: 'Resolved', color: Brand.success, bg: Brand.successSoft };
  }
  if (a.status === 'auto_blocked') {
    return { label: 'Auto-blocked', color: Brand.critical, bg: Brand.criticalSoft };
  }
  return { label: 'Under review', color: Brand.warning, bg: Brand.warningSoft };
}

export default function DisputesScreen() {
  const { token } = useAuth();
  const [disputes, setDisputes] = useState<ApiFraudAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiAlerts
      .list(token, { limit: 100 })
      .then((r) => {
        if (cancelled) return;
        // A dispute is an alert the customer reported as fraud, or one SafePay
        // auto-blocked on their behalf.
        setDisputes(
          r.items.filter((a) => a.status === 'reported' || a.status === 'auto_blocked'),
        );
      })
      .catch(() => { if (!cancelled) setDisputes([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Disputes</Text>
        <Text style={styles.subtitle}>Fraud reports you’ve raised and their status.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : disputes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={42} color={Brand.success} />
          <Text style={styles.emptyTitle}>No disputes</Text>
          <Text style={styles.emptyHint}>
            When you report a transaction as fraud, it shows up here so you can track it.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {disputes.map((d) => {
            const meta = statusMeta(d);
            const at = new Date(d.created_at).toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            const levelColor = LEVEL_COLOR[d.level] ?? Brand.textMuted;
            return (
              <View key={d.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: Brand.dangerSoft }]}>
                    <Ionicons name="shield-half" size={20} color={Brand.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{d.summary}</Text>
                    <Text style={styles.cardMeta}>Case #{d.id.slice(0, 8).toUpperCase()} · {at}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                {d.signals.length > 0 && (
                  <View style={styles.signals}>
                    {d.signals.slice(0, 3).map((s, i) => (
                      <View key={i} style={styles.signalRow}>
                        <View style={[styles.signalDot, { backgroundColor: levelColor }]} />
                        <Text style={styles.signalText}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.footer}>
                  <Ionicons name="information-circle-outline" size={14} color={Brand.textMuted} />
                  <Text style={styles.footerText}>
                    {meta.label === 'Resolved'
                      ? 'Reviewed by our fraud team. Any wrongful charge has been refunded.'
                      : 'Our fraud team is reviewing this. We’ll notify you when it’s resolved.'}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  titleBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontSize: 26, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: Brand.textSecondary, marginTop: 2 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },
  emptyHint: { fontSize: 13, color: Brand.textMuted, textAlign: 'center', lineHeight: 18 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: 10 },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: Brand.text },
  cardMeta: { fontSize: 11, color: Brand.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  signals: {
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Brand.surfaceElevated,
  },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signalDot: { width: 6, height: 6, borderRadius: 3 },
  signalText: { flex: 1, fontSize: 12, color: Brand.textSecondary },
  footer: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  footerText: { flex: 1, fontSize: 11, color: Brand.textMuted, lineHeight: 16 },
});
