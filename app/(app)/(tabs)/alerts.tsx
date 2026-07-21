import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAccountState } from '@/lib/account-state';
import { alerts as apiAlerts, type ApiFraudAlert } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRWF } from '@/lib/format';
import type { RiskLevel } from '@/lib/risk-engine';

type AlertStatus = 'pending' | 'confirmed' | 'reported';

type FraudAlert = {
  id: string;
  at: string;
  amount: number;
  recipientName: string;
  recipientDetail: string;
  riskLevel: RiskLevel;
  confidence: number;
  signals: string[];
  status: AlertStatus;
  icon: keyof typeof Ionicons.glyphMap;
};

type Filter = 'pending' | 'resolved' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const LEVEL_META: Record<RiskLevel, { color: string; bg: string; label: string }> = {
  low: { color: Brand.success, bg: Brand.successSoft, label: 'Low' },
  medium: { color: Brand.warning, bg: Brand.warningSoft, label: 'Medium' },
  high: { color: Brand.danger, bg: Brand.dangerSoft, label: 'High' },
  blocked: { color: Brand.critical, bg: Brand.criticalSoft, label: 'Blocked' },
};

function fromApi(a: ApiFraudAlert): FraudAlert {
  return {
    id: a.id,
    at: new Date(a.created_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
    amount: a.amount ? parseFloat(a.amount) : 0,
    recipientName: a.recipient_name ?? a.summary,
    recipientDetail: a.recipient_phone ?? a.signals.map((s) => s.code).slice(0, 2).join(', '),
    riskLevel: a.level,
    confidence: parseFloat(a.confidence),
    signals: a.signals.map((s) => s.label),
    status: a.status === 'auto_blocked' ? 'pending' : a.status,
    icon: a.level === 'blocked' ? 'close-circle' :
          a.level === 'high' ? 'warning' : 'alert-circle',
  };
}

export default function Alerts() {
  const { freeze } = useAccountState();
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1);
    }, []),
  );

  useEffect(() => {
    if (!token) {
      setAlerts([]);
      return;
    }
    let cancelled = false;
    apiAlerts
      .list(token, { limit: 50 })
      .then((r) => {
        if (cancelled) return;
        setAlerts(r.items.map(fromApi));
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      });
    return () => { cancelled = true; };
  }, [token, reloadKey]);

  const visible = useMemo(() => {
    if (filter === 'all') return alerts;
    if (filter === 'pending') return alerts.filter((a) => a.status === 'pending');
    return alerts.filter((a) => a.status !== 'pending');
  }, [alerts, filter]);

  const pendingCount = alerts.filter((a) => a.status === 'pending').length;

  const reportFraud = (id: string) => {
    Alert.alert(
      'Reported as fraud',
      'SafePay will review and refund if confirmed. Do you also want to freeze your account to block any further payments?',
      [
        {
          text: 'Just report',
          onPress: async () => {
            setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'reported' } : a)));
            if (token) {
              try { await apiAlerts.respond(token, id, 'report_fraud'); } catch {}
            }
          },
        },
        {
          text: 'Report & freeze',
          style: 'destructive',
          onPress: async () => {
            setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'reported' } : a)));
            freeze('fraud_report');
            if (token) {
              try { await apiAlerts.respond(token, id, 'report_fraud', true); } catch {}
            }
          },
        },
      ],
    );
  };

  const confirmMine = async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a)));
    if (token) {
      try { await apiAlerts.respond(token, id, 'yes_me'); } catch {}
    }
    Alert.alert('Confirmed it was you', 'Thanks — your account stays open.');
  };

  const updateStatus = (id: string, status: AlertStatus) => {
    if (status === 'reported') reportFraud(id);
    else if (status === 'confirmed') confirmMine(id);
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Alerts</Text>
          <Text style={styles.subtitle}>SafePay AI flags anything unusual on your account.</Text>
        </View>
        <View style={styles.pendingPill}>
          <View style={styles.pendingDot} />
          <Text style={styles.pendingText}>{pendingCount} pending</Text>
        </View>
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

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark-outline" size={42} color={Brand.success} />
            <Text style={styles.emptyText}>You’re all clear</Text>
            <Text style={styles.emptyHint}>No alerts in this view.</Text>
          </View>
        ) : (
          visible.map((a) => {
            const meta = LEVEL_META[a.riskLevel];
            const isPending = a.status === 'pending';
            return (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.cardIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={a.icon} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle}>
                        RWF {formatRWF(a.amount, { hideSign: true })}
                      </Text>
                      <View style={[styles.levelPill, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.levelText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardSub}>to {a.recipientName}</Text>
                    <Text style={styles.cardMeta}>
                      {a.recipientDetail} · {a.at}
                    </Text>
                  </View>
                </View>

                <View style={styles.signalsBlock}>
                  <Text style={styles.signalsTitle}>
                    SafePay AI flagged{' '}
                    <Text style={{ color: meta.color }}>{a.confidence}% confidence</Text>
                  </Text>
                  {a.signals.map((s, i) => (
                    <View key={i} style={styles.signalRow}>
                      <View style={[styles.signalDot, { backgroundColor: meta.color }]} />
                      <Text style={styles.signalText}>{s}</Text>
                    </View>
                  ))}
                </View>

                {isPending ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => updateStatus(a.id, 'confirmed')}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.confirmBtn,
                        pressed && { opacity: 0.85 },
                      ]}>
                      <Ionicons name="checkmark" size={16} color={Brand.success} />
                      <Text style={[styles.actionText, { color: Brand.success }]}>
                        Yes, it was me
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => updateStatus(a.id, 'reported')}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.reportBtn,
                        pressed && { opacity: 0.85 },
                      ]}>
                      <Ionicons name="alert" size={16} color={Brand.danger} />
                      <Text style={[styles.actionText, { color: Brand.danger }]}>
                        No, block & report
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.resolvedRow}>
                    <Ionicons
                      name={a.status === 'reported' ? 'shield-half' : 'checkmark-circle-outline'}
                      size={14}
                      color={a.status === 'reported' ? Brand.danger : Brand.success}
                    />
                    <Text style={[styles.resolvedText, { color: a.status === 'reported' ? Brand.danger : Brand.success }]}>
                      {a.status === 'reported' ? 'Reported as fraud' : 'Confirmed it was you'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  title: { fontSize: 26, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: Brand.textSecondary, marginTop: 2, maxWidth: 240 },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Brand.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.danger,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.danger,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
    alignItems: 'center',
  },
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

  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  cardSub: { fontSize: 13, color: Brand.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: Brand.textMuted, marginTop: 2 },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  signalsBlock: {
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Brand.surfaceElevated,
  },
  signalsTitle: { fontSize: 12, fontWeight: '700', color: Brand.textSecondary, marginBottom: 2 },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signalDot: { width: 6, height: 6, borderRadius: 3 },
  signalText: { fontSize: 12, color: Brand.textSecondary, flex: 1 },

  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  confirmBtn: {
    backgroundColor: Brand.successSoft,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  reportBtn: {
    backgroundColor: Brand.dangerSoft,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  actionText: { fontSize: 13, fontWeight: '700' },

  resolvedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  resolvedText: { fontSize: 12, fontWeight: '700' },

  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.text },
  emptyHint: { fontSize: 12, color: Brand.textMuted },
});
