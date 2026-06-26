import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PayBillsSheet } from '@/components/pay-bills-sheet';
import { SendMoneySheet } from '@/components/send-money-sheet';
import { Image } from 'expo-image';

import { VerdictBadge } from '@/components/ui/verdict-badge';
import { Brand, Radius, Shadow, Spacing } from '@/constants/theme';
import { verdictOf } from '@/lib/format';
import {
  alerts as apiAlerts,
  avatarUri,
  transactions as apiTransactions,
  wallets as apiWallets,
  type ApiFraudAlert,
  type ApiTransaction,
  type WalletDTO,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLiteMode } from '@/lib/lite-mode';
import { useRealtimeTick } from '@/lib/realtime';

type QuickAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress?: () => void;
};

const RWF_FMT = new Intl.NumberFormat('en-US');
function formatRWF(value: number, opts: { hideSign?: boolean } = {}) {
  if (!Number.isFinite(value)) return '0';
  const n = opts.hideSign ? Math.abs(value) : value;
  return RWF_FMT.format(Math.round(n));
}

function firstName(full?: string | null) {
  if (!full) return '';
  return full.trim().split(/\s+/)[0] ?? '';
}

/**
 * USSD fallback menu codes. The actual menus are served by the mobile-money
 * provider (MTN / Airtel) — SafePay only documents them so users on zero data
 * still know how to transact. Documented per spec [M7].
 */
const USSD_CODES: { code: string; label: string }[] = [
  { code: '*182#', label: 'MTN MoMo — send money, pay & check balance' },
  { code: '*500#', label: 'Airtel Money — send money, pay & check balance' },
  { code: '*182*8#', label: 'MTN — pay a registered merchant / bill' },
  { code: '*182*7#', label: 'MTN — reverse a wrong payment' },
];

function initialsOf(full?: string | null) {
  if (!full) return '··';
  const parts = full.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '··';
}

