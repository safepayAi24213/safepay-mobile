import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, onboarding, type MoneySource } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type Provider = {
  id: 'momo' | 'airtel';
  name: string;
  short: string;
  source: MoneySource;
  logo: number;
};

const PROVIDERS: Provider[] = [
  {
    id: 'momo',
    name: 'MTN MoMo',
    short: 'MTN Rwanda',
    source: 'MTN MoMo',
    logo: require('@/assets/images/MTN.png'),
  },
  {
    id: 'airtel',
    name: 'Airtel Money',
    short: 'Airtel Rwanda',
    source: 'Airtel Money',
    logo: require('@/assets/images/airtel.png'),
  },
];

type PhoneMap = Record<Provider['id'], string>;

export default function LinkMoney() {
  const router = useRouter();
  const { token } = useAuth();
  const [selected, setSelected] = useState<Set<Provider['id']>>(new Set());
  const [phones, setPhones] = useState<PhoneMap>({ momo: '', airtel: '' });
  const [loading, setLoading] = useState(false);

  const toggleProvider = (id: Provider['id']) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setPhoneFor = (id: Provider['id'], value: string) =>
    setPhones((p) => ({ ...p, [id]: value }));

  const validSelections = PROVIDERS.filter(
    (p) => selected.has(p.id) && phones[p.id].trim().length >= 9,
  );
  const canSubmit = validSelections.length > 0 && validSelections.length === selected.size;

  const submit = async () => {
    if (!canSubmit || !token) return;
    setLoading(true);
    try {
      for (const p of validSelections) {
        await onboarding.linkMoney(token, p.source, phones[p.id].trim());
      }
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets>
          <View style={styles.header}>
            <Text style={styles.title}>Link your mobile money</Text>
            <Text style={styles.subtitle}>
              Tick the providers you use. Add the number for each — link one, the other, or both.
            </Text>
          </View>

          <View style={styles.providers}>
            {PROVIDERS.map((p) => {
              const isOn = selected.has(p.id);
              return (
                <View key={p.id} style={[styles.providerWrap, isOn && styles.providerWrapOn]}>
                  <Pressable
                    onPress={() => toggleProvider(p.id)}
                    style={({ pressed }) => [
                      styles.providerRow,
                      pressed && { opacity: 0.85 },
                    ]}>
                    <Image source={p.logo} style={styles.providerLogo} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.providerName}>{p.name}</Text>
                      <Text style={styles.providerShort}>{p.short}</Text>
                    </View>
                    <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                      {isOn && (
                        <Ionicons name="checkmark" size={16} color={Brand.textOnPrimary} />
                      )}
                    </View>
                  </Pressable>

                  {isOn && (
                    <View style={styles.phoneField}>
                      <TextField
                        label={`${p.name} number`}
                        leftIcon="call-outline"
                        placeholder="07XX XXX XXX"
                        keyboardType="phone-pad"
                        value={phones[p.id]}
                        onChangeText={(v) => setPhoneFor(p.id, v)}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={Brand.primary} />
            <Text style={styles.noticeText}>
              You&apos;ll be asked to approve each link on the matching mobile money app.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={
              validSelections.length > 1
                ? `Link ${validSelections.length} accounts`
                : 'Link account'
            }
            onPress={submit}
            loading={loading}
            disabled={!canSubmit}
          />
        </View>
      </KeyboardAvoidingView>
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
  providers: {
    gap: Spacing.sm,
  },
  providerWrap: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    overflow: 'hidden',
  },
  providerWrapOn: {
    borderColor: Brand.primary,
    backgroundColor: Brand.surfaceElevated,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  providerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.text,
  },
  providerShort: {
    fontSize: 12,
    color: Brand.textMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  phoneField: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
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
