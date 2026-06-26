import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import type { RiskLevel, RiskScore } from '@/lib/risk-engine';

type Props = {
  score: RiskScore;
};

const LEVEL_META: Record<
  RiskLevel,
  {
    color: string;
    bg: string;
    border: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }
> = {
  low: {
    color: Brand.success,
    bg: Brand.successSoft,
    border: 'rgba(16,185,129,0.35)',
    icon: 'shield-checkmark',
    label: 'Low risk',
  },
  medium: {
    color: Brand.warning,
    bg: Brand.warningSoft,
    border: 'rgba(245,158,11,0.4)',
    icon: 'alert-circle',
    label: 'Medium risk',
  },
  high: {
    color: Brand.danger,
    bg: Brand.dangerSoft,
    border: 'rgba(239,68,68,0.4)',
    icon: 'warning',
    label: 'High risk',
  },
  blocked: {
    color: Brand.critical,
    bg: Brand.criticalSoft,
    border: 'rgba(220,38,38,0.45)',
    icon: 'close-circle',
    label: 'Blocked',
  },
};

export function RiskBadge({ score }: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta = LEVEL_META[score.level];

  return (
    <View style={[styles.card, { backgroundColor: meta.bg, borderColor: meta.border }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(0,0,0,0.18)' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
            <Text style={styles.confidence}>
              <Text style={[styles.aiTag, { color: meta.color }]}>SafePay AI</Text>
              {'  '}· {score.confidence}%
            </Text>
          </View>
          <Text style={styles.summary}>{score.summary}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => setExpanded((v) => !v)}
        hitSlop={6}
        style={styles.toggle}>
        <Text style={[styles.toggleText, { color: meta.color }]}>
          {expanded ? 'Hide signals' : `Why? (${score.signals.length})`}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={meta.color}
        />
      </Pressable>

      {expanded && (
        <View style={styles.signalsBlock}>
          {score.signals.map((s) => (
            <View key={s.code} style={styles.signalRow}>
              <View style={[styles.signalDot, { backgroundColor: meta.color }]} />
              <Text style={styles.signalLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  aiTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  confidence: {
    fontSize: 11,
    color: Brand.textMuted,
  },
  summary: {
    fontSize: 13,
    color: Brand.text,
    fontWeight: '600',
    marginTop: 2,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  signalsBlock: {
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  signalLabel: {
    flex: 1,
    fontSize: 12,
    color: Brand.textSecondary,
    fontWeight: '500',
  },
});
