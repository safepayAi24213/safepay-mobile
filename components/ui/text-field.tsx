import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';

type Props = TextInputProps & {
  label?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  password?: boolean;
  error?: string;
};

export function TextField({ label, leftIcon, password, error, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(password ?? false);

  const borderColor = error
    ? Brand.danger
    : focused
      ? Brand.primary
      : Brand.border;

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.field, { borderColor }]}>
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={focused ? Brand.primary : Brand.textMuted}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          {...rest}
          style={[styles.input, style]}
          placeholderTextColor={Brand.textMuted}
          secureTextEntry={hidden}
          selectionColor={Brand.primary}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />
        {password && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={12}>
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Brand.textMuted}
            />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textSecondary,
    letterSpacing: 0.2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    height: 54,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Brand.text,
    height: '100%',
  },
  error: {
    fontSize: 12,
    color: Brand.danger,
    marginTop: 2,
  },
});
