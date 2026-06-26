import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

type Props = {
  onBack?: () => void;
  right?: React.ReactNode;
};

export function ScreenHeader({ onBack, right }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={Brand.text} />
      </Pressable>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    minHeight: 48,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
