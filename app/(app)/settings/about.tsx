import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';

const LOGO = require('@/assets/images/splashlogo.png');

const LINKS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; url: string }[] = [
  { key: 'privacy', label: 'Privacy policy', icon: 'lock-closed-outline', url: 'https://safepay.ai/privacy' },
  { key: 'terms', label: 'Terms of service', icon: 'document-text-outline', url: 'https://safepay.ai/terms' },
  { key: 'support', label: 'Help & support', icon: 'help-buoy-outline', url: 'https://safepay.ai/support' },
];

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
          <Text style={styles.name}>SafePay AI</Text>
          <Text style={styles.tagline}>Real-time fraud protection for mobile money.</Text>
          <Text style={styles.version}>Version {version}</Text>
        </View>

        <View style={styles.card}>
          {LINKS.map((l, i) => (
            <Pressable
              key={l.key}
              onPress={() => Linking.openURL(l.url).catch(() => {})}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { opacity: 0.7 }]}>
              <Ionicons name={l.icon} size={20} color={Brand.textSecondary} />
              <Text style={styles.rowLabel}>{l.label}</Text>
              <Ionicons name="open-outline" size={16} color={Brand.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.copyright}>© {new Date().getFullYear()} SafePay AI · Kigali, Rwanda</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.xl },
  brand: { alignItems: 'center', gap: 8, marginTop: Spacing.lg },
  logo: { width: 88, height: 88 },
  name: { fontSize: 24, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  tagline: { fontSize: 14, color: Brand.textSecondary, textAlign: 'center', maxWidth: 280 },
  version: { fontSize: 12, color: Brand.textMuted, marginTop: 4 },
  card: {
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Brand.border },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: Brand.text },
  copyright: { fontSize: 12, color: Brand.textMuted, textAlign: 'center' },
});
