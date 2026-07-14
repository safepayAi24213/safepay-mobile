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
import { ApiError, onboarding, risk as apiRisk, transactions as apiTransactions, wallets as apiWallets, type WalletDTO } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatRWF } from '@/lib/format';
import { useLiteMode } from '@/lib/lite-mode';
import { getCurrentCoords, type Coords } from '@/lib/location';
import { fireLocal } from '@/lib/notifications';
import { riskFromDto, scoreTransaction, type RiskScore } from '@/lib/risk-engine';
import {
  calculateFee,
  createTransaction,
  formatPhonePretty,
  recentRecipientsFromTxns,
  resolveRecipientName,
  type MoneySource,
  type RecentRecipient,
  type SendTransaction,
} from '@/lib/send-store';

type Step = 'recipient' | 'amount' | 'review' | 'pin';

type Props = {
  visible: boolean;
  onClose: () => void;
  onComplete: (txn: SendTransaction) => void;
};

const PIN_LENGTH = 4;

type SourceOption = { id: MoneySource; label: string; balance: number };

function notifySent(amount: number, recipientName: string) {
  fireLocal({
    title: 'Money sent',
    body: `You sent RWF ${formatRWF(amount, { hideSign: true })} to ${recipientName}.`,
    kind: 'transaction_sent',
  });
}

/** Normalise a Rwandan number to local 0-prefixed digits for comparison. */
function toLocalDigits(p: string): string {
  let d = (p || '').replace(/\D/g, '');
  if (d.startsWith('250')) d = d.slice(3);
  if (d.length === 9 && d.startsWith('7')) d = '0' + d;
  return d;
}

