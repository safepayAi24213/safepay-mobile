import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PayBillsSheet } from '@/components/pay-bills-sheet';
import { SendMoneySheet } from '@/components/send-money-sheet';
import { VerdictBadge } from '@/components/ui/verdict-badge';
import { Brand, Radius, Spacing } from '@/constants/theme';
import {
  avatarUri,
  transactions as apiTransactions,
  type ApiTransaction,
  type ReceivedTransaction,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRWF, verdictOf, type Verdict } from '@/lib/format';
import { useRealtimeTick } from '@/lib/realtime';
import { formatTxnDate, listTransactions, type SendTransaction } from '@/lib/send-store';

type Category = 'received' | 'send' | 'bill';
type TypeFilter = 'all' | Category;
type DateFilter = 'all' | 'today' | '7d' | '30d';
type AmountFilter = 'all' | 'lt10k' | '10k_100k' | 'gt100k';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'send', label: 'Sent' },
  { value: 'bill', label: 'Bills' },
];

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

const AMOUNT_FILTERS: { value: AmountFilter; label: string }[] = [
  { value: 'all', label: 'Any amount' },
  { value: 'lt10k', label: '< 10k' },
  { value: '10k_100k', label: '10k–100k' },
  { value: 'gt100k', label: '> 100k' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today" / "Yesterday" / "18 Jun 2026" for date-section headers. */
function dayLabel(ts: number): string {
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(ts))) / DAY_MS);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type Unified = {
  id: string;
  dir: 'in' | 'out';
  cat: Category;
  title: string;
  subtitle: string;
  at: string;
  ts: number;
  amount: number; // absolute value
  verdict?: Verdict; // outgoing only; received transfers carry no verdict
  icon: keyof typeof Ionicons.glyphMap;
  avatar?: string | null; // counterparty photo when we have one (received transfers)
  txnId?: string; // present for real (tappable) transactions
};

