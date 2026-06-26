import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  href: Href;
  tint: string;
};

const ROWS: Row[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'Active sessions',
    hint: 'See where you’re signed in',
    href: '/(app)/settings/sessions',
    tint: Brand.primary,
  },
  {
    icon: 'time-outline',
    title: 'Login history',
    hint: 'Recent sign-in activity',
    href: '/(app)/settings/login-history',
    tint: Brand.secondary,
  },
  {
    icon: 'hardware-chip-outline',
    title: 'Trusted devices',
    hint: 'Manage devices that skip extra checks',
    href: '/(app)/settings/devices',
    tint: Brand.ai,
  },
];

export default function SettingsHome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Security</Text>
          <Text style={styles.subtitle}>Review and manage how your SafePay account is accessed.</Text>
        </View>

        <View style={styles.list}>
          {ROWS.map((r) => (
            <Pressable
              key={r.title}
              onPress={() => router.push(r.href)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={[styles.rowIcon, { backgroundColor: `${r.tint}26` }]}>
                <Ionicons name={r.icon} size={22} color={r.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowHint}>{r.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Brand.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  header: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textSecondary,
  },
  list: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  rowPressed: {
    backgroundColor: Brand.surfaceElevated,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  rowHint: {
    fontSize: 12,
    color: Brand.textMuted,
    marginTop: 2,
  },
});
