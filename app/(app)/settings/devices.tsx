import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { security, type TrustedDeviceDTO } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDevice } from '@/lib/device-context';
import { describeDevice } from '@/lib/device-fingerprint';

export default function DevicesScreen() {
  const { token } = useAuth();
  const { fingerprint } = useDevice();
  const [devices, setDevices] = useState<TrustedDeviceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    security.devices(token)
      .then((r) => { if (!cancelled) setDevices(r.items); })
      .catch(() => { if (!cancelled) setDevices([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const trustThisDevice = async () => {
    if (!token || !fingerprint || registering) return;
    setRegistering(true);
    try {
      const created = await security.registerDevice(token, {
        device_id: fingerprint.id,
        device_name: describeDevice(fingerprint),
        platform: fingerprint.platform,
        model: fingerprint.model,
      });
      setDevices((d) => {
        const others = d.filter((x) => x.device_id !== created.device_id);
        return [created, ...others];
      });
    } catch (err) {
      Alert.alert('Could not trust device', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setRegistering(false);
    }
  };

  const remove = (pk: string, name: string) => {
    if (!token) return;
    Alert.alert(
      `Remove ${name}?`,
      'This device will need to verify again next time it signs in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await security.revokeDevice(token, pk);
              setDevices((d) => d.filter((x) => x.id !== pk));
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Try again.');
            }
          },
        },
      ],
    );
  };

  const visible = devices.filter((d) => !d.revoked_at);
  const fingerprintAlreadyTrusted = !!(
    fingerprint && visible.some((d) => d.device_id === fingerprint.id)
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Trusted devices</Text>
          <Text style={styles.subtitle}>
            Devices on this list skip step-up verification. Remove any you don&apos;t use.
          </Text>
        </View>

        {fingerprint && (
          <View style={styles.fingerprintCard}>
            <View style={styles.fingerprintHeader}>
              <Ionicons name="finger-print" size={20} color={Brand.ai} />
              <Text style={styles.fingerprintTitle}>This device fingerprint</Text>
            </View>
            <Text style={styles.fingerprintLine}>{describeDevice(fingerprint)}</Text>
            <Text style={styles.fingerprintId} numberOfLines={1} ellipsizeMode="middle">
              {fingerprint.id}
            </Text>
            {!fingerprintAlreadyTrusted && (
              <Pressable
                onPress={trustThisDevice}
                disabled={registering}
                style={({ pressed }) => [
                  styles.trustBtn,
                  pressed && { opacity: 0.85 },
                ]}>
                <Ionicons name="shield-checkmark" size={14} color={Brand.ai} />
                <Text style={styles.trustBtnText}>
                  {registering ? 'Adding…' : 'Trust this device'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {loading ? (
          <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={Brand.primary} />
          </View>
        ) : visible.length === 0 ? (
          <Text style={styles.empty}>No trusted devices yet.</Text>
        ) : (
          <View style={styles.list}>
            {visible.map((d) => (
              <View key={d.id} style={styles.card}>
                <View style={styles.cardIcon}>
                  <Ionicons
                    name={(d.platform ?? '').toLowerCase().includes('ios') ? 'phone-portrait' : 'laptop-outline'}
                    size={22}
                    color={Brand.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{d.device_name}</Text>
                    {d.is_current && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardMeta}>
                    {[d.platform, d.model].filter(Boolean).join(' · ') || '—'}
                  </Text>
                  <Text style={styles.cardMeta}>
                    Added {new Date(d.created_at).toLocaleDateString()} · Last used {new Date(d.last_used_at).toLocaleDateString()}
                  </Text>
                </View>
                {!d.is_current && (
                  <Pressable onPress={() => remove(d.id, d.device_name)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={20} color={Brand.danger} />
                  </Pressable>
                )}
              </View>
            ))}
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
  fingerprintCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.aiSoft,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    gap: 4,
  },
  fingerprintHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fingerprintTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ai,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  fingerprintLine: { fontSize: 14, fontWeight: '700', color: Brand.text },
  fingerprintId: { fontSize: 11, color: Brand.textMuted, fontFamily: 'Courier' },
  trustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(139,92,246,0.14)',
    marginTop: 6,
  },
  trustBtnText: { fontSize: 12, fontWeight: '700', color: Brand.ai },
  empty: { textAlign: 'center', color: Brand.textMuted, paddingVertical: Spacing.xl },
  list: { gap: Spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
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
});
