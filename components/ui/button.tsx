import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { Brand, Radius, Shadow } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.borderWidth },
        v.elevated && !isDisabled && Shadow.sm,
        isDisabled && { opacity: 0.45 },
        pressed && !isDisabled && { opacity: 0.9, transform: [{ scale: 0.99 }] },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<
  Variant,
  { bg: string; fg: string; border: string; borderWidth: number; elevated?: boolean }
> = {
  primary: {
    bg: Brand.primary,
    fg: Brand.textOnPrimary,
    border: 'transparent',
    borderWidth: 0,
    elevated: true,
  },
  secondary: {
    bg: Brand.surfaceElevated,
    fg: Brand.text,
    border: Brand.border,
    borderWidth: 1,
  },
  ghost: {
    bg: 'transparent',
    fg: Brand.primary,
    border: 'transparent',
    borderWidth: 0,
  },
  danger: {
    bg: Brand.dangerSoft,
    fg: Brand.danger,
    border: Brand.danger,
    borderWidth: 1,
  },
};

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
