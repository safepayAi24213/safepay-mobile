import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type ErrorBoundaryProps, type Href } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAccountState } from '@/lib/account-state';
import { avatarUri } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAvatarPicker } from '@/lib/avatar';
import { useConfirm } from '@/lib/confirm';

function initialsOf(full?: string | null) {
  if (!full) return '··';
  const parts = full.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '··';
}

type Row = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  href?: Href;
  onPress?: () => void;
  destructive?: boolean;
  tint?: string;
};

// expo-router renders this if the Profile screen throws — turns a silent blank
// screen into a visible, actionable error instead.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.errBox}>
        <Ionicons name="warning-outline" size={40} color={Brand.warning} />
        <Text style={styles.errTitle}>Profile couldn’t load</Text>
        <Text style={styles.errMsg}>{error?.message ?? 'Unknown error'}</Text>
        <Pressable onPress={retry} style={styles.errBtn}>
          <Text style={styles.errBtnText}>Try again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function Profile() {
  const router = useRouter();
  const { frozen, freeze, unfreeze } = useAccountState();
  const { user, signOut } = useAuth();
  const { busy: avatarBusy, fromCamera, fromLibrary, remove: removeAvatar } = useAvatarPicker();
  const confirm = useConfirm();

  const displayName = user?.full_name ?? 'Your account';
  const displayPhone = user?.phone ?? user?.email ?? '';
  const displayInitials = initialsOf(user?.full_name);
  const isVerified = !!user?.is_verified;
  const avatar = avatarUri(user?.avatar_url);

  const changePhoto = () => {
    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      { text: 'Take selfie', onPress: fromCamera },
      { text: 'Choose from gallery', onPress: fromLibrary },
    ];
    if (avatar) {
      options.push({ text: 'Remove photo', style: 'destructive', onPress: removeAvatar });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile picture', 'Update how you appear in SafePay.', options);
  };

  const handleFreeze = async () => {
    const ok = await confirm({
      title: 'Freeze account?',
      message: 'All payments will be blocked until you unfreeze. Use this if you suspect fraud.',
      confirmLabel: 'Freeze',
      destructive: true,
      icon: 'snow-outline',
    });
    if (ok) freeze('user_request');
  };

  // Single ordered list: identity → money → security → preferences → info.
  const menuRows: Row[] = [
    {
      key: 'personal',
      icon: 'person-outline',
      label: 'Personal info',
      hint: 'Name, phone, ID',
      href: '/(app)/settings/personal-info',
    },
    {
      key: 'mobilemoney',
      icon: 'wallet-outline',
      label: 'Linked accounts',
      hint: 'MTN MoMo · Airtel Money',
      href: '/(app)/settings/linked-accounts',
      tint: Brand.primary,
    },
    // Rendered with its own dynamic freeze/unfreeze styling in the map below.
    { key: 'freeze', icon: 'snow-outline', label: 'Freeze account' },
    {
      key: 'change-pin',
      icon: 'key-outline',
      label: 'Change PIN',
      hint: 'Update your transaction PIN',
      href: '/(app)/settings/change-pin',
      tint: Brand.success,
    },
    {
      key: 'mfa',
      icon: 'shield-checkmark-outline',
      label: 'Two-factor verification',
      hint: 'SMS code or app PIN for high-risk payments',
      href: '/(app)/settings/mfa',
      tint: Brand.success,
    },
    {
      key: 'sessions',
      icon: 'phone-portrait-outline',
      label: 'Active sessions',
      hint: 'Devices currently signed in',
      href: '/(app)/settings/sessions',
      tint: Brand.primary,
    },
    {
      key: 'login-history',
      icon: 'time-outline',
      label: 'Login history',
      hint: 'Recent sign-in activity',
      href: '/(app)/settings/login-history',
      tint: Brand.secondary,
    },
    {
      key: 'notifications',
      icon: 'notifications-outline',
      label: 'Notifications',
      hint: 'Push, SMS, email preferences',
      href: '/(app)/settings/notifications',
      tint: Brand.ai,
    },
    {
      key: 'about',
      icon: 'information-circle-outline',
      label: 'About SafePay',
      href: '/(app)/settings/about',
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerCard}>
          <Pressable onPress={changePhoto} disabled={avatarBusy} hitSlop={6}>
            <View style={styles.avatar}>
              {avatar ? (
                <Image
                  source={{ uri: avatar }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <Text style={styles.avatarText}>{displayInitials}</Text>
              )}
              {avatarBusy && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={Brand.text} />
                </View>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color={Brand.textOnPrimary} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            {!!displayPhone && <Text style={styles.detail}>{displayPhone}</Text>}
            <View style={[styles.kycPill, !isVerified && styles.kycPillPending]}>
              <Ionicons
                name={isVerified ? 'shield-checkmark' : 'shield-outline'}
                size={11}
                color={isVerified ? Brand.success : Brand.warning}
              />
              <Text style={[styles.kycText, !isVerified && styles.kycTextPending]}>
                {isVerified ? 'Verified' : 'Verification pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* All settings in one card */}
        <View style={styles.list}>
          {menuRows.map((r) => {
            // The freeze row has its own dynamic (frozen/unfrozen) styling.
            if (r.key === 'freeze') {
              return (
                <Pressable
                  key="freeze"
                  onPress={frozen ? unfreeze : handleFreeze}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: Brand.surfaceElevated }]}>
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: frozen ? Brand.successSoft : Brand.criticalSoft },
                    ]}>
                    <Ionicons
                      name={frozen ? 'lock-open-outline' : 'snow-outline'}
                      size={20}
                      color={frozen ? Brand.success : Brand.critical}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.rowLabel, { color: frozen ? Brand.success : Brand.critical }]}>
                      {frozen ? 'Unfreeze account' : 'Freeze account'}
                    </Text>
                    <Text style={styles.rowHint}>
                      {frozen
                        ? 'Allow payments again'
                        : 'Block all payments instantly if you suspect fraud'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={r.key}
                onPress={() => {
                  if (r.href) router.push(r.href);
                  else r.onPress?.();
                }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: Brand.surfaceElevated }]}>
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: r.tint ? `${r.tint}26` : Brand.surfaceElevated },
                  ]}>
                  <Ionicons name={r.icon} size={20} color={r.tint ?? Brand.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  {r.hint && <Text style={styles.rowHint}>{r.hint}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
              </Pressable>
            );
          })}
        </View>

        {/* Sign out */}
        <Pressable
          onPress={async () => {
            const ok = await confirm({
              title: 'Sign out?',
              message: 'You’ll need to log in again to use SafePay.',
              confirmLabel: 'Sign out',
              destructive: true,
              icon: 'log-out-outline',
            });
            if (ok) {
              signOut();
              router.replace('/(auth)/welcome');
            }
          }}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.85 }]}>
          <Ionicons name="log-out-outline" size={18} color={Brand.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.versionText}>SafePay AI · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  errBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: Spacing.xl,
  },
  errTitle: { fontSize: 18, fontWeight: '800', color: Brand.text },
  errMsg: { fontSize: 13, color: Brand.textSecondary, textAlign: 'center', lineHeight: 19 },
  errBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primary,
  },
  errBtnText: { color: Brand.textOnPrimary, fontWeight: '800' },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 24,
    gap: Spacing.lg,
  },

  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(6,182,212,0.3)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Brand.surface,
  },
  avatarText: {
    color: Brand.primary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.3,
  },
  detail: { fontSize: 13, color: Brand.textSecondary, marginTop: 2 },
  kycPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Brand.successSoft,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  kycText: {
    fontSize: 10,
    fontWeight: '700',
    color: Brand.success,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kycPillPending: {
    backgroundColor: Brand.warningSoft,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  kycTextPending: {
    color: Brand.warning,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  list: {
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Brand.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Brand.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 14, fontWeight: '700', color: Brand.text },
  rowHint: { fontSize: 11, color: Brand.textMuted, marginTop: 2 },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: Brand.dangerSoft,
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: Brand.danger },

  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: Brand.textMuted,
    marginTop: Spacing.sm,
  },
});
