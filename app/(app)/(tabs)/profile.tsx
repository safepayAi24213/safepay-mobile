import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, type ErrorBoundaryProps, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAccountState } from '@/lib/account-state';
import { avatarUri } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useAvatarPicker } from '@/lib/avatar';
import { useConfirm } from '@/lib/confirm';
import { useBiometrics } from '@/lib/biometrics';
import { useLiteMode } from '@/lib/lite-mode';
import { NAIROBI, setDemoLocation } from '@/lib/location';
import { ensurePermission, fireLocal } from '@/lib/notifications';

function initialsOf(full?: string | null) {
  if (!full) return '··';
  const parts = full.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '··';
}

type Section = {
  key: string;
  title: string;
  rows: Row[];
};

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
  const { liteMode, setLiteMode, isOnline, setOnline, queue, flushQueue } = useLiteMode();
  const { capability, enabled: bioEnabled, setEnabled: setBioEnabled } = useBiometrics();
  const { frozen, freeze, unfreeze } = useAccountState();
  const { user, signOut } = useAuth();
  const { busy: avatarBusy, fromCamera, fromLibrary, remove: removeAvatar } = useAvatarPicker();
  const confirm = useConfirm();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [simulateFar, setSimulateFar] = useState(false);

  const toggleSimulateFar = (on: boolean) => {
    setSimulateFar(on);
    setDemoLocation(on ? NAIROBI : null);
  };

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

  const handleEnableBio = async (value: boolean) => {
    if (!value) {
      setBioEnabled(false);
      return;
    }
    if (!capability.available) {
      Alert.alert('Not available', 'This device has no biometric hardware.');
      return;
    }
    if (!capability.enrolled) {
      Alert.alert(
        `Set up ${capability.label} first`,
        `Open your device Settings and enrol ${capability.label}, then come back.`,
      );
      return;
    }
    setBioEnabled(true);
  };

  const handleEnableNotifs = async (value: boolean) => {
    if (!value) {
      setNotifEnabled(false);
      return;
    }
    const ok = await ensurePermission();
    if (!ok) {
      Alert.alert(
        'Notifications blocked',
        'Enable them in your device Settings under SafePay → Notifications.',
      );
      return;
    }
    setNotifEnabled(true);
  };

  const sendTestNotification = () => {
    fireLocal({
      title: 'SafePay AI · Test alert',
      body: 'If you can read this, push notifications are working.',
      kind: 'test',
    });
  };

  const sections: Section[] = [
    {
      key: 'account',
      title: 'Account',
      rows: [
        {
          key: 'personal',
          icon: 'person-outline',
          label: 'Personal info',
          hint: 'Name, email, phone, ID',
          href: '/(app)/settings/personal-info',
        },
        {
          key: 'mobilemoney',
          icon: 'wallet-outline',
          label: 'Linked accounts',
          hint: 'MTN MoMo · Airtel Money',
          href: '/(app)/settings/linked-accounts',
        },
        {
          key: 'notifications',
          icon: 'notifications-outline',
          label: 'Notifications',
          hint: 'Push, SMS, email preferences',
          href: '/(app)/settings/notifications',
        },
      ],
    },
    {
      key: 'security',
      title: 'Security',
      rows: [
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
          key: 'devices',
          icon: 'hardware-chip-outline',
          label: 'Trusted devices',
          hint: 'Skip extra checks here',
          href: '/(app)/settings/devices',
          tint: Brand.ai,
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
          key: 'change-pin',
          icon: 'key-outline',
          label: 'Change PIN',
          hint: 'Update your transaction PIN',
          href: '/(app)/settings/change-pin',
        },
      ],
    },
    {
      key: 'support',
      title: 'Support',
      rows: [
        {
          key: 'disputes',
          icon: 'shield-half-outline',
          label: 'Disputes',
          hint: 'Track fraud reports you’ve raised',
          href: '/(app)/settings/disputes',
          tint: Brand.danger,
        },
        {
          key: 'contact',
          icon: 'chatbubble-ellipses-outline',
          label: 'Support chat',
          hint: 'Message our customer-care team',
          href: '/(app)/settings/support',
          tint: Brand.primary,
        },
        {
          key: 'about',
          icon: 'information-circle-outline',
          label: 'About SafePay',
          href: '/(app)/settings/about',
        },
      ],
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

        {/* Security shortcuts */}
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>Security shortcuts</Text>
          <View style={styles.list}>
            <View style={styles.toggleRow}>
              <View style={[styles.rowIcon, { backgroundColor: Brand.primarySoft }]}>
                <Ionicons
                  name={capability.kind === 'face' ? 'scan-outline' : 'finger-print-outline'}
                  size={20}
                  color={Brand.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Sign in with {capability.label}</Text>
                <Text style={styles.rowHint}>
                  {capability.available
                    ? capability.enrolled
                      ? `Faster login using your device's ${capability.label}`
                      : `Enrol ${capability.label} in device Settings to enable`
                    : 'No biometric hardware on this device'}
                </Text>
              </View>
              <Switch
                value={bioEnabled}
                onValueChange={handleEnableBio}
                disabled={!capability.available || !capability.enrolled}
                trackColor={{ false: Brand.border, true: Brand.primary }}
                thumbColor={Brand.text}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={[styles.rowIcon, { backgroundColor: Brand.aiSoft }]}>
                <Ionicons name="notifications-outline" size={20} color={Brand.ai} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Push notifications</Text>
                <Text style={styles.rowHint}>
                  {notifEnabled
                    ? 'You’ll get an instant alert when SafePay AI flags something'
                    : 'Turn on to receive alerts about suspicious activity'}
                </Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={handleEnableNotifs}
                trackColor={{ false: Brand.border, true: Brand.ai }}
                thumbColor={Brand.text}
              />
            </View>

            {notifEnabled && (
              <Pressable
                onPress={sendTestNotification}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: Brand.surfaceElevated }]}>
                <View style={[styles.rowIcon, { backgroundColor: Brand.aiSoft }]}>
                  <Ionicons name="send-outline" size={18} color={Brand.ai} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Send a test notification</Text>
                  <Text style={styles.rowHint}>Verify your notifications work</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
              </Pressable>
            )}

            <Pressable
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
                  style={[
                    styles.rowLabel,
                    { color: frozen ? Brand.success : Brand.critical },
                  ]}>
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

            <View style={styles.toggleRow}>
              <View style={[styles.rowIcon, { backgroundColor: Brand.warningSoft }]}>
                <Ionicons name="location-outline" size={20} color={Brand.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Simulate distant location</Text>
                <Text style={styles.rowHint}>
                  Demo: send as if you’re far away, to trigger the location-mismatch check
                </Text>
              </View>
              <Switch
                value={simulateFar}
                onValueChange={toggleSimulateFar}
                trackColor={{ false: Brand.border, true: Brand.warning }}
                thumbColor={Brand.text}
              />
            </View>
          </View>
        </View>

        {/* Connectivity / Low-bandwidth controls */}
        <View style={{ gap: 8 }}>
          <Text style={styles.sectionTitle}>Connectivity</Text>
          <View style={styles.list}>
            <View style={styles.toggleRow}>
              <View style={[styles.rowIcon, { backgroundColor: Brand.aiSoft }]}>
                <Ionicons name="leaf-outline" size={20} color={Brand.ai} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Lite mode</Text>
                <Text style={styles.rowHint}>
                  Minimal UI · less data · USSD-style menu for low bandwidth
                </Text>
              </View>
              <Switch
                value={liteMode}
                onValueChange={setLiteMode}
                trackColor={{ false: Brand.border, true: Brand.ai }}
                thumbColor={Brand.text}
              />
            </View>
            <View style={styles.toggleRow}>
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: isOnline ? Brand.successSoft : Brand.warningSoft },
                ]}>
                <Ionicons
                  name={isOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
                  size={20}
                  color={isOnline ? Brand.success : Brand.warning}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Connection · {isOnline ? 'Online' : 'Offline'}</Text>
                <Text style={styles.rowHint}>
                  {isOnline
                    ? 'Toggle off to simulate a poor connection (demo)'
                    : `Toggling on will sync ${queue.length} queued payment${queue.length === 1 ? '' : 's'}`}
                </Text>
              </View>
              <Switch
                value={isOnline}
                onValueChange={(v) => {
                  setOnline(v);
                  if (v && queue.length > 0) {
                    setTimeout(() => flushQueue(), 400);
                  }
                }}
                trackColor={{ false: Brand.border, true: Brand.success }}
                thumbColor={Brand.text}
              />
            </View>
          </View>
        </View>

        {/* Sections */}
        {sections.map((s) => (
          <View key={s.key} style={{ gap: 8 }}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <View style={styles.list}>
              {s.rows.map((r) => (
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
                    <Ionicons
                      name={r.icon}
                      size={20}
                      color={r.tint ?? Brand.text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{r.label}</Text>
                    {r.hint && <Text style={styles.rowHint}>{r.hint}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

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
