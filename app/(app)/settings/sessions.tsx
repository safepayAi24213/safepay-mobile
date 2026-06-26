import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { security, type SessionDTO } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function SessionsScreen() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    security.sessions(token)
      .then((r) => { if (!cancelled) setSessions(r.items); })
      .catch(() => { if (!cancelled) setSessions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const revokeOne = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await security.revokeSession(token, id);
      setSessions((s) => s.filter((x) => x.id !== id));
    } catch (err) {
      Alert.alert('Could not sign out that session', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const revokeAll = async () => {
    if (!token) return;
    const others = sessions.filter((s) => !s.is_current && !s.revoked_at);
    for (const s of others) {
      try { await security.revokeSession(token, s.id); } catch {}
    }
    setSessions((prev) => prev.filter((s) => s.is_current));
  };

  const visible = sessions.filter((s) => !s.revoked_at);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Active sessions</Text>
          <Text style={styles.subtitle}>
            These devices are currently signed in to your SafePay account.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={Brand.primary} /></View>
        ) : visible.length === 0 ? (
          <Text style={styles.empty}>No active sessions found.</Text>
        ) : (
          <View style={styles.list}>
            {visible.map((s) => {
              const device = s.device_name ?? 'Unknown device';
              const isPhone = (s.platform ?? '').toLowerCase().includes('ios') || device.toLowerCase().includes('iphone') || device.toLowerCase().includes('android');
              return (
                <View key={s.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardIcon}>
                      <Ionicons
                        name={isPhone ? 'phone-portrait' : 'laptop-outline'}
                        size={22}
                        color={Brand.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardTitle}>{device}</Text>
                        {s.is_current && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>This device</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardMeta}>{s.platform ?? '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <MetaRow
                      icon="location-outline"
                      text={[s.location, s.ip_address].filter(Boolean).join(' · ') || 'Location unknown'}
                    />
                    <MetaRow icon="time-outline" text={`Last seen ${new Date(s.last_seen_at).toLocaleString()}`} />
                  </View>
                  {!s.is_current && (
                    <Pressable
                      onPress={() => revokeOne(s.id)}
                      style={styles.revokeBtn}
                      disabled={busyId === s.id}
                      hitSlop={6}>
                      <Ionicons name="log-out-outline" size={16} color={Brand.danger} />
                      <Text style={styles.revokeText}>{busyId === s.id ? 'Signing out…' : 'Sign out'}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Sign out of all other devices"
          variant="danger"
          onPress={revokeAll}
          disabled={visible.filter((s) => !s.is_current).length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

function MetaRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={14} color={Brand.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg },
  header: { gap: Spacing.sm, marginTop: Spacing.sm },
  title: { fontSize: 26, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, lineHeight: 20, color: Brand.textSecondary },
  loading: { padding: Spacing.xl, alignItems: 'center' },
  empty: { padding: Spacing.lg, textAlign: 'center', color: Brand.textMuted },
  list: { gap: Spacing.md },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: Spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Brand.text },
  cardMeta: { fontSize: 12, color: Brand.textMuted, marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Brand.successSoft,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: Brand.success, letterSpacing: 0.3 },
  cardBody: { gap: 4, paddingLeft: 52 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: Brand.textSecondary },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  revokeText: { fontSize: 13, fontWeight: '700', color: Brand.danger },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
});
