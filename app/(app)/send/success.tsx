import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Brand, Spacing } from '@/constants/theme';
import { transactions as apiTransactions, type ApiTransaction } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRWF } from '@/lib/format';
import { getTransaction } from '@/lib/send-store';

export default function SendSuccess() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();

  // 1. Try the local store first (instant — populated by the sheet on success).
  // 2. If not there (e.g. user navigated here directly / after reload),
  //    fall back to the backend by transaction id.
  const local = id ? getTransaction(id) : undefined;
  const [remote, setRemote] = useState<ApiTransaction | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (local || !id || !token) return;
    setLoading(true);
    let cancelled = false;
    apiTransactions
      .get(token, id)
      .then((t) => { if (!cancelled) setRemote(t); })
      .catch(() => { if (!cancelled) setRemote(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, local, token]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Resolve into a common shape so the markup doesn't branch all over.
  const view = local
    ? {
        kind: local.kind,
        amount: local.amount,
        recipientName: local.recipientName,
        reference: local.reference,
        id: local.id,
      }
    : remote
      ? {
          kind: remote.kind,
          amount: parseFloat(remote.amount),
          recipientName: remote.recipient_name,
          reference: remote.reference,
          id: remote.id,
        }
      : null;

  if (!view) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.fallback}>This transaction is no longer available.</Text>
          <Button label="Back home" onPress={() => router.replace('/(app)/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.center}>
        <View style={styles.iconBadge}>
          <Ionicons name="checkmark" size={56} color={Brand.success} />
        </View>
        <Text style={styles.title}>{view.kind === 'bill' ? 'Paid' : 'Sent'}</Text>
        <Text style={styles.amount}>RWF {formatRWF(view.amount, { hideSign: true })}</Text>
        <Text style={styles.subtitle}>to {view.recipientName}</Text>
        <View style={styles.refPill}>
          <Text style={styles.refText}>Ref · {view.reference}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="View receipt"
          onPress={() => router.replace({ pathname: '/(app)/send/receipt', params: { id: view.id } })}
        />
        <Button label="Done" variant="secondary" onPress={() => router.replace('/(app)/(tabs)')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
    paddingHorizontal: Spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Brand.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(16,185,129,0.45)',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Brand.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 40,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.6,
    marginTop: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  refPill: {
    marginTop: Spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  refText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textSecondary,
    letterSpacing: 0.5,
  },
  actions: {
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  fallback: {
    fontSize: 16,
    color: Brand.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
});
