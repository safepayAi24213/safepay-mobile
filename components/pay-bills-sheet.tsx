import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PinDots, PinPad } from '@/components/ui/pin-pad';
import { RiskBadge } from '@/components/ui/risk-badge';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAccountState } from '@/lib/account-state';
import {
  ApiError,
  billers as apiBillers,
  onboarding,
  risk as apiRisk,
  transactions as apiTransactions,
  wallets as apiWallets,
  type BillerDTO,
  type BillerCategory,
  type WalletDTO,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { amountWithCommas, formatRWF, sanitizeAmountInput } from '@/lib/format';
import { fireLocal } from '@/lib/notifications';
import { useLiteMode } from '@/lib/lite-mode';
import { getCurrentCoords, type Coords } from '@/lib/location';
import { riskFromDto, scoreTransaction, type RiskScore } from '@/lib/risk-engine';
import {
  calculateFee,
  createTransaction,
  type MoneySource,
  type SendTransaction,
} from '@/lib/send-store';

const CATEGORY_VISUALS: Record<BillerCategory, { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }> = {
  utilities: { icon: 'flash', tint: '#F59E0B', bg: 'rgba(245,158,11,0.16)' },
  tv: { icon: 'tv', tint: '#EF4444', bg: 'rgba(239,68,68,0.16)' },
  internet: { icon: 'wifi', tint: '#06B6D4', bg: 'rgba(6,182,212,0.16)' },
  telecom: { icon: 'phone-portrait', tint: '#FFCC08', bg: 'rgba(255,204,8,0.16)' },
  insurance: { icon: 'shield-checkmark', tint: '#10B981', bg: 'rgba(16,185,129,0.16)' },
  other: { icon: 'receipt', tint: '#8B5CF6', bg: 'rgba(139,92,246,0.16)' },
};

function visualsFor(b: BillerDTO) {
  return CATEGORY_VISUALS[b.category] ?? CATEGORY_VISUALS.other;
}

type Step = 'biller' | 'details' | 'review' | 'pin';

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete: (txn: SendTransaction) => void;
};

const PIN_LENGTH = 4;

type SourceOption = { id: MoneySource; label: string; balance: number };

function notifyPaid(amount: number, billerName: string) {
  fireLocal({
    title: 'Payment sent',
    body: `You paid RWF ${formatRWF(amount, { hideSign: true })} to ${billerName}.`,
    kind: 'transaction_sent',
  });
}