export default function Transactions() {
  const router = useRouter();
  const { token } = useAuth();
  const realtimeTick = useRealtimeTick();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [amountFilter, setAmountFilter] = useState<AmountFilter>('all');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [billsOpen, setBillsOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [remote, setRemote] = useState<ApiTransaction[] | null>(null);
  const [received, setReceived] = useState<ReceivedTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh the list when this tab becomes focused (after a new txn completes)
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1);
    }, []),
  );

  // Auto-refresh while mounted so incoming transfers surface on their own.
  useEffect(() => {
    const id = setInterval(() => setReloadKey((k) => k + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // Instant refresh on a realtime "money received" event.
  useEffect(() => {
    if (realtimeTick > 0) setReloadKey((k) => k + 1);
  }, [realtimeTick]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  // Fetch sent + received transactions from the backend when we have a token.
  useEffect(() => {
    if (!token) {
      setRemote(null);
      setReceived([]);
      return;
    }
    let cancelled = false;
    apiTransactions
      .list(token, { limit: 100 })
      .then((r) => {
        if (!cancelled) setRemote(r.items);
      })
      .catch(() => {
        if (!cancelled) setRemote(null);
      });
    apiTransactions
      .received(token, { limit: 100 })
      .then((r) => {
        if (!cancelled) setReceived(r.items);
      })
      .catch(() => {
        if (!cancelled) setReceived([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const all: Unified[] = useMemo(() => {
    const sent: Unified[] = token && remote ? remote.map(fromApi) : listTransactions().map(toUnified);
    const incoming: Unified[] = received.map(fromReceived);
    return [...sent, ...incoming].sort((a, b) => b.ts - a.ts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, token, remote, received]);

  const items: Unified[] = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    return all.filter((m) => {
      if (typeFilter !== 'all' && m.cat !== typeFilter) return false;
      if (q && !m.title.toLowerCase().includes(q) && !m.subtitle.toLowerCase().includes(q))
        return false;
      if (dateFilter === 'today' && now - m.ts > DAY_MS) return false;
      if (dateFilter === '7d' && now - m.ts > 7 * DAY_MS) return false;
      if (dateFilter === '30d' && now - m.ts > 30 * DAY_MS) return false;
      if (amountFilter === 'lt10k' && m.amount >= 10_000) return false;
      if (amountFilter === '10k_100k' && (m.amount < 10_000 || m.amount > 100_000)) return false;
      if (amountFilter === 'gt100k' && m.amount <= 100_000) return false;
      return true;
    });
  }, [all, typeFilter, dateFilter, amountFilter, search]);

  // Group the (already newest-first) items into day sections for a tidy feed.
  const sections = useMemo(() => {
    const groups: { label: string; data: Unified[] }[] = [];
    let current: { label: string; data: Unified[] } | null = null;
    for (const it of items) {
      const label = dayLabel(it.ts);
      if (!current || current.label !== label) {
        current = { label, data: [] };
        groups.push(current);
      }
      current.data.push(it);
    }
    return groups;
  }, [items]);

  const activeFilterCount =
    (dateFilter !== 'all' ? 1 : 0) + (amountFilter !== 'all' ? 1 : 0);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>Every payment, with its SafePay AI verdict.</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Button label="Send" onPress={() => setSendOpen(true)} style={styles.actionBtn} />
        <Button
          label="Pay bills"
          variant="secondary"
          onPress={() => setBillsOpen(true)}
          style={styles.actionBtn}
        />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={Brand.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or reference"
            placeholderTextColor={Brand.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Brand.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          style={[styles.filterToggle, (showFilters || activeFilterCount > 0) && styles.filterToggleActive]}>
          <Ionicons
            name="options-outline"
            size={20}
            color={showFilters || activeFilterCount > 0 ? Brand.primary : Brand.textSecondary}
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Type segment */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}>
        {TYPE_FILTERS.map((f) => {
          const active = typeFilter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setTypeFilter(f.value)}
              style={[styles.filter, active && styles.filterActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Expandable date + amount filters */}
      {showFilters && (
        <View style={styles.advanced}>
          <Text style={styles.advancedLabel}>Date</Text>
          <View style={styles.chipsWrap}>
            {DATE_FILTERS.map((f) => {
              const active = dateFilter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setDateFilter(f.value)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.advancedLabel}>Amount (RWF)</Text>
          <View style={styles.chipsWrap}>
            {AMOUNT_FILTERS.map((f) => {
              const active = amountFilter === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setAmountFilter(f.value)}
                  style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Brand.primary}
            colors={[Brand.primary]}
          />
        }>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={42} color={Brand.textMuted} />
            <Text style={styles.emptyText}>
              {all.length === 0 ? 'No transactions yet.' : 'No matches for these filters.'}
            </Text>
            <Text style={styles.emptyHint}>
              {all.length === 0
                ? 'Tap Send or Pay bills above to start.'
                : 'Try clearing your search or filters.'}
            </Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.label} style={styles.section}>
              <Text style={styles.sectionHeader}>{section.label}</Text>
              <View style={styles.sectionBody}>
                {section.data.map((t) => (
            <Pressable
              key={t.id}
              onPress={
                t.txnId
                  ? () =>
                      router.push({
                        pathname: '/(app)/send/receipt',
                        params: { id: t.txnId },
                      })
                  : undefined
              }
              style={({ pressed }) => [
                styles.row,
                pressed && t.txnId ? { backgroundColor: Brand.surfaceElevated } : null,
              ]}>
              {t.avatar ? (
                <Image source={{ uri: t.avatar }} style={styles.rowAvatar} contentFit="cover" />
              ) : (
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: t.dir === 'in' ? Brand.successSoft : Brand.surfaceElevated },
                  ]}>
                  <Ionicons
                    name={t.icon}
                    size={20}
                    color={t.dir === 'in' ? Brand.success : Brand.textSecondary}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t.title}</Text>
                <Text style={styles.rowSubtitle}>{t.subtitle}</Text>
                <View style={styles.rowBadgeLine}>
                  {t.verdict ? (
                    <VerdictBadge verdict={t.verdict} />
                  ) : (
                    <View style={styles.receivedPill}>
                      <Ionicons name="arrow-down" size={10} color={Brand.success} />
                      <Text style={styles.receivedPillText}>Received</Text>
                    </View>
                  )}
                  <Text style={styles.rowTime}>{t.at}</Text>
                </View>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  { color: t.dir === 'in' ? Brand.success : Brand.text },
                ]}>
                {formatAmount(t)}
              </Text>
              {t.txnId && (
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={Brand.textMuted}
                  style={styles.rowChevron}
                />
              )}
            </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
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

function toUnified(t: SendTransaction): Unified {
  const cat: Category = t.kind === 'bill' ? 'bill' : 'send';
  return {
    id: `local-${t.id}`,
    dir: 'out',
    cat,
    title: t.recipientName,
    subtitle: cat === 'bill' ? `${t.source} · Bill` : `${t.source} · Sent`,
    at: formatTxnDate(t.createdAt),
    ts: new Date(t.createdAt).getTime(),
    amount: Math.abs(t.amount),
    verdict: 'allowed',
    icon: cat === 'bill' ? 'receipt-outline' : 'paper-plane-outline',
    txnId: t.id,
  };
}

function fromApi(t: ApiTransaction): Unified {
  const cat: Category = t.kind === 'bill' ? 'bill' : 'send';
  return {
    id: `api-${t.id}`,
    dir: 'out',
    cat,
    title: t.recipient_name,
    subtitle: cat === 'bill' ? `${t.source} · Bill` : `${t.source} · Sent`,
    at: new Date(t.created_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
    ts: new Date(t.created_at).getTime(),
    amount: Math.abs(parseFloat(t.amount)),
    verdict: verdictOf({ status: t.status, risk_level: t.risk_level }),
    icon: cat === 'bill' ? 'receipt-outline' : 'paper-plane-outline',
    txnId: t.id,
  };
}

function fromReceived(t: ReceivedTransaction): Unified {
  return {
    id: `recv-${t.id}`,
    dir: 'in',
    cat: 'received',
    title: t.sender_name,
    subtitle: `${t.source} · Received`,
    at: new Date(t.created_at).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
    ts: new Date(t.created_at).getTime(),
    amount: Math.abs(parseFloat(t.amount)),
    verdict: undefined, // incoming transfers carry no SafePay verdict for the recipient
    icon: 'arrow-down-circle-outline',
    avatar: avatarUri(t.sender_avatar_url),
    txnId: undefined, // no receipt screen for received transfers
  };
}

function formatAmount(t: Unified): string {
  const sign = t.dir === 'in' ? '+' : '-';
  return `${sign}${formatRWF(t.amount, { hideSign: true })}`;
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
  },
  title: { fontSize: 26, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: Brand.textSecondary, marginTop: 2 },

  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  actionBtn: { flex: 1, height: 48 },

  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Brand.text,
    paddingVertical: 0,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  filterToggleActive: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  filterCount: {
    position: 'absolute',
    top: 4,
    right: 5,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { fontSize: 10, fontWeight: '800', color: Brand.textOnPrimary },

  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
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

  advanced: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  advancedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Brand.primarySoft, borderColor: Brand.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Brand.textSecondary },
  chipTextActive: { color: Brand.primary },

  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 24,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Brand.textMuted,
    marginLeft: 2,
  },
  sectionBody: {
    gap: 10,
  },
  row: {
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
  rowIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Brand.surfaceElevated,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Brand.text, letterSpacing: -0.2 },
  rowSubtitle: { fontSize: 12, color: Brand.textMuted, marginTop: 2 },
  rowBadgeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  receivedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Brand.successSoft,
  },
  receivedPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Brand.success,
  },
  rowTime: { fontSize: 11, color: Brand.textMuted },
  rowAmount: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  rowChevron: { marginLeft: 2, marginRight: -2 },

  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.text, textAlign: 'center' },
  emptyHint: { fontSize: 12, color: Brand.textMuted, textAlign: 'center' },
});
