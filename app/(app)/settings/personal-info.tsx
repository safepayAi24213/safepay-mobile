import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { ApiError, users } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function PersonalInfoScreen() {
  const { token, user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    fullName.trim() !== (user?.full_name ?? '') || phone.trim() !== (user?.phone ?? '');
  const canSave = dirty && fullName.trim().length >= 2 && !busy;

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

  const save = async () => {
    if (!token || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await users.updateProfile(token, {
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      updateUser({ full_name: updated.full_name, phone: updated.phone });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Personal info</Text>
        <Text style={styles.sub}>Manage how you appear and how we reach you.</Text>

        <View style={styles.formGap}>
          <TextField
            label="Full name"
            leftIcon="person-outline"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            placeholder="Your name"
          />
          <TextField
            label="Phone"
            leftIcon="call-outline"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+250 7XX XXX XXX"
          />
        </View>

        <View style={styles.card}>
          <ReadOnly icon="mail-outline" label="Email" value={user?.email ?? '—'} />
          <Divider />
          <ReadOnly
            icon={user?.is_verified ? 'shield-checkmark' : 'shield-outline'}
            label="Identity"
            value={user?.is_verified ? 'Verified' : 'Not verified'}
            valueColor={user?.is_verified ? Brand.success : Brand.textMuted}
          />
          <Divider />
          <ReadOnly icon="calendar-outline" label="Member since" value={memberSince} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={busy ? 'Saving…' : 'Save changes'}
          onPress={save}
          disabled={!canSave}
          loading={busy}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadOnly({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.roRow}>
      <Ionicons name={icon} size={18} color={Brand.textMuted} />
      <Text style={styles.roLabel}>{label}</Text>
      <Text style={[styles.roValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: Brand.text, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: Brand.textSecondary, marginTop: -Spacing.sm },
  formGap: { gap: Spacing.md },
  card: {
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: Spacing.md,
  },
  roRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  roLabel: { fontSize: 13, color: Brand.textMuted, fontWeight: '600' },
  roValue: { flex: 1, fontSize: 14, color: Brand.text, fontWeight: '700', textAlign: 'right' },
  divider: { height: 1, backgroundColor: Brand.border },
  error: { fontSize: 13, fontWeight: '600', color: Brand.danger },
});