export default function Home() {
  const router = useRouter();
  const { liteMode } = useLiteMode();
  const { token, user } = useAuth();
  const realtimeTick = useRealtimeTick();
  const [hideBalance, setHideBalance] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [billsOpen, setBillsOpen] = useState(false);
  const [recent, setRecent] = useState<ApiTransaction[] | null>(null);
  const [wallets, setWallets] = useState<WalletDTO[] | null>(null);
  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [latestAlert, setLatestAlert] = useState<ApiFraudAlert | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1);
    }, []),
  );

  // Auto-refresh while the screen is mounted so received money / new alerts
  // appear without the user doing anything.
  useEffect(() => {
    const id = setInterval(() => setReloadKey((k) => k + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // Instant refresh when a realtime "money received" event arrives.
  useEffect(() => {
    if (realtimeTick > 0) setReloadKey((k) => k + 1);
  }, [realtimeTick]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  useEffect(() => {
    if (!token) {
      setRecent(null);
      setWallets(null);
      setTotalBalance(null);
      setLatestAlert(null);
      return;
    }
    let cancelled = false;
    apiTransactions
      .list(token, { limit: 4 })
      .then((r) => { if (!cancelled) setRecent(r.items); })
      .catch(() => { if (!cancelled) setRecent([]); });
    apiWallets
      .mine(token)
      .then((r) => {
        if (cancelled) return;
        setWallets(r.items);
        setTotalBalance(parseFloat(r.total_balance));
      })
      .catch(() => {
        if (!cancelled) { setWallets([]); setTotalBalance(0); }
      });
    apiAlerts
      .list(token, { limit: 1, status: 'pending' })
      .then((r) => { if (!cancelled) setLatestAlert(r.items[0] ?? null); })
      .catch(() => { if (!cancelled) setLatestAlert(null); });
    return () => { cancelled = true; };
  }, [token, reloadKey]);

  const quickActions: QuickAction[] = [
    {
      key: 'send',
      label: 'Send',
      icon: 'paper-plane-outline',
      tint: Brand.primary,
      onPress: () => setSendOpen(true),
    },
    {
      key: 'receive',
      label: 'Receive',
      icon: 'arrow-down-circle-outline',
      tint: Brand.success,
      onPress: () => router.push('/(app)/receive'),
    },
    {
      key: 'bills',
      label: 'Pay bills',
      icon: 'receipt-outline',
      tint: Brand.ai,
      onPress: () => setBillsOpen(true),
    },
  ];

  const greetingFirst = useMemo(() => firstName(user?.full_name) || 'there', [user]);
  const avatarInit = useMemo(() => initialsOf(user?.full_name), [user]);
  const avatarPhoto = avatarUri(user?.avatar_url);

  if (liteMode) {
    return (
      <LiteHome
        firstName={greetingFirst}
        wallets={wallets}
        totalBalance={totalBalance}
        onSend={() => setSendOpen(true)}
        onBills={() => setBillsOpen(true)}
        sendOpen={sendOpen}
        billsOpen={billsOpen}
        onCloseSend={() => setSendOpen(false)}
        onCloseBills={() => setBillsOpen(false)}
        onCompleteTxn={(txn) =>
          router.push({ pathname: '/(app)/send/success', params: { id: txn.id } })
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Brand.primary}
            colors={[Brand.primary]}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              {avatarPhoto ? (
                <Image
                  source={{ uri: avatarPhoto }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <Text style={styles.avatarText}>{avatarInit}</Text>
              )}
            </View>
            <View>
              <Text style={styles.greetingLabel}>Hi,</Text>
              <Text style={styles.greetingName}>{greetingFirst}</Text>
            </View>
          </View>
          <Pressable
            style={styles.bellBtn}
            hitSlop={6}
            onPress={() => router.push('/(app)/(tabs)/alerts')}>
            <Ionicons name="notifications-outline" size={22} color={Brand.text} />
            {latestAlert && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        {/* Balance card */}
        <View style={[styles.balanceCard, Shadow.md]}>
          <View style={styles.balanceTopRow}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <Pressable onPress={() => setHideBalance((v) => !v)} hitSlop={8}>
              <Ionicons
                name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="rgba(255,255,255,0.85)"
              />
            </Pressable>
          </View>
          <Text style={styles.balanceAmount}>
            {hideBalance
              ? '••••••'
              : `RWF ${formatRWF(totalBalance ?? 0, { hideSign: true })}`}
          </Text>
          {wallets && wallets.length > 0 ? (
            <>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceAccounts}>
                {wallets.map((w) => (
                  <View key={w.id} style={styles.balanceAccount}>
                    <Text style={styles.balanceAccountLabel}>
                      {w.source === 'MTN MoMo' ? 'MTN' : 'Airtel'}
                    </Text>
                    <Text style={styles.balanceAccountAmount}>
                      {hideBalance ? '••••' : formatRWF(parseFloat(w.balance), { hideSign: true })}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.balanceHint}>
              Link MTN MoMo or Airtel Money in Profile to see your balance here.
            </Text>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsCardTitle}>Quick actions</Text>
          <View style={styles.actionsRow}>
            {quickActions.map((a) => (
              <Pressable
                key={a.key}
                onPress={a.onPress}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
                <View style={styles.actionIcon}>
                  <Ionicons name={a.icon} size={28} color={a.tint} />
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* AI banner — only shown when a pending alert exists */}
        {latestAlert && (
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/alerts')}
            style={({ pressed }) => [styles.aiBanner, pressed && { opacity: 0.9 }]}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={20} color={Brand.ai} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiTitle}>Heads up</Text>
              <Text style={styles.aiBody}>{latestAlert.summary}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Brand.ai} />
          </Pressable>
        )}

        {/* Recent activity */}
        <View style={styles.activityHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Pressable hitSlop={8} onPress={() => router.push('/(app)/(tabs)/transactions')}>
            <Text style={styles.sectionAction}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.activityList}>
          {recent && recent.length > 0 ? (
            recent.map((t) => <ApiTransactionRow key={t.id} tx={t} />)
          ) : (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityText}>
                {token ? 'No transactions yet — tap Send to make your first one.' : 'Sign in to see your activity.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <SendMoneySheet
        visible={sendOpen}
        onClose={() => setSendOpen(false)}
        onComplete={(txn) =>
          router.push({ pathname: '/(app)/send/success', params: { id: txn.id } })
        }
      />

      <PayBillsSheet
        visible={billsOpen}
        onClose={() => setBillsOpen(false)}
        onComplete={(txn) =>
          router.push({ pathname: '/(app)/send/success', params: { id: txn.id } })
        }
      />
    </SafeAreaView>
  );
}

function LiteHome({
  firstName,
  wallets,
  totalBalance,
  onSend,
  onBills,
  sendOpen,
  billsOpen,
  onCloseSend,
  onCloseBills,
  onCompleteTxn,
}: {
  firstName: string;
  wallets: WalletDTO[] | null;
  totalBalance: number | null;
  onSend: () => void;
  onBills: () => void;
  sendOpen: boolean;
  billsOpen: boolean;
  onCloseSend: () => void;
  onCloseBills: () => void;
  onCompleteTxn: (txn: { id: string }) => void;
}) {
  const router = useRouter();

  const menu: { key: string; label: string; onPress: () => void }[] = [
    { key: '1', label: 'Send money', onPress: onSend },
    { key: '2', label: 'Receive money', onPress: () => router.push('/(app)/receive') },
    { key: '3', label: 'Pay bills', onPress: onBills },
    { key: '4', label: 'Recent activity', onPress: () => router.push('/(app)/(tabs)/transactions') },
    { key: '5', label: 'Alerts', onPress: () => router.push('/(app)/(tabs)/alerts') },
    { key: '6', label: 'Profile', onPress: () => router.push('/(app)/(tabs)/profile') },
  ];

  return (
    <View style={liteStyles.safe}>
      <ScrollView contentContainerStyle={liteStyles.scroll}>
        <Text style={liteStyles.welcome}>SafePay</Text>
        <Text style={liteStyles.helloLine}>Hi {firstName},</Text>

        <View style={liteStyles.balanceBlock}>
          <Text style={liteStyles.balanceLabel}>Total balance</Text>
          <Text style={liteStyles.balance}>
            RWF {formatRWF(totalBalance ?? 0, { hideSign: true })}
          </Text>
          <View style={{ marginTop: 8, gap: 2 }}>
            {(wallets ?? []).map((w) => (
              <Text key={w.id} style={liteStyles.balanceLine}>
                {w.source}: RWF {formatRWF(parseFloat(w.balance), { hideSign: true })}
              </Text>
            ))}
            {(!wallets || wallets.length === 0) && (
              <Text style={liteStyles.balanceLine}>
                No linked accounts yet.
              </Text>
            )}
          </View>
        </View>

        <Text style={liteStyles.menuTitle}>Choose an option:</Text>
        {menu.map((m) => (
          <Pressable
            key={m.key}
            onPress={m.onPress}
            style={({ pressed }) => [
              liteStyles.menuRow,
              pressed && { backgroundColor: Brand.surfaceElevated },
            ]}>
            <Text style={liteStyles.menuKey}>{m.key}.</Text>
            <Text style={liteStyles.menuLabel}>{m.label}</Text>
          </Pressable>
        ))}

        <View style={liteStyles.ussdBlock}>
          <Text style={liteStyles.ussdTitle}>No internet? Use USSD</Text>
          <Text style={liteStyles.ussdIntro}>
            When you have no data at all, dial these on your phone&apos;s keypad — your mobile money
            provider handles them, no app needed:
          </Text>
          {USSD_CODES.map((c) => (
            <View key={c.code} style={liteStyles.ussdRow}>
              <Text style={liteStyles.ussdCode}>{c.code}</Text>
              <Text style={liteStyles.ussdLabel}>{c.label}</Text>
            </View>
          ))}
          <Text style={liteStyles.ussdFoot}>
            SafePay AI still screens USSD payments — you&apos;ll get an SMS if one is flagged.
          </Text>
        </View>

        <Text style={liteStyles.tip}>
          Tip · Lite mode uses less data and works on slow connections. Toggle off in Profile to see
          the full UI.
        </Text>
      </ScrollView>

      <SendMoneySheet visible={sendOpen} onClose={onCloseSend} onComplete={onCompleteTxn} />
      <PayBillsSheet visible={billsOpen} onClose={onCloseBills} onComplete={onCompleteTxn} />
    </View>
  );
}

const liteStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  welcome: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.3,
  },
  helloLine: {
    fontSize: 15,
    color: Brand.textSecondary,
  },
  balanceBlock: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Brand.border,
    marginVertical: Spacing.sm,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  balance: {
    fontSize: 26,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  balanceLine: {
    fontSize: 13,
    color: Brand.textSecondary,
    fontFamily: 'Courier',
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.textSecondary,
    marginTop: Spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  menuKey: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.primary,
    fontFamily: 'Courier',
    width: 22,
  },
  menuLabel: {
    fontSize: 16,
    color: Brand.text,
    fontWeight: '600',
    flex: 1,
  },
  tip: {
    marginTop: Spacing.md,
    fontSize: 12,
    color: Brand.textMuted,
    lineHeight: 17,
  },
  ussdBlock: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    gap: 8,
  },
  ussdTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Brand.text,
  },
  ussdIntro: {
    fontSize: 12,
    color: Brand.textSecondary,
    lineHeight: 17,
  },
  ussdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderColor: Brand.border,
  },
  ussdCode: {
    fontSize: 15,
    fontWeight: '800',
    color: Brand.primary,
    fontFamily: 'Courier',
    width: 84,
  },
  ussdLabel: {
    flex: 1,
    fontSize: 12,
    color: Brand.text,
    lineHeight: 16,
  },
  ussdFoot: {
    fontSize: 11,
    color: Brand.textMuted,
    lineHeight: 15,
    marginTop: 2,
  },
});

function ApiTransactionRow({ tx }: { tx: ApiTransaction }) {
  const amount = parseFloat(tx.amount);
  const at = new Date(tx.created_at).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const verdict = verdictOf({ status: tx.status, risk_level: tx.risk_level });
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: Brand.surfaceElevated }]}>
        <Ionicons
          name={tx.kind === 'bill' ? 'receipt-outline' : 'paper-plane-outline'}
          size={20}
          color={Brand.textSecondary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txTitle}>{tx.recipient_name}</Text>
        <Text style={styles.txSubtitle}>{tx.source}</Text>
        <View style={styles.txBadgeLine}>
          <VerdictBadge verdict={verdict} />
          <Text style={styles.txTime}>{at}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, { color: Brand.text }]}>
        -{formatRWF(amount, { hideSign: true })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 24,
    gap: Spacing.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: Brand.text,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  greetingLabel: { fontSize: 12, color: Brand.textMuted, fontWeight: '500' },
  greetingName: { fontSize: 16, color: Brand.text, fontWeight: '700' },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.danger,
    borderWidth: 2,
    borderColor: Brand.surface,
  },

  balanceCard: { borderRadius: Radius.lg, padding: Spacing.lg, gap: 6, backgroundColor: Brand.primary },
  balanceTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  balanceAmount: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5, marginTop: 2 },
  balanceHint: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 8, lineHeight: 17 },
  balanceDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: Spacing.md },
  balanceAccounts: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceAccount: { gap: 2 },
  balanceAccountLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  balanceAccountAmount: { fontSize: 15, color: '#FFFFFF', fontWeight: '700' },

  actionsCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: Spacing.md,
  },
  actionsCardTitle: { fontSize: 14, fontWeight: '700', color: Brand.text, letterSpacing: 0.2 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  action: { flex: 1, alignItems: 'center', gap: 8 },
  actionIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '600', color: Brand.text },

  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.aiSoft,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139,92,246,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: { fontSize: 13, fontWeight: '700', color: Brand.text },
  aiBody: { fontSize: 12, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },

  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.text },
  sectionAction: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  activityList: { gap: 10 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: 16,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  txIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 15, fontWeight: '700', color: Brand.text, letterSpacing: -0.2 },
  txSubtitle: { fontSize: 12, color: Brand.textMuted, marginTop: 2 },
  txBadgeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  txTime: { fontSize: 11, color: Brand.textMuted },
  txAmount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  emptyActivity: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: 13,
    color: Brand.textMuted,
    textAlign: 'center',
  },
});