export function PayBillsSheet({ visible, onClose, onComplete }: Props) {
  const { isOnline, queueTransaction } = useLiteMode();
  const { frozen } = useAccountState();
  const { token } = useAuth();
  const [step, setStep] = useState<Step>('biller');
  const [biller, setBiller] = useState<BillerDTO | null>(null);
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState<MoneySource>('MTN MoMo');
  const [pin, setPin] = useState('');
  const [allBillers, setAllBillers] = useState<BillerDTO[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  // One-shot guard so a single confirm can never fire the payment more than once.
  const submitting = useRef(false);

  const [coords, setCoords] = useState<Coords | null>(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getCurrentCoords().then((c) => {
      if (!cancelled) setCoords(c);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setStep('biller');
      setBiller(null);
      setAccount('');
      setAmount('');
      setSource('MTN MoMo');
      setPin('');
      setCoords(null);
      submitting.current = false;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    apiBillers.list()
      .then((r) => { if (!cancelled) setAllBillers(r.items); })
      .catch(() => { if (!cancelled) setAllBillers([]); });
    if (token) {
      apiWallets.mine(token)
        .then((r) => {
          if (cancelled) return;
          const opts: SourceOption[] = r.items.map((w: WalletDTO) => ({
            id: w.source,
            label: w.source,
            balance: parseFloat(w.balance),
          }));
          setSources(opts);
          if (opts.length > 0 && !opts.some((o) => o.id === source)) {
            setSource(opts[0].id);
          }
        })
        .catch(() => { if (!cancelled) setSources([]); });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, token]);

  const numericAmount = parseInt(amount || '0', 10) || 0;
  const fee = useMemo(() => calculateFee(numericAmount, source), [numericAmount, source]);
  const total = numericAmount + fee;

  const selectedSource = sources.find((s) => s.id === source);
  const availableBalance = selectedSource?.balance ?? 0;
  const insufficientFunds = sources.length > 0 && numericAmount > 0 && total > availableBalance;

  const detailsValid =
    account.length >= 4 && numericAmount >= 1 && sources.length > 0 && !insufficientFunds;

  // Seed with the instant local estimate, then overwrite with the REAL backend
  // engine so the Review verdict matches the server's actual decision.
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  useEffect(() => {
    if ((step !== 'review' && step !== 'pin') || !biller) {
      setRiskScore(null);
      return;
    }
    setRiskScore(
      scoreTransaction({
        amount: numericAmount,
        recipientPhone: account,
        recipientName: biller.name,
        isKnownRecipient: true,
        category: 'bill',
      }),
    );
    if (!token || numericAmount < 1) return;
    let cancelled = false;
    apiRisk
      .scorePreview(token, {
        kind: 'bill',
        recipient_name: biller.name,
        recipient_phone: account,
        destination_label: biller.account_label,
        source,
        amount: numericAmount,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      })
      .then((dto) => {
        if (!cancelled) setRiskScore(riskFromDto(dto));
      })
      .catch(() => {
        /* keep local estimate on error/offline */
      });
    return () => {
      cancelled = true;
    };
  }, [step, numericAmount, account, biller, source, token, coords]);

  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  useEffect(() => {
    setRiskAcknowledged(false);
  }, [step]);

  const selectBiller = (b: BillerDTO) => {
    setBiller(b);
    setStep('details');
  };

  const completeTransaction = async () => {
    if (!biller) return;
    // Guard against double/triple submits — set synchronously before any await.
    if (submitting.current) return;
    submitting.current = true;

    if (frozen) {
      onClose();
      setTimeout(() => {
        Alert.alert(
          'Account frozen',
          'Bill payments are blocked. Open Profile → Security to unfreeze.',
        );
      }, 250);
      return;
    }
    const localPayload = {
      kind: 'bill' as const,
      recipientName: biller.name,
      recipientPhone: account,
      destinationLabel: biller.account_label,
      amount: numericAmount,
      fee,
      total,
      source,
    };

    if (!isOnline) {
      queueTransaction(localPayload);
      onClose();
      setTimeout(() => {
        Alert.alert(
          'Queued for sync',
          `You're offline. RWF ${formatRWF(total, { hideSign: true })} to ${biller.name} will be paid once you're back online.`,
        );
      }, 250);
      return;
    }

    if (token) {
      try {
        const resp = await apiTransactions.send(token, {
          kind: 'bill',
          recipient_name: biller.name,
          recipient_phone: account,
          destination_label: biller.account_label,
          source,
          amount: numericAmount,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        });
        const txn = createTransaction({
          ...localPayload,
          fee: parseFloat(resp.transaction.fee),
          total: parseFloat(resp.transaction.total),
        });
        notifyPaid(numericAmount, biller.name);
        onClose();
        setTimeout(() => onComplete(txn), 250);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Bill payment failed.';
        onClose();
        setTimeout(() => Alert.alert('Payment failed', msg), 250);
      }
      return;
    }

    const txn = createTransaction(localPayload);
    notifyPaid(numericAmount, biller.name);
    onClose();
    setTimeout(() => onComplete(txn), 250);
  };

  const verifyPinAndComplete = async (enteredPin: string) => {
    // Verify the real transaction PIN before paying (local/demo mode skips it).
    if (token) {
      try {
        await onboarding.verifyPin(token, enteredPin);
      } catch {
        setPin('');
        Alert.alert('Incorrect PIN', 'Please try again.');
        return;
      }
    }
    completeTransaction();
  };

  const onPinDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setTimeout(() => verifyPinAndComplete(next), 180);
    }
  };

  const onPinBackspace = () => setPin((p) => p.slice(0, -1));

  const goBackOneStep = () => {
    if (step === 'pin') {
      setPin('');
      setStep('review');
    } else if (step === 'review') setStep('details');
    else if (step === 'details') setStep('biller');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheetHeader}>
              {step !== 'biller' && (
                <Pressable onPress={goBackOneStep} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color={Brand.text} />
                </Pressable>
              )}
              <Text style={styles.sheetTitle}>
                {step === 'biller'
                  ? 'Pay a bill'
                  : step === 'details'
                    ? biller?.name ?? 'Details'
                    : step === 'review'
                      ? 'Review'
                      : 'Enter PIN'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={Brand.textSecondary} />
              </Pressable>
            </View>

            {/* PIN step has its own progress dots (PinDots); hide the wizard
                step indicator there to avoid duplicate-looking dots. */}
            {step !== 'pin' && <StepDots step={step} />}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}>
              {step === 'biller' && <BillerStep billers={allBillers} onSelect={selectBiller} />}
              {step === 'details' && biller && (
                <DetailsStep
                  biller={biller}
                  account={account}
                  onChangeAccount={setAccount}
                  amount={amount}
                  onChangeAmount={setAmount}
                  source={source}
                  onSelectSource={setSource}
                  sources={sources}
                  insufficientFunds={insufficientFunds}
                  available={availableBalance}
                />
              )}
              {step === 'review' && biller && (
                <ReviewStep
                  biller={biller}
                  account={account}
                  amount={numericAmount}
                  fee={fee}
                  total={total}
                  source={source}
                  riskScore={riskScore}
                  riskAcknowledged={riskAcknowledged}
                  onAckChange={setRiskAcknowledged}
                />
              )}
              {step === 'pin' && biller && (
                <PinStep
                  pin={pin}
                  billerName={biller.name}
                  total={total}
                  onDigit={onPinDigit}
                  onBackspace={onPinBackspace}
                />
              )}
            </ScrollView>

            {step !== 'pin' && (
              <View style={styles.footer}>
                {step === 'details' && (
                  <Button label="Continue" onPress={() => setStep('review')} disabled={!detailsValid} />
                )}
                {step === 'review' && riskScore?.level === 'blocked' && (
                  <Button label="Blocked — cannot pay" disabled />
                )}
                {step === 'review' && riskScore && riskScore.level !== 'blocked' && (
                  <Button
                    label={riskScore.level === 'high' ? 'Override & confirm with PIN' : 'Confirm with PIN'}
                    onPress={() => setStep('pin')}
                    disabled={(riskScore.level === 'medium' || riskScore.level === 'high') && !riskAcknowledged}
                    variant={riskScore.level === 'high' ? 'danger' : 'primary'}
                  />
                )}
              </View>
            )}
    </BottomSheet>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ['biller', 'details', 'review', 'pin'];
  const idx = order.indexOf(step);
  return (
    <View style={styles.dots}>
      {order.map((s, i) => (
        <View
          key={s}
          style={[styles.dot, i === idx && styles.dotActive, i < idx && styles.dotDone]}
        />
      ))}
    </View>
  );
}

function BillerStep({
  billers,
  onSelect,
}: {
  billers: BillerDTO[];
  onSelect: (b: BillerDTO) => void;
}) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={styles.sectionLabel}>Choose a biller</Text>
      {billers.length === 0 ? (
        <Text style={styles.billerShort}>No billers available right now.</Text>
      ) : (
        <View style={styles.billerGrid}>
          {billers.map((b) => {
            const v = visualsFor(b);
            return (
              <Pressable
                key={b.id}
                onPress={() => onSelect(b)}
                style={({ pressed }) => [styles.billerCard, pressed && { opacity: 0.85 }]}>
                <View style={[styles.billerIcon, { backgroundColor: v.bg }]}>
                  <Ionicons name={v.icon} size={28} color={v.tint} />
                </View>
                <Text style={styles.billerName}>{b.name}</Text>
                <Text style={styles.billerShort}>{b.category}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function DetailsStep({
  biller,
  account,
  onChangeAccount,
  amount,
  onChangeAmount,
  source,
  onSelectSource,
  sources,
  insufficientFunds,
  available,
}: {
  biller: BillerDTO;
  account: string;
  onChangeAccount: (v: string) => void;
  amount: string;
  onChangeAmount: (v: string) => void;
  source: MoneySource;
  onSelectSource: (s: MoneySource) => void;
  sources: SourceOption[];
  insufficientFunds: boolean;
  available: number;
}) {
  const v = visualsFor(biller);
  const n = parseInt(amount || '0', 10) || 0;
  const belowMin = n > 0 && n < 1;
  const showError = belowMin || insufficientFunds;
  const fee = calculateFee(n, source);
  const total = n + fee;
  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={styles.billerHeader}>
        <View style={[styles.billerIcon, { backgroundColor: v.bg }]}>
          <Ionicons name={v.icon} size={26} color={v.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.billerName}>{biller.name}</Text>
          <Text style={styles.billerShort}>{biller.category}</Text>
        </View>
      </View>

      <View>
        <Text style={styles.subLabel}>{biller.account_label}</Text>
        <View style={styles.field}>
          <Ionicons name="card-outline" size={20} color={Brand.textMuted} />
          <TextInput
            style={styles.fieldInput}
            value={account}
            onChangeText={(t) => onChangeAccount(t.replace(/\D/g, '').slice(0, 20))}
            placeholder={biller.account_hint ?? `Enter your ${biller.account_label.toLowerCase()}`}
            placeholderTextColor={Brand.textMuted}
            keyboardType="number-pad"
            maxLength={20}
            autoFocus
            selectionColor={Brand.primary}
          />
        </View>
      </View>

      <View>
        <Text style={styles.subLabel}>Amount</Text>
        <View style={styles.amountWrap}>
          <Text style={styles.amountCurrency}>RWF</Text>
          <TextInput
            style={[styles.amountInput, showError && { color: Brand.danger }]}
            value={amountWithCommas(amount)}
            onChangeText={(t) => onChangeAmount(sanitizeAmountInput(t))}
            placeholder="0"
            placeholderTextColor={Brand.textMuted}
            keyboardType="number-pad"
            selectionColor={Brand.primary}
          />
        </View>
        {belowMin ? (
          <Text style={styles.insufficientText}>Minimum amount is RWF 1</Text>
        ) : insufficientFunds ? (
          <Text style={styles.insufficientText}>
            Not enough balance · you have RWF {formatRWF(available, { hideSign: true })}
          </Text>
        ) : null}
        {n >= 1 && !showError && (
          <View style={styles.feeHint}>
            <Ionicons name="information-circle-outline" size={14} color={Brand.textMuted} />
            <Text style={styles.feeHintText}>
              {source} fee RWF {formatRWF(fee, { hideSign: true })} · You pay RWF{' '}
              {formatRWF(total, { hideSign: true })}
            </Text>
          </View>
        )}
      </View>

      <View>
        <Text style={styles.subLabel}>Pay from</Text>
        {sources.length === 0 ? (
          <Text style={styles.sourceBalance}>
            Link a mobile money account in Profile to start paying.
          </Text>
        ) : (
          <View style={{ gap: 6 }}>
            {sources.map((s) => {
              const selected = source === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => onSelectSource(s.id)}
                  style={({ pressed }) => [
                    styles.sourceRow,
                    selected && styles.sourceRowSelected,
                    pressed && { opacity: 0.85 },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sourceLabel}>{s.label}</Text>
                    <Text style={styles.sourceBalance}>
                      Balance · RWF {formatRWF(s.balance, { hideSign: true })}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? Brand.primary : Brand.border}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

function ReviewStep({
  biller,
  account,
  amount,
  fee,
  total,
  source,
  riskScore,
  riskAcknowledged,
  onAckChange,
}: {
  biller: BillerDTO;
  account: string;
  amount: number;
  fee: number;
  total: number;
  source: MoneySource;
  riskScore: RiskScore | null;
  riskAcknowledged: boolean;
  onAckChange: (v: boolean) => void;
}) {
  const ackRequired =
    riskScore?.level === 'medium' || riskScore?.level === 'high';
  return (
    <View style={{ gap: Spacing.md }}>
      {riskScore && <RiskBadge score={riskScore} />}
      <View style={styles.reviewCard}>
        <ReviewRow label="Biller" value={biller.name} bold />
        <ReviewRow label={biller.account_label} value={account} />
        <ReviewRow label="Pay from" value={source} />
      </View>
      <View style={styles.reviewCard}>
        <ReviewRow label="Amount" value={`RWF ${formatRWF(amount, { hideSign: true })}`} />
        <ReviewRow label="Fee" value={`RWF ${formatRWF(fee, { hideSign: true })}`} />
        <View style={styles.reviewDivider} />
        <ReviewRow
          label="Total"
          value={`RWF ${formatRWF(total, { hideSign: true })}`}
          bold
          large
        />
      </View>
      {ackRequired && riskScore && (
        <Pressable
          onPress={() => onAckChange(!riskAcknowledged)}
          style={styles.ackRow}
          hitSlop={6}>
          <View style={[styles.ackBox, riskAcknowledged && styles.ackBoxOn]}>
            {riskAcknowledged && (
              <Ionicons name="checkmark" size={14} color={Brand.textOnPrimary} />
            )}
          </View>
          <Text style={styles.ackText}>
            {riskScore.level === 'high'
              ? 'I understand this payment looks risky and I want to proceed anyway.'
              : 'I confirm this payment is intentional.'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ReviewRow({
  label,
  value,
  bold,
  large,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text
        style={[
          styles.reviewValue,
          bold && { fontWeight: '800' },
          large && { fontSize: 18, color: Brand.text },
        ]}>
        {value}
      </Text>
    </View>
  );
}

function PinStep({
  pin,
  billerName,
  total,
  onDigit,
  onBackspace,
}: {
  pin: string;
  billerName: string;
  total: number;
  onDigit: (d: string) => void;
  onBackspace: () => void;
}) {
  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={styles.pinHeaderBlock}>
        <Text style={styles.pinHeaderTitle}>
          Paying RWF {formatRWF(total, { hideSign: true })}
        </Text>
        <Text style={styles.pinHeaderSubtitle}>to {billerName}</Text>
      </View>
      <View style={{ alignItems: 'center', gap: Spacing.md }}>
        <PinDots length={PIN_LENGTH} filled={pin.length} />
      </View>
      <PinPad onDigit={onDigit} onBackspace={onBackspace} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    // Lets the body scroll within the capped sheet while the footer stays pinned.
    flexShrink: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    minHeight: 32,
  },
  sheetTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: Brand.text,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.border,
  },
  dotActive: { width: 22, backgroundColor: Brand.primary },
  dotDone: { backgroundColor: Brand.primary },
  body: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  footer: {
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },

  sectionLabel: {
    fontSize: 12,
    color: Brand.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  subLabel: {
    fontSize: 12,
    color: Brand.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // Biller grid
  billerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  billerCard: {
    width: '48%',
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 8,
  },
  billerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billerName: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
  },
  billerShort: {
    fontSize: 11,
    color: Brand.textMuted,
  },
  billerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },

  // Field
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Brand.border,
    paddingHorizontal: Spacing.md,
    height: 54,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: Brand.text,
    height: '100%',
  },

  // Amount
  amountWrap: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  amountCurrency: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '800',
    color: Brand.text,
    textAlign: 'center',
    letterSpacing: -1,
    minWidth: 120,
  },
  insufficientText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.danger,
    textAlign: 'center',
    marginTop: 6,
  },
  feeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  feeHintText: {
    fontSize: 12,
    color: Brand.textMuted,
    fontWeight: '600',
  },

  // Source
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1.5,
    borderColor: Brand.border,
  },
  sourceRowSelected: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primarySoft,
  },
  sourceLabel: {
    color: Brand.text,
    fontWeight: '700',
    fontSize: 14,
  },
  sourceBalance: {
    color: Brand.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  // Review
  reviewCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewLabel: {
    fontSize: 13,
    color: Brand.textMuted,
    fontWeight: '600',
  },
  reviewValue: {
    fontSize: 14,
    color: Brand.text,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  reviewDivider: {
    height: 1,
    backgroundColor: Brand.border,
  },

  // Risk acknowledgment
  ackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
  },
  ackBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ackBoxOn: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  ackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: Brand.textSecondary,
  },

  // PIN
  pinHeaderBlock: {
    alignItems: 'center',
    gap: 4,
  },
  pinHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.3,
  },
  pinHeaderSubtitle: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
});
