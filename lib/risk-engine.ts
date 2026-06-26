/**
 * SafePay AI — risk-scoring stub.
 *
 * Deterministic, client-side scoring designed to demo the thesis flow.
 * In production this is a server-side ML model returning {level, signals, confidence}.
 * Keep the shape of the response identical so the UI doesn't change when the
 * real engine is wired in.
 */

import { normalizePhone } from './send-store';

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export type RiskSignal = {
  code: string;
  label: string; // human-readable reason shown to the user
};

export type RiskScore = {
  level: RiskLevel;
  confidence: number; // 0–100
  signals: RiskSignal[];
  summary: string; // one-liner shown next to the badge
};

export type RiskInput = {
  amount: number;
  recipientPhone: string;
  recipientName?: string;
  isKnownRecipient?: boolean;
  category: 'send' | 'bill';
  now?: Date; // injectable for tests
};

/**
 * Map the REAL backend risk response (RiskDTO shape) into the local RiskScore
 * the UI renders. Lets screens show the actual engine verdict on the Review
 * step instead of the client-side estimate below.
 */
export function riskFromDto(dto: {
  level: RiskLevel;
  confidence: number;
  summary: string;
  signals: { code: string; label: string }[];
}): RiskScore {
  return {
    level: dto.level,
    confidence: dto.confidence,
    summary: dto.summary,
    signals: dto.signals.map((s) => ({ code: s.code, label: s.label })),
  };
}

// Demo blocklist — any number starting with these prefixes is auto-blocked.
const BLOCK_PREFIXES = ['250700', '250799999'];

const HIGH_AMOUNT = 200_000;
const MEDIUM_AMOUNT = 50_000;

export function scoreTransaction(input: RiskInput): RiskScore {
  const phone = normalizePhone(input.recipientPhone);
  const now = input.now ?? new Date();
  const hour = now.getHours();
  const signals: RiskSignal[] = [];

  // 1. Hard blocklist
  if (BLOCK_PREFIXES.some((p) => phone.startsWith(p))) {
    return {
      level: 'blocked',
      confidence: 99,
      signals: [
        { code: 'blocklist', label: 'Recipient is on SafePay’s fraud blocklist' },
      ],
      summary: 'Blocked by SafePay AI',
    };
  }

  // 2. Amount signals
  if (input.amount >= HIGH_AMOUNT) {
    signals.push({
      code: 'very_large_amount',
      label: `Very large amount (RWF ${input.amount.toLocaleString('en-US')})`,
    });
  } else if (input.amount >= MEDIUM_AMOUNT) {
    signals.push({
      code: 'large_amount',
      label: 'Amount above your usual',
    });
  }

  // 3. Unknown recipient (only meaningful for sends)
  if (input.category === 'send' && input.isKnownRecipient === false) {
    signals.push({ code: 'new_recipient', label: 'First-time recipient' });
  }

  // 4. Unusual hour (00:00–05:59 or 23:00+)
  if (hour < 6 || hour >= 23) {
    signals.push({ code: 'odd_hour', label: `Unusual hour (${hourLabel(hour)})` });
  }

  // 5. Round-number anomaly — combined with new recipient is suspicious
  if (
    input.category === 'send' &&
    input.isKnownRecipient === false &&
    input.amount >= 10_000 &&
    input.amount % 10_000 === 0
  ) {
    signals.push({ code: 'round_amount', label: 'Round-number amount' });
  }

  // 6. Aggregate to a level
  let level: RiskLevel = 'low';
  let confidence = 95;

  const hasHighAmount = signals.some((s) => s.code === 'very_large_amount');
  const hasNewRecipient = signals.some((s) => s.code === 'new_recipient');
  const hasOddHour = signals.some((s) => s.code === 'odd_hour');
  const hasLargeAmount = signals.some((s) => s.code === 'large_amount');
  const hasRoundAmount = signals.some((s) => s.code === 'round_amount');

  if (hasHighAmount && hasNewRecipient) {
    level = 'high';
    confidence = 88;
  } else if (hasHighAmount) {
    level = 'high';
    confidence = 76;
  } else if (hasNewRecipient && hasLargeAmount) {
    level = 'high';
    confidence = 72;
  } else if (
    (hasNewRecipient && hasOddHour) ||
    (hasLargeAmount && hasOddHour) ||
    hasRoundAmount
  ) {
    level = 'medium';
    confidence = 70;
  } else if (hasNewRecipient || hasLargeAmount || hasOddHour) {
    level = 'medium';
    confidence = 65;
  }

  const summary = SUMMARY[level];
  return {
    level,
    confidence,
    signals: signals.length ? signals : [{ code: 'routine', label: 'Routine transaction' }],
    summary,
  };
}

const SUMMARY: Record<RiskLevel, string> = {
  low: 'Looks safe',
  medium: 'Looks unusual',
  high: 'High risk — please confirm',
  blocked: 'Blocked by SafePay AI',
};

function hourLabel(h: number): string {
  const hh = h.toString().padStart(2, '0');
  return `${hh}:00`;
}
