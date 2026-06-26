import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

type Props = {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
};

const KEYS: (string | null)[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'back'];

export function PinPad({ onDigit, onBackspace }: Props) {
  return (
    <View style={styles.grid}>
      {KEYS.map((key, i) => {
        if (key === null) return <View key={`gap-${i}`} style={styles.key} />;
        if (key === 'back') {
          return (
            <Pressable
              key="back"
              onPress={onBackspace}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              hitSlop={8}>
              <Ionicons name="backspace-outline" size={26} color={Brand.text} />
            </Pressable>
          );
        }
        return (
          <Pressable
            key={key}
            onPress={() => onDigit(key)}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}>
            <Text style={styles.keyLabel}>{key}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type DotsProps = {
  length: number;
  filled: number;
};

export function PinDots({ length, filled }: DotsProps) {
  return (
    <View style={styles.dots}>
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < filled ? { backgroundColor: Brand.primary, borderColor: Brand.primary } : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 312,
    alignSelf: 'center',
  },
  key: {
    width: 90,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  keyPressed: {
    backgroundColor: Brand.surfaceElevated,
    transform: [{ scale: 0.97 }],
  },
  keyLabel: {
    fontSize: 26,
    fontWeight: '600',
    color: Brand.text,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Brand.border,
    backgroundColor: 'transparent',
  },
});
