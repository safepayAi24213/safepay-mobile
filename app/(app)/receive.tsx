import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { wallets as apiWallets, type WalletDTO } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRWF, initialsOf } from '@/lib/format';

export default function ReceiveScreen() {
  const { token, user } = useAuth();
  const [wallets, setWallets] = useState<WalletDTO[]>([]);
  const [amount, setAmount] = useState('');

  const phone = user?.phone ?? '';
  const name = user?.full_name ?? 'Your account';

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiWallets
      .mine(token)
      .then((r) => { if (!cancelled) setWallets(r.items); })
      .catch(() => { if (!cancelled) setWallets([]); });
    return () => { cancelled = true; };
  }, [token]);

  const amountNum = parseInt(amount.replace(/\D/g, ''), 10);
  const hasAmount = Number.isFinite(amountNum) && amountNum > 0;

  const requestMessage = useMemo(() => {
    const lines = [
      `Hi, please send money to me on SafePay.`,
      `Name: ${name}`,
      phone ? `Mobile number: ${phone}` : null,
      hasAmount ? `Amount requested: RWF ${formatRWF(amountNum, { hideSign: true })}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  }, [name, phone, hasAmount, amountNum]);

  const onShare = async () => {
    try {
      await Share.share({ message: requestMessage, title: 'My SafePay details' });
    } catch {
      // user cancelled
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.iconBadge}>
            <Ionicons name="arrow-down-circle-outline" size={30} color={Brand.success} />
          </View>
          <Text style={styles.title}>Receive money</Text>
          <Text style={styles.subtitle}>
            Share your mobile number below. Anyone on SafePay or mobile money can send to it.
          </Text>

          {/* Identity card */}
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(name)}</Text>
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.phoneLabel}>Mobile number</Text>
            <Text style={styles.phone}>{phone || 'No number on file'}</Text>

            {wallets.length > 0 && (
              <View style={styles.walletRow}>
                {wallets.map((w) => (
                  <View key={w.id} style={styles.walletChip}>
                    <Ionicons name="wallet-outline" size={13} color={Brand.textSecondary} />
                    <Text style={styles.walletChipText}>{w.source}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Optional amount to request */}
          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Request a specific amount (optional)</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.currency}>RWF</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
                placeholder="0"
                placeholderTextColor={Brand.textMuted}
                keyboardType="number-pad"
                style={styles.amountInput}
              />
            </View>
          </View>

          <Button
            label={hasAmount ? `Share request · RWF ${formatRWF(amountNum, { hideSign: true })}` : 'Share my details'}
            onPress={onShare}
          />

          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Brand.textMuted} />
            <Text style={styles.noteText}>
              SafePay AI screens every incoming payment too — you&apos;ll get an alert if anything
              looks unusual.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: Brand.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
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
    alignItems: 'center',
    gap: 4,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: Brand.primary, letterSpacing: 0.5 },
  name: { fontSize: 16, fontWeight: '800', color: Brand.text },
  phoneLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  phone: { fontSize: 24, fontWeight: '800', color: Brand.text, letterSpacing: 1 },
  walletRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surfaceElevated,
  },
  walletChipText: { fontSize: 12, fontWeight: '600', color: Brand.textSecondary },
  amountBlock: { gap: 8 },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textSecondary,
    paddingHorizontal: 4,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 56,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  currency: { fontSize: 15, fontWeight: '700', color: Brand.textMuted },
  amountInput: { flex: 1, fontSize: 22, fontWeight: '800', color: Brand.text, paddingVertical: 0 },
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
