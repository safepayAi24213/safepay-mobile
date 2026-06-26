import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  hint?: string;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label?: string;
};

export function Segmented<T extends string>({ value, onChange, options, label }: Props<T>) {
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={({ pressed }) => [
                styles.opt,
                selected && styles.optSelected,
                pressed && !selected && { opacity: 0.7 },
              ]}>
              {o.icon && (
                <Ionicons
                  name={o.icon}
                  size={18}
                  color={selected ? Brand.textOnPrimary : Brand.text}
                  style={{ marginBottom: 4 }}
                />
              )}
              <Text style={[styles.optLabel, selected && styles.optLabelSelected]}>
                {o.label}
              </Text>
              {o.hint && (
                <Text
                  style={[
                    styles.optHint,
                    selected && { color: 'rgba(11,18,32,0.78)' },
                  ]}>
                  {o.hint}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textSecondary,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  opt: {
    flex: 1,
    borderRadius: Radius.sm + 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optSelected: {
    backgroundColor: Brand.primary,
  },
  optLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
  },
  optLabelSelected: {
    color: Brand.textOnPrimary,
  },
  optHint: {
    fontSize: 11,
    color: Brand.textMuted,
    marginTop: 2,
  },
});