export function SendMoneySheet({ visible, onClose, onComplete }: Props) {
  const { isOnline, queueTransaction } = useLiteMode();
  const { frozen } = useAccountState();
  const { token, user } = useAuth();
  const [step, setStep] = useState<Step>('recipient');
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [source, setSource] = useState<MoneySource>('MTN MoMo');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentRecipient[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  // One-shot guard so a single confirm can never fire the send more than once.
  const submitting = useRef(false);

  useEffect(() => {
    if (!visible || !token) return;
    let cancelled = false;
    apiTransactions.list(token, { limit: 30 })
      .then((r) => {
        if (cancelled) return;
        setRecents(recentRecipientsFromTxns(r.items));
      })
      .catch(() => { if (!cancelled) setRecents([]); });
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
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, token]);

  // Capture device location once when the sheet opens (context for risk scoring).
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
      setStep('recipient');
      setPhone('');
      setRecipientName(null);
      setAmount('');
      setNote('');
      setSource('MTN MoMo');
      setPin('');
      setPinError(null);
      setCoords(null);
      submitting.current = false;
    }
  }, [visible]);

  const numericAmount = parseInt(amount || '0', 10) || 0;
  const fee = useMemo(() => calculateFee(numericAmount, source), [numericAmount, source]);
  const total = numericAmount + fee;

  // Risk verdict shown on Review/PIN. We seed with the instant local estimate,
  // then overwrite with the REAL backend engine (/risk/score-preview) so what
  // the user sees matches the decision the server will actually make.
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  useEffect(() => {
    if (step !== 'review' && step !== 'pin') {
      setRiskScore(null);
      return;
    }
    const local = scoreTransaction({
      amount: numericAmount,
      recipientPhone: phone,
      recipientName: recipientName ?? undefined,
      isKnownRecipient: !!recipientName,
      category: 'send',
    });
    setRiskScore(local);
    if (!token || numericAmount < 1) return;
    let cancelled = false;
    apiRisk
      .scorePreview(token, {
        kind: 'send',
        recipient_name: recipientName ?? formatPhonePretty(phone),
        recipient_phone: phone,
        source,
        amount: numericAmount,
        note: note || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      })
      .then((dto) => {
        if (!cancelled) setRiskScore(riskFromDto(dto));
      })
      .catch(() => {
        /* keep the local estimate on error/offline */
      });
    return () => {
      cancelled = true;
    };
  }, [step, numericAmount, phone, recipientName, source, note, token, coords]);

  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  useEffect(() => {
    setRiskAcknowledged(false);
  }, [step]);

  const selectRecent = (r: RecentRecipient) => {
    setPhone(r.phone);
    setRecipientName(r.name);
  };

  const onRecipientNext = () => {
    const resolved = recipientName ?? resolveRecipientName(phone, recents);
    setRecipientName(resolved);
    setStep('amount');
  };

  const onAmountNext = () => {
    setStep('review');
  };

  const onReviewNext = () => {
    setStep('pin');
  };

  const completeTransaction = async () => {
    // Guard against double/triple submits — set synchronously before any await
    // so concurrent timer callbacks can't all slip through.
    if (submitting.current) return;
    submitting.current = true;

    if (frozen) {
      onClose();
      setTimeout(() => {
        Alert.alert('Account frozen', 'Payments are blocked. Open Profile → Security to unfreeze.');
      }, 250);
      return;
    }

    const localPayload = {
      recipientName: recipientName ?? formatPhonePretty(phone),
      recipientPhone: formatPhonePretty(phone) || phone,
      amount: numericAmount,
      fee,
      total,
      note: note.trim() || undefined,
      source,
    };

    // Offline → queue locally; sync happens when user toggles back online.
    if (!isOnline) {
      queueTransaction(localPayload);
      onClose();
      setTimeout(() => {
        Alert.alert(
          'Queued for sync',
          `You're offline. RWF ${formatRWF(total, { hideSign: true })} to ${localPayload.recipientName} will be sent once you're back online.`,
        );
      }, 250);
      return;
    }

    // If we have a session token, hit the real backend. Otherwise fall back
    // to the local in-memory store so the demo still works without login.
    if (token) {
      try {
        const resp = await apiTransactions.send(token, {
          kind: 'send',
          recipient_name: localPayload.recipientName,
          recipient_phone: localPayload.recipientPhone,
          source,
          amount: numericAmount,
          note: localPayload.note,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        });

        // Mirror the backend transaction into the local store so the existing
        // receipt + success screens (which look up by local id) still resolve.
        const txn = createTransaction({
          ...localPayload,
          fee: parseFloat(resp.transaction.fee),
          total: parseFloat(resp.transaction.total),
        });

        notifySent(numericAmount, localPayload.recipientName);
        onClose();
        setTimeout(() => onComplete(txn), 250);
      } catch (err) {
        // Risk engine blocked us, validation failed, etc.
        const msg = err instanceof ApiError ? err.message : 'Failed to send.';
        onClose();
        setTimeout(() => Alert.alert('Send failed', msg), 250);
      }
      return;
    }

    // No token (legacy / mock mode): use the local store only.
    const txn = createTransaction(localPayload);
    notifySent(numericAmount, localPayload.recipientName);
    onClose();
    setTimeout(() => onComplete(txn), 250);
  };

  const verifyPinAndComplete = async (enteredPin: string) => {
    // With a session, verify the real transaction PIN before sending. Without a
    // token (local/demo mode) there's nothing to verify against, so proceed.
    if (token) {
      try {
        await onboarding.verifyPin(token, enteredPin);
      } catch {
        setPinError('Incorrect PIN. Try again.');
        setPin('');
        return;
      }
    }
    completeTransaction();
  };

  const onPinDigit = (digit: string) => {
    setPinError(null);
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setTimeout(() => verifyPinAndComplete(next), 180);
    }
  };

  const onPinBackspace = () => {
    setPinError(null);
    setPin((p) => p.slice(0, -1));
  };

  const selectedSource = sources.find((s) => s.id === source);
  const availableBalance = selectedSource?.balance ?? 0;
  const insufficientFunds = sources.length > 0 && numericAmount > 0 && total > availableBalance;

  // Block sending to your own number — a wallet can't transfer to itself.
  const isOwnNumber =
    !!user?.phone &&
    toLocalDigits(phone).length >= 9 &&
    toLocalDigits(phone) === toLocalDigits(user.phone);
  const recipientValid = phone.replace(/\D/g, '').length >= 9 && !isOwnNumber;
  const amountValid = numericAmount >= 1 && sources.length > 0 && !insufficientFunds;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.sheetHeader}>
              {step !== 'recipient' && (
                <Pressable
                  onPress={() => {
                    if (step === 'pin') {
                      setPin('');
                      setPinError(null);
                      setStep('review');
                    } else if (step === 'review') setStep('amount');
                    else if (step === 'amount') setStep('recipient');
                  }}
                  hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color={Brand.text} />
                </Pressable>
              )}
              <Text style={styles.sheetTitle}>
                {step === 'recipient'
                  ? 'Send to'
                  : step === 'amount'
                    ? 'Amount'
                    : step === 'review'
                      ? 'Review'
                      : 'Enter PIN'}
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={22} color={Brand.textSecondary} />
              </Pressable>
            </View>

            {/* The PIN step has its own progress dots (PinDots); showing the
                wizard step indicator there too looks like a duplicate/glitch. */}
            {step !== 'pin' && <StepDots step={step} />}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}>
              {step === 'recipient' && (
                <RecipientStep
                  phone={phone}
                  onChangePhone={setPhone}
                  onSelectRecent={selectRecent}
                  recents={recents}
                  ownNumber={isOwnNumber}
                />
              )}
              {step === 'amount' && (
                <AmountStep
                  amount={amount}
                  onChangeAmount={setAmount}
                  note={note}
                  onChangeNote={setNote}
                  source={source}
                  onSelectSource={setSource}
                  sources={sources}
                  insufficientFunds={insufficientFunds}
                  available={availableBalance}
                />
              )}
              {step === 'review' && (
                <ReviewStep
                  recipientName={recipientName}
                  phone={phone}
                  amount={numericAmount}
                  fee={fee}
                  total={total}
                  note={note}
                  source={source}
                  riskScore={riskScore}
                  riskAcknowledged={riskAcknowledged}
                  onAckChange={setRiskAcknowledged}
                />
              )}
              {step === 'pin' && (
                <PinStep
                  pin={pin}
                  error={pinError}
                  recipientName={recipientName ?? formatPhonePretty(phone)}
                  total={total}
                  onDigit={onPinDigit}
                  onBackspace={onPinBackspace}
                />
              )}
            </ScrollView>

            {step !== 'pin' && (
              <View style={styles.footer}>
                {step === 'recipient' && (
                  <Button label="Continue" onPress={onRecipientNext} disabled={!recipientValid} />
                )}
                {step === 'amount' && (
                  <Button label="Continue" onPress={onAmountNext} disabled={!amountValid} />
                )}
                {step === 'review' && riskScore?.level === 'blocked' && (
                  <Button label="Blocked — cannot send" disabled />
                )}
                {step === 'review' && riskScore && riskScore.level !== 'blocked' && (
                  <Button
                    label={riskScore.level === 'high' ? 'Override & confirm with PIN' : 'Confirm with PIN'}
                    onPress={onReviewNext}
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
  const order: Step[] = ['recipient', 'amount', 'review', 'pin'];
  const idx = order.indexOf(step);
  return (
    <View style={styles.dots}>
      {order.map((s, i) => (
        <View
          key={s}
          style={[
            styles.dot,
            i === idx && styles.dotActive,
            i < idx && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

function PinStep({
  pin,
  error,
  recipientName,
  total,
  onDigit,
  onBackspace,
}: {
  pin: string;
  error: string | null;
  recipientName: string;
  total: number;
  onDigit: (d: string) => void;
  onBackspace: () => void;
}) {
  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={styles.pinHeaderBlock}>
        <Text style={styles.pinHeaderTitle}>
          Sending RWF {formatRWF(total, { hideSign: true })}
        </Text>
        <Text style={styles.pinHeaderSubtitle}>to {recipientName}</Text>
      </View>
      <View style={{ alignItems: 'center', gap: Spacing.md }}>
        <PinDots length={PIN_LENGTH} filled={pin.length} />
        {error && <Text style={styles.pinError}>{error}</Text>}
      </View>
      <PinPad onDigit={onDigit} onBackspace={onBackspace} />
    </View>
  );
}

function RecipientStep({
  phone,
  onChangePhone,
  onSelectRecent,
  recents,
  ownNumber,
}: {
  phone: string;
  onChangePhone: (v: string) => void;
  onSelectRecent: (r: RecentRecipient) => void;
  recents: RecentRecipient[];
  ownNumber?: boolean;
}) {
  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={[styles.field, ownNumber && styles.fieldError]}>
        <Ionicons name="call-outline" size={20} color={Brand.textMuted} />
        <TextInput
          style={styles.fieldInput}
          value={phone}
          onChangeText={onChangePhone}
          placeholder="+250 7XX XXX XXX"
          placeholderTextColor={Brand.textMuted}
          keyboardType="phone-pad"
          selectionColor={Brand.primary}
        />
      </View>

      {ownNumber && (
        <Text style={styles.ownNumberError}>
          You can&apos;t send money to your own number.
        </Text>
      )}

      {recents.length > 0 && (
      <View style={{ paddingBottom: Spacing.lg }}>
        <Text style={styles.subLabel}>Recent</Text>
        <View style={{ gap: 6 }}>
          {recents.map((r) => (
            <Pressable
              key={r.phone}
              onPress={() => onSelectRecent(r)}
              style={({ pressed }) => [styles.recent, pressed && { opacity: 0.7 }]}>
              <View style={styles.recentAvatar}>
                {r.hasName ? (
                  <Text style={styles.recentInitials}>{r.initials}</Text>
                ) : (
                  <Ionicons name="person-outline" size={18} color={Brand.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentName} numberOfLines={1}>
                  {r.name}
                </Text>
                {r.hasName && (
                  <Text style={styles.recentPhone} numberOfLines={1}>
                    {r.phone}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
      )}
    </View>
  );
}

function AmountStep({
  amount,
  onChangeAmount,
  note,
  onChangeNote,
  source,
  onSelectSource,
  sources,
  insufficientFunds,
  available,
}: {
  amount: string;
  onChangeAmount: (v: string) => void;
  note: string;
  onChangeNote: (v: string) => void;
  source: MoneySource;
  onSelectSource: (s: MoneySource) => void;
  sources: SourceOption[];
  insufficientFunds: boolean;
  available: number;
}) {
  const n = parseInt(amount || '0', 10) || 0;
  const belowMin = n > 0 && n < 1;
  const showError = belowMin || insufficientFunds;
  const fee = calculateFee(n, source);
  const total = n + fee;
  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={styles.amountWrap}>
        <Text style={styles.amountCurrency}>RWF</Text>
        <TextInput
          style={[styles.amountInput, showError && { color: Brand.danger }]}
          value={amount}
          onChangeText={(t) => onChangeAmount(t.replace(/\D/g, ''))}
          placeholder="0"
          placeholderTextColor={Brand.textMuted}
          keyboardType="number-pad"
          autoFocus
          selectionColor={Brand.primary}
        />
        {belowMin ? (
          <Text style={styles.insufficientText}>Minimum amount is RWF 1</Text>
        ) : insufficientFunds ? (
          <Text style={styles.insufficientText}>
            Not enough balance · you have RWF {formatRWF(available, { hideSign: true })}
          </Text>
        ) : null}
      </View>

      {n >= 1 && !showError && (
        <View style={styles.feeHint}>
          <Ionicons name="information-circle-outline" size={14} color={Brand.textMuted} />
          <Text style={styles.feeHintText}>
            {source} fee RWF {formatRWF(fee, { hideSign: true })} · You pay RWF{' '}
            {formatRWF(total, { hideSign: true })}
          </Text>
        </View>
      )}

      <View>
        <Text style={styles.subLabel}>From</Text>
        {sources.length === 0 ? (
          <Text style={styles.sourceBalance}>
            Link a mobile money account in Profile to start sending.
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

      <View>
        <Text style={styles.subLabel}>Note (optional)</Text>
        <View style={styles.field}>
          <Ionicons name="chatbubble-outline" size={18} color={Brand.textMuted} />
          <TextInput
            style={styles.fieldInput}
            value={note}
            onChangeText={onChangeNote}
            placeholder="What's it for?"
            placeholderTextColor={Brand.textMuted}
            maxLength={60}
            selectionColor={Brand.primary}
          />
        </View>
      </View>
    </View>
  );
}

function ReviewStep({
  recipientName,
  phone,
  amount,
  fee,
  total,
  note,
  source,
  riskScore,
  riskAcknowledged,
  onAckChange,
}: {
  recipientName: string | null;
  phone: string;
  amount: number;
  fee: number;
  total: number;
  note: string;
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
        <ReviewRow label="To" value={recipientName ?? 'Recipient'} bold />
        <ReviewRow label="Phone" value={formatPhonePretty(phone) || phone} />
        <ReviewRow label="From" value={source} />
        {note ? <ReviewRow label="Note" value={note} /> : null}
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
              ? 'I understand this transaction looks risky and I want to proceed anyway.'
              : 'I confirm this transaction is intentional.'}
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
  dotActive: {
    width: 22,
    backgroundColor: Brand.primary,
  },
  dotDone: {
    backgroundColor: Brand.primary,
  },
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
  fieldError: {
    borderColor: Brand.danger,
  },
  ownNumberError: {
    marginTop: -Spacing.md,
    fontSize: 13,
    color: Brand.danger,
    fontWeight: '600',
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: Brand.text,
    height: '100%',
  },
  subLabel: {
    fontSize: 12,
    color: Brand.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // Recent
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  recentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInitials: {
    color: Brand.primary,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  recentName: {
    color: Brand.text,
    fontWeight: '700',
    fontSize: 14,
  },
  recentPhone: {
    color: Brand.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  // Amount
  amountWrap: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  amountCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1,
  },
  amountInput: {
    fontSize: 48,
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
  },
  feeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -Spacing.sm,
  },
  feeHintText: {
    fontSize: 12,
    color: Brand.textMuted,
    fontWeight: '600',
  },
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
  pinError: {
    fontSize: 13,
    color: Brand.danger,
    fontWeight: '600',
  },
});
