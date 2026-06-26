export type MoneySource = 'MTN MoMo' | 'Airtel Money';

export type TransactionKind = 'send' | 'bill';

export type SendTransaction = {
  id: string;
  kind?: TransactionKind; // defaults to 'send' when omitted
  recipientName: string;
  recipientPhone: string;
  destinationLabel?: string; // overrides "Phone" label on the receipt
  amount: number;
  fee: number;
  total: number;
  note?: string;
  source: MoneySource;
  createdAt: string;
  reference: string;
  status: 'completed';
};

export type RecentRecipient = {
  name: string;       // real name, or the pretty phone when no name is known
  phone: string;      // pretty-formatted phone
  initials: string;   // '' when there is no real name
  hasName: boolean;   // true only when a genuine name is available
};

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Canonical Rwandan key for dedup: collapse the 0-prefixed local form
 * (07XXXXXXXX) and the international form (2507XXXXXXXX) to ONE value, so the
 * same person stored in two formats isn't listed twice.
 */
export function canonicalPhone(phone: string): string {
  let d = normalizePhone(phone);
  if (d.startsWith('0') && d.length === 10) d = '250' + d.slice(1);
  return d;
}

/** A "name" is real only if it has letters and isn't just the phone digits. */
function isRealName(name: string, phone: string): boolean {
  const trimmed = (name ?? '').trim();
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  return normalizePhone(trimmed) !== normalizePhone(phone);
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '··';
}

/**
 * Build the "recent recipients" pills from a user's real transaction history.
 * Dedupes by canonical phone (07.. and 2507.. collapse), newest-first.
 */
export function recentRecipientsFromTxns(
  txns: { recipient_name: string; recipient_phone: string; created_at: string; kind?: string }[],
  limit = 6,
): RecentRecipient[] {
  const seen = new Set<string>();
  const out: RecentRecipient[] = [];
  const sorted = [...txns].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const t of sorted) {
    if (t.kind === 'bill') continue;
    const phoneKey = canonicalPhone(t.recipient_phone);
    if (!phoneKey || seen.has(phoneKey)) continue;
    seen.add(phoneKey);
    const pretty = formatPhonePretty(t.recipient_phone) || t.recipient_phone;
    const hasName = isRealName(t.recipient_name, t.recipient_phone);
    out.push({
      name: hasName ? t.recipient_name.trim() : pretty,
      phone: pretty,
      initials: hasName ? initialsFor(t.recipient_name) : '',
      hasName,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Look up a previously-used recipient name by phone, from a list the caller
 * already has (e.g. recent txns). Returns null when only a phone is known.
 */
export function resolveRecipientName(
  phone: string,
  knownRecipients: RecentRecipient[],
): string | null {
  const key = canonicalPhone(phone);
  if (!key) return null;
  const hit = knownRecipients.find((r) => canonicalPhone(r.phone) === key);
  return hit && hit.hasName ? hit.name : null;
}

export function formatPhonePretty(digits: string): string {
  const d = normalizePhone(digits);
  if (!d) return '';
  // Rwanda format: +250 7XX XXX XXX
  if (d.startsWith('250') && d.length === 12) {
    return `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  }
  if (d.startsWith('0') && d.length === 10) {
    return `+250 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  return digits;
}

// Rwandan mobile money charges a FIXED fee per amount band (not a percentage),
// and MTN MoMo and Airtel Money use slightly different tariffs.
// [inclusiveUpperBound, fee]; amounts above the last band use FEE_ABOVE.
// Must stay in sync with the backend's FEE_TABLES in app/services/transactions.py.
const MTN_BANDS: [number, number][] = [
  [1000, 20],
  [10000, 100],
  [50000, 250],
  [150000, 500],
  [500000, 1000],
  [1000000, 1500],
  [2000000, 2500],
];
const AIRTEL_BANDS: [number, number][] = [
  [1000, 15],
  [10000, 90],
  [50000, 220],
  [150000, 450],
  [500000, 900],
  [1000000, 1400],
  [2000000, 2300],
];

export function calculateFee(amount: number, source: MoneySource = 'MTN MoMo'): number {
  if (amount <= 0) return 0;
  const bands = source === 'Airtel Money' ? AIRTEL_BANDS : MTN_BANDS;
  const feeAbove = source === 'Airtel Money' ? 2800 : 3000;
  for (const [upper, fee] of bands) {
    if (amount <= upper) return fee;
  }
  return feeAbove;
}

const transactions = new Map<string, SendTransaction>();

export function createTransaction(
  input: Omit<SendTransaction, 'id' | 'createdAt' | 'reference' | 'status'>,
): SendTransaction {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const reference = `SP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const txn: SendTransaction = {
    ...input,
    id,
    createdAt: new Date().toISOString(),
    reference,
    status: 'completed',
  };
  transactions.set(id, txn);
  return txn;
}

export function getTransaction(id: string): SendTransaction | undefined {
  return transactions.get(id);
}

export function listTransactions(): SendTransaction[] {
  // Newest first
  return Array.from(transactions.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function formatTxnDate(iso: string): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr}, ${timeStr}`;
}
