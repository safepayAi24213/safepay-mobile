/**
 * Display formatters used across the app. No user data lives here — pure utils.
 */

const RWF_FMT = new Intl.NumberFormat('en-US');

export function formatRWF(value: number, opts: { hideSign?: boolean } = {}) {
  if (!Number.isFinite(value)) return '0';
  const n = opts.hideSign ? Math.abs(value) : value;
  return RWF_FMT.format(Math.round(n));
}

/** Largest single transfer the backend accepts (RWF 5,000,000 = 7 digits). */
export const AMOUNT_MAX_DIGITS = 7;

/** Strip to digits, drop leading zeros, and cap the length so amounts stay
 *  within backend bounds. Keep the raw digit string in state. */
export function sanitizeAmountInput(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, AMOUNT_MAX_DIGITS);
}

/** Render a digit string with thousands separators: "1000" -> "1,000". */
export function amountWithCommas(digits: string): string {
  const d = digits.replace(/\D/g, '');
  return d ? RWF_FMT.format(Number(d)) : '';
}

export function firstName(full?: string | null): string {
  if (!full) return '';
  return full.trim().split(/\s+/)[0] ?? '';
}

export function initialsOf(full?: string | null): string {
  if (!full) return '··';
  const parts = full.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '··';
}

/**
 * The customer-facing SafePay AI verdict shown on every transaction.
 *   - Blocked  → SafePay AI stopped the payment
 *   - Verified → flagged as unusual but allowed after step-up verification
 *   - Allowed  → passed straight through (routine / low risk)
 */
export type Verdict = 'allowed' | 'verified' | 'blocked';

export function verdictOf(input: {
  status?: string | null;
  risk_level?: string | null;
}): Verdict {
  const status = (input.status ?? '').toLowerCase();
  const level = (input.risk_level ?? '').toLowerCase();
  if (status === 'blocked' || level === 'blocked') return 'blocked';
  if (level === 'high' || level === 'medium') return 'verified';
  return 'allowed';
}
