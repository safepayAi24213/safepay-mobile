import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';
import { REASON_COPY, useAccountState } from '@/lib/account-state';

export function FrozenBanner() {
  const { frozen, reason, unfreeze } = useAccountState();
  if (!frozen) return null;

  const confirmUnfreeze = () => {
    Alert.alert(
      'Unfreeze account?',
      'Payments will be allowed again. Only unfreeze if you’re sure your account is secure.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unfreeze', style: 'default', onPress: unfreeze },
      ],
    );
  };

  return (
    <View style={styles.banner}>
      <Ionicons name="snow-outline" size={16} color={Brand.critical} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Account frozen · payments blocked</Text>
        {reason && <Text style={styles.reason}>{REASON_COPY[reason]}</Text>}
      </View>
      <Pressable onPress={confirmUnfreeze} hitSlop={8} style={styles.btn}>
        <Text style={styles.btnLabel}>Unfreeze</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Brand.criticalSoft,
    borderBottomWidth: 1,
    borderColor: 'rgba(220,38,38,0.4)',
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.critical,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  reason: {
    fontSize: 11,
    color: Brand.textSecondary,
    marginTop: 1,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.5)',
  },
  btnLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.critical,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
