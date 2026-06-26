import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Brand, Spacing } from '@/constants/theme';

const LOGO = require('@/assets/images/splashlogo.png');

export default function Welcome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>Send. Receive. Save.</Text>
        <Text style={styles.subtitle}>Everything you need in one place.</Text>
      </View>

      <View style={styles.actions}>
        <Button label="Create account" onPress={() => router.push('/(auth)/register')} />
        <Button
          label="I already have an account"
          variant="secondary"
          onPress={() => router.push('/(auth)/login')}
        />
        <Text style={styles.footnote}>
          By continuing you agree to SafePay&apos;s Terms & Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  logo: {
    width: 220,
    height: 110,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: Brand.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: Brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  actions: {
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  footnote: {
    fontSize: 12,
    color: Brand.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
});
