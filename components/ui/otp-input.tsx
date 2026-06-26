import { useEffect, useRef, useState } from 'react';
import { NativeSyntheticEvent, StyleSheet, TextInput, TextInputKeyPressEventData, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

type Props = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
};

export function OtpInput({ length = 6, value, onChange, onComplete, autoFocus = true }: Props) {
  const inputs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(autoFocus ? 0 : -1);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputs.current[0]?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const chars = value.padEnd(length, ' ').split('');
    chars[index] = digit || ' ';
    const next = chars.join('').replace(/\s+$/, '');
    onChange(next.trimEnd());

    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
    if (digit && index === length - 1) {
      const completed = next.replace(/\s/g, '');
      if (completed.length === length) onComplete?.(completed);
    }
  };

  const handleKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const ch = value[i] ?? '';
        const isActive = focusedIndex === i;
        const isFilled = !!ch;
        return (
          <TextInput
            key={i}
            ref={(r) => {
              inputs.current[i] = r;
            }}
            value={ch}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKey(e, i)}
            onFocus={() => setFocusedIndex(i)}
            onBlur={() => setFocusedIndex(-1)}
            keyboardType="number-pad"
            maxLength={1}
            style={[
              styles.cell,
              isFilled && styles.cellFilled,
              isActive && styles.cellActive,
            ]}
            selectionColor={Brand.primary}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  cell: {
    width: 46,
    height: 58,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: Brand.text,
    letterSpacing: 0,
  },
  cellFilled: {
    borderColor: 'rgba(6,182,212,0.55)',
    backgroundColor: 'rgba(6,182,212,0.10)',
    color: Brand.primary,
  },
  cellActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.surfaceElevated,
  },
});
