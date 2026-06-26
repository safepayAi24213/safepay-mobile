import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { VerdictBadge } from '@/components/ui/verdict-badge';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { transactions as apiTransactions, type ApiTransaction } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRWF, verdictOf, type Verdict } from '@/lib/format';
import { formatTxnDate, getTransaction, type SendTransaction } from '@/lib/send-store';

const LOGO = require('@/assets/images/splashlogo.png');

// Load the logo once as a base64 data URI so it can be embedded as a watermark
// inside the generated PDF (file:// paths don't resolve in the print HTML).
let _logoDataUri: string | null = null;
async function getLogoDataUri(): Promise<string | null> {
  if (_logoDataUri) return _logoDataUri;
  try {
    const asset = Asset.fromModule(LOGO);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    _logoDataUri = `data:image/png;base64,${base64}`;
    return _logoDataUri;
  } catch {
    return null;
  }
}

// Safe, readable filename based on the receiver's name + reference.
function receiptFileName(txn: SendTransaction): string {
  const who = (txn.recipientName || 'recipient')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'recipient';
  return `SafePay-Receipt-${who}-${txn.reference}.pdf`;
}

function fromApi(t: ApiTransaction): SendTransaction {
  return {
    id: t.id,
    kind: (t.kind === 'bill' ? 'bill' : 'send') as SendTransaction['kind'],
    recipientName: t.recipient_name,
    recipientPhone: t.recipient_phone,
    destinationLabel: t.destination_label ?? undefined,
    amount: parseFloat(t.amount),
    fee: parseFloat(t.fee),
    total: parseFloat(t.total),
    note: t.note ?? undefined,
    source: t.source,
    createdAt: t.created_at,
    reference: t.reference,
    status: 'completed',
  };
}

