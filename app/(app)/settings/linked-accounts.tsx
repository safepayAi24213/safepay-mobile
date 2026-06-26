import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, onboarding, type LinkedAccount, type MoneySource } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const SOURCES: MoneySource[] = ['MTN MoMo', 'Airtel Money'];

function maskNumber(n: string): string {
  const d = n.replace(/\s/g, '');
  if (d.length <= 4) return d;
  return `•••• ${d.slice(-4)}`;
}

export default function LinkedAccountsScreen() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState<MoneySource>('MTN MoMo');
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setAccounts(await onboarding.listAccounts(token));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load accounts.');
      setAccounts([]);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const addAccount = async () => {
    if (!token || number.trim().length < 4) return;
    setBusy(true);
    try {
      await onboarding.linkMoney(token, source, number.trim(), label.trim() || undefined);
      setNumber('');
      setLabel('');
      setAdding(false);
      await load();
    } catch (e) {
      Alert.alert('Could not link', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = (acct: LinkedAccount) => {
    Alert.alert(
      'Unlink account?',
      `Remove ${acct.label} (${maskNumber(acct.account_number)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await onboarding.unlinkAccount(token, acct.id);
              await load();
            } catch (e) {
              Alert.alert('Could not unlink', e instanceof ApiError ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Linked accounts</Text>
        <Text style={styles.sub}>Your MTN MoMo and Airtel Money wallets.</Text>

        {accounts === null ? (
          <ActivityIndicator color={Brand.primary} style={{ marginTop: Spacing.xl }} />
        ) : accounts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={36} color={Brand.textMuted} />
            <Text style={styles.emptyText}>No accounts linked yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {accounts.map((a) => (
              <View key={a.id} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: Brand.primarySoft }]}>
                  <Ionicons name="wallet-outline" size={20} color={Brand.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{a.label}</Text>
                  <Text style={styles.rowSub}>
                    {a.source} · {maskNumber(a.account_number)}
                  </Text>
                </View>
                <Pressable onPress={() => removeAccount(a)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={20} color={Brand.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {adding ? (
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>Link a new account</Text>
            <View style={styles.sourceRow}>
              {SOURCES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSource(s)}
                  style={[styles.sourceChip, source === s && styles.sourceChipActive]}>
                  <Text style={[styles.sourceText, source === s && styles.sourceTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <TextField
              label="Account number"
              leftIcon="card-outline"
              value={number}
              onChangeText={setNumber}
              keyboardType="number-pad"
              placeholder="07XX XXX XXX"
            />
            <TextField
              label="Label (optional)"
              leftIcon="pricetag-outline"
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Personal MoMo"
            />
            <Button
              label={busy ? 'Linking…' : 'Link account'}
              onPress={addAccount}
              disabled={number.trim().length < 4 || busy}
              loading={busy}
            />
            <Button label="Cancel" variant="secondary" onPress={() => setAdding(false)} />
          </View>
        ) : (
          <Button label="+ Link an account" variant="secondary" onPress={() => setAdding(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: Brand.textSecondary, marginTop: -Spacing.sm },
  empty: { alignItems: 'center', gap: 8, paddingVertical: Spacing.xl },
  emptyText: { fontSize: 14, color: Brand.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '700', color: Brand.text },
  rowSub: { fontSize: 12, color: Brand.textMuted, marginTop: 2 },
  error: { fontSize: 13, fontWeight: '600', color: Brand.danger },
  addCard: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  addTitle: { fontSize: 15, fontWeight: '800', color: Brand.text },
  sourceRow: { flexDirection: 'row', gap: 8 },
  sourceChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Brand.border,
    alignItems: 'center',
  },
  sourceChipActive: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  sourceText: { fontSize: 13, fontWeight: '700', color: Brand.textSecondary },
  sourceTextActive: { color: Brand.primary },
});
