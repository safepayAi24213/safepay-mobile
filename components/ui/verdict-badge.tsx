import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import type { Verdict } from '@/lib/format';

const META: Record<
  Verdict,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  allowed: {
    label: 'Allowed',
    color: Brand.success,
    bg: Brand.successSoft,
    icon: 'checkmark-circle',
  },
  verified: {
    label: 'Verified',
    color: Brand.warning,
    bg: Brand.warningSoft,
    icon: 'shield-checkmark',
  },
  blocked: {
    label: 'Blocked',
    color: Brand.danger,
    bg: Brand.dangerSoft,
    icon: 'close-circle',
  },
};

type Props = {
  verdict: Verdict;
  size?: 'sm' | 'md';
};

export function VerdictBadge({ verdict, size = 'sm' }: Props) {
  const meta = META[verdict];
  const compact = size === 'sm';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: meta.bg },
        compact ? styles.badgeSm : styles.badgeMd,
      ]}>
      <Ionicons name={meta.icon} size={compact ? 11 : 14} color={meta.color} />
      <Text style={[styles.label, { color: meta.color }, compact && styles.labelSm]}>
        {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  badgeSm: { paddingHorizontal: 7, paddingVertical: 2 },
  badgeMd: { paddingHorizontal: 10, paddingVertical: 5 },
  label: {
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelSm: { fontSize: 9 },
});