export default function ReceiptScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token, user } = useAuth();
  const senderName = user?.full_name ?? '';
  const local = id ? getTransaction(id) : undefined;
  const [remote, setRemote] = useState<SendTransaction | null>(null);
  const [verdict, setVerdict] = useState<Verdict>('allowed');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (local || !id || !token) return;
    setLoading(true);
    let cancelled = false;
    apiTransactions
      .get(token, id)
      .then((t) => {
        if (cancelled) return;
        setRemote(fromApi(t));
        setVerdict(verdictOf({ status: t.status, risk_level: t.risk_level }));
      })
      .catch(() => { if (!cancelled) setRemote(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, local, token]);

  const txn = local ?? remote;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Header onBack={() => router.replace('/(app)/(tabs)')} />
        <View style={styles.fallbackWrap}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!txn) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Header onBack={() => router.replace('/(app)/(tabs)')} />
        <View style={styles.fallbackWrap}>
          <Text style={styles.fallback}>Receipt no longer available.</Text>
          <Button label="Back home" onPress={() => router.replace('/(app)/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  const onDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const logoDataUri = await getLogoDataUri();
      const html = buildReceiptHtml(txn, senderName, logoDataUri);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      // Rename the PDF to a human-readable name based on the receiver.
      let shareUri = uri;
      const dest = `${FileSystem.cacheDirectory ?? ''}${receiptFileName(txn)}`;
      if (dest) {
        try {
          await FileSystem.copyAsync({ from: uri, to: dest });
          shareUri = dest;
        } catch {
          shareUri = uri; // fall back to the original temp file
        }
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(shareUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save SafePay receipt',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Receipt saved', `PDF saved to:\n${shareUri}`);
      }
    } catch (err) {
      Alert.alert(
        "Couldn't save receipt",
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Header onBack={() => router.replace('/(app)/(tabs)')} onShare={onDownload} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
          <Text style={styles.brandTagline}>Transaction receipt</Text>
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>
            {txn.kind === 'bill' ? 'Amount paid' : 'Amount sent'}
          </Text>
          <Text style={styles.amount}>RWF {formatRWF(txn.amount, { hideSign: true })}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Ionicons name="checkmark-circle" size={14} color={Brand.success} />
              <Text style={styles.statusText}>Completed</Text>
            </View>
            <VerdictBadge verdict={verdict} size="md" />
          </View>
        </View>

        <View style={styles.card}>
          <Row label="From" value={senderName || '—'} />
          <Row label="Source" value={txn.source} />
          <Divider />
          <Row label={txn.kind === 'bill' ? 'Biller' : 'To'} value={txn.recipientName} bold />
          <Row label={txn.destinationLabel ?? 'Phone'} value={txn.recipientPhone} />
          {txn.note ? <Row label="Note" value={txn.note} /> : null}
        </View>

        <View style={styles.card}>
          <Row label="Amount" value={`RWF ${formatRWF(txn.amount, { hideSign: true })}`} />
          <Row label="Fee" value={`RWF ${formatRWF(txn.fee, { hideSign: true })}`} />
          <Divider />
          <Row label="Total" value={`RWF ${formatRWF(txn.total, { hideSign: true })}`} bold large />
        </View>

        <View style={styles.card}>
          <Row label="Date" value={formatTxnDate(txn.createdAt)} />
          <Row label="Reference" value={txn.reference} mono />
        </View>

        <View style={styles.footer}>
          <Button
            label={downloading ? 'Preparing receipt…' : 'Share / Save receipt'}
            onPress={onDownload}
            loading={downloading}
          />
          <Pressable
            onPress={() => router.replace('/(app)/(tabs)')}
            style={({ pressed }) => [styles.backHome, pressed && { opacity: 0.7 }]}>
            <Text style={styles.backHomeText}>Back home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  onShare,
}: {
  onBack: () => void;
  onShare?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.headerBtn}>
        <Ionicons name="chevron-back" size={22} color={Brand.text} />
      </Pressable>
      <View style={styles.headerRight}>
        {onShare && (
          <Pressable onPress={onShare} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={20} color={Brand.text} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  bold,
  large,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          bold && { fontWeight: '800' },
          large && { fontSize: 18 },
          mono && { fontFamily: 'Courier' },
        ]}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function buildReceiptHtml(
  txn: SendTransaction,
  senderName: string,
  logoDataUri?: string | null,
): string {
  const amount = formatRWF(txn.amount, { hideSign: true });
  const fee = formatRWF(txn.fee, { hideSign: true });
  const total = formatRWF(txn.total, { hideSign: true });
  const date = formatTxnDate(txn.createdAt);
  const fullName = senderName || '—';
  const toLabel = txn.kind === 'bill' ? 'Biller' : 'To';
  const destLabel = txn.destinationLabel ?? 'Phone';
  const amountLabel = txn.kind === 'bill' ? 'Amount paid' : 'Amount sent';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 48px 40px;
    color: #0E1330;
    background: #FFFFFF;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #E4E6EF;
    padding-bottom: 24px;
    margin-bottom: 32px;
  }
  .brand-block { display: flex; align-items: center; gap: 12px; }
  .brand-logo { width: 42px; height: 42px; object-fit: contain; }
  .brand { font-size: 22px; font-weight: 800; color: #06B6D4; letter-spacing: -0.4px; }
  .brand-sub { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-top: 4px; }
  .status {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(16,185,129,0.14);
    color: #10B981;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  h1 {
    font-size: 36px;
    margin: 0 0 4px;
    letter-spacing: -0.6px;
  }
  .amount-label {
    font-size: 11px;
    font-weight: 700;
    color: #64748B;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .section {
    margin-top: 32px;
    padding: 20px 24px;
    border: 1px solid #E4E6EF;
    border-radius: 12px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
  }
  .row.divider { border-top: 1px solid #E4E6EF; padding-top: 14px; margin-top: 6px; }
  .row .label { color: #64748B; font-weight: 600; }
  .row .value { color: #0E1330; font-weight: 700; max-width: 60%; text-align: right; }
  .row.total .value { font-size: 18px; font-weight: 800; }
  .mono { font-family: 'Courier New', monospace; }
  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #E4E6EF;
    font-size: 11px;
    color: #64748B;
    text-align: center;
  }
  .watermark {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 0;
  }
  .watermark img {
    width: 78%;
    max-width: 380px;
    opacity: 0.05;
    transform: rotate(-20deg);
  }
  .page { position: relative; z-index: 1; }
</style>
</head>
<body>
  ${logoDataUri ? `<div class="watermark"><img src="${logoDataUri}" /></div>` : ''}
  <div class="page">
  <div class="header">
    <div class="brand-block">
      ${logoDataUri ? `<img class="brand-logo" src="${logoDataUri}" />` : ''}
      <div>
        <div class="brand">SafePay AI</div>
        <div class="brand-sub">Transaction receipt</div>
      </div>
    </div>
    <div class="status">Completed</div>
  </div>

  <div class="amount-label">${amountLabel}</div>
  <h1>RWF ${amount}</h1>

  <div class="section">
    <div class="row"><span class="label">From</span><span class="value">${escapeHtml(fullName)}</span></div>
    <div class="row"><span class="label">Source</span><span class="value">${escapeHtml(txn.source)}</span></div>
    <div class="row divider"><span class="label">${toLabel}</span><span class="value">${escapeHtml(txn.recipientName)}</span></div>
    <div class="row"><span class="label">${destLabel}</span><span class="value">${escapeHtml(txn.recipientPhone)}</span></div>
    ${txn.note ? `<div class="row"><span class="label">Note</span><span class="value">${escapeHtml(txn.note)}</span></div>` : ''}
  </div>

  <div class="section">
    <div class="row"><span class="label">Amount</span><span class="value">RWF ${amount}</span></div>
    <div class="row"><span class="label">Fee</span><span class="value">RWF ${fee}</span></div>
    <div class="row total divider"><span class="label">Total</span><span class="value">RWF ${total}</span></div>
  </div>

  <div class="section">
    <div class="row"><span class="label">Date</span><span class="value">${escapeHtml(date)}</span></div>
    <div class="row"><span class="label">Reference</span><span class="value mono">${escapeHtml(txn.reference)}</span></div>
  </div>

  <div class="footer">
    This is a system-generated receipt from SafePay AI. Keep it for your records.
  </div>
  </div>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  brandRow: {
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  logo: {
    width: 140,
    height: 56,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  amountBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 6,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 36,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Brand.successSoft,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.success,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 13,
    color: Brand.textMuted,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    color: Brand.text,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: Brand.border,
  },
  footer: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  backHome: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  backHomeText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.textSecondary,
  },
  fallbackWrap: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  fallback: {
    fontSize: 16,
    color: Brand.textSecondary,
    textAlign: 'center',
  },
});
