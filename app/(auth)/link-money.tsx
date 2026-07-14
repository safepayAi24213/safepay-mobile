import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, onboarding, type MoneySource } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type ProviderId = 'momo' | 'airtel';

type Provider = {
  id: ProviderId;
  name: string;
  short: string;
  source: MoneySource;
  logo: number;
  prefixes: string[];
};

const PROVIDERS: Provider[] = [
  {
    id: 'momo',
    name: 'MTN MoMo',
    short: 'MTN Rwanda',
    source: 'MTN MoMo',
    logo: require('@/assets/images/MTN.png'),
    prefixes: ['078', '079'],
  },
  {
    id: 'airtel',
    name: 'Airtel Money',
    short: 'Airtel / Tigo Rwanda',
    source: 'Airtel Money',
    logo: require('@/assets/images/airtel.png'),
    prefixes: ['072', '073'],
  },
];

/** Normalise any Rwandan number to local 0-prefixed form, e.g. 078XXXXXXX. */
function toLocal(phone: string): string {
  let d = (phone || '').replace(/\D/g, '');
  if (d.startsWith('250')) d = d.slice(3);
  if (d.length === 9 && d.startsWith('7')) d = '0' + d;
  return d;
}

/** Detect the carrier from the number's prefix (078/079 → MTN, 072/073 → Airtel). */
function detectProvider(phone: string): ProviderId | null {
  const p3 = toLocal(phone).slice(0, 3);
  const match = PROVIDERS.find((p) => p.prefixes.includes(p3));
  return match?.id ?? null;
}

export default function LinkMoney() {
  const router = useRouter();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ phone?: string }>();

  const verifiedPhone = toLocal(user?.phone ?? params.phone ?? '');
  const recommendedId = useMemo(() => detectProvider(verifiedPhone), [verifiedPhone]);
  // A wallet lives on the SIM, so the carrier is fixed by the number's prefix.
  // Once detected, the provider is locked — the mismatched one can't be picked.
  const locked = recommendedId !== null;

  // Pre-select the detected provider. If the prefix is unknown, let them choose.
  const [selected, setSelected] = useState<ProviderId | null>(recommendedId);
  const [loading, setLoading] = useState(false);

  const canSubmit = selected !== null && verifiedPhone.length >= 10 && !!token;

  const submit = async () => {
    if (!canSubmit || !token) return;
    const provider = PROVIDERS.find((p) => p.id === selected);
    if (!provider) return;
    setLoading(true);
    try {
      await onboarding.linkMoney(token, provider.source, verifiedPhone, provider.name);
      router.replace('/(auth)/device-verify');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not link this account.';
      Alert.alert('Link failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Link your mobile money</Text>
          <Text style={styles.subtitle}>
            {recommendedId
              ? 'Your wallet is set by your number’s network. Confirm to link it.'
              : 'Choose the wallet that matches your verified number.'}
          </Text>
        </View>

        {/* The single, verified number everything links to. */}
        <View style={styles.phoneChip}>
          <Ionicons name="phone-portrait-outline" size={18} color={Brand.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.phoneChipLabel}>Verified number</Text>
            <Text style={styles.phoneChipValue}>{verifiedPhone || '—'}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={Brand.success} />
        </View>

        <View style={styles.providers}>
          {PROVIDERS.map((p) => {
            const isOn = selected === p.id;
            const isRecommended = recommendedId === p.id;
            // Locked to the SIM's carrier — the non-matching wallet is disabled.
            const disabled = locked && !isRecommended;
            return (
              <Pressable
                key={p.id}
                onPress={disabled ? undefined : () => setSelected(p.id)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.providerRow,
                  isOn && styles.providerRowOn,
                  disabled && styles.providerRowDisabled,
                  pressed && !disabled && { opacity: 0.9 },
                ]}>
                <Image source={p.logo} style={styles.providerLogo} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.providerName}>{p.name}</Text>
                    {isRecommended && (
                      <View style={styles.recommendBadge}>
                        <Text style={styles.recommendText}>Recommended</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.providerShort}>
                    {disabled ? 'Not available on this number' : p.short}
                  </Text>
                </View>
                {disabled ? (
                  <Ionicons name="lock-closed" size={18} color={Brand.textMuted} />
                ) : (
                  <View style={[styles.radio, isOn && styles.radioOn]}>
                    {isOn && <View style={styles.radioDot} />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={Brand.primary} />
          <Text style={styles.noticeText}>
            Your wallet links to your verified number only. You&apos;ll approve the link on the
            matching mobile money app.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Link account" onPress={submit} loading={loading} disabled={!canSubmit} />
      </View>
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
    fontSize: 26,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textSecondary,
    textAlign: 'center',
  },
  phoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  phoneChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  phoneChipValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.text,
    marginTop: 1,
  },
  providers: {
    gap: Spacing.sm,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  providerRowOn: {
    borderColor: Brand.primary,
    backgroundColor: Brand.surfaceElevated,
  },
  providerRowDisabled: {
    opacity: 0.45,
  },
  providerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.text,
  },
  recommendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Brand.successSoft,
  },
  recommendText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: Brand.success,
  },
  providerShort: {
    fontSize: 12,
    color: Brand.textMuted,
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: Brand.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Brand.primary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.xs,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: Brand.textMuted,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
});
