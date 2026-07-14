import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionBanner } from '@/components/connection-banner';
import { FrozenBanner } from '@/components/frozen-banner';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { AccountStateProvider } from '@/lib/account-state';
import { ConfirmProvider } from '@/lib/confirm';
import { LiteModeProvider } from '@/lib/lite-mode';
import { MFAProvider } from '@/lib/mfa';
import { RealtimeProvider } from '@/lib/realtime';
import { useAuth } from '@/lib/auth-context';
import { auth, ApiError } from '@/lib/api';
import { fireLocal } from '@/lib/notifications';

const LOGO = require('@/assets/images/splashlogo.png');

// Notify the user when their registration decision changes (pending → approved
// or pending → rejected). Fires a system banner + an in-app alert.
function notifyDecision(
  prev: string | undefined,
  next: string | undefined,
  reason?: string | null,
) {
  if (prev === next) return;
  if (next === 'approved') {
    void fireLocal({
      title: 'Account approved 🎉',
      body: 'Your SafePay account has been approved. Welcome!',
    });
    Alert.alert('Account approved 🎉', 'Your account has been approved. Welcome to SafePay!');
  } else if (next === 'rejected') {
    const body = reason
      ? `Reason: ${reason}`
      : 'Your registration was not approved. Please review and resubmit your ID.';
    void fireLocal({ title: 'Registration rejected', body });
    Alert.alert('Registration rejected', body);
  }
}

export default function AppLayout() {
  const { user, token, updateUser, signOut } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // While the account is pending, silently re-check approval every 15s so the
  // app unlocks on its own the moment compliance approves — no tap needed.
  useEffect(() => {
    if (!token || user?.registration_status !== 'pending_review') return;
    const id = setInterval(async () => {
      try {
        const updated = await auth.me(token);
        notifyDecision(user?.registration_status, updated.registration_status, updated.rejection_reason);
        updateUser(updated);
      } catch {
        // Ignore transient errors; keep polling.
      }
    }, 15000);
    return () => clearInterval(id);
  }, [token, user?.registration_status, updateUser]);

  const handleLogout = () => {
    // Clear the session, then send the user to the login page (there is no
    // global auth gate, so we navigate explicitly).
    signOut();
    router.replace('/(auth)/login');
  };

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const updated = await auth.me(token);
      notifyDecision(user?.registration_status, updated.registration_status, updated.rejection_reason);
      updateUser(updated);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not refresh status.';
      Alert.alert('Error', msg);
    } finally {
      setRefreshing(false);
    }
  };

  // If user is pending review or rejected, display status screen
  if (user && user.registration_status !== 'approved') {
    const isPending = user.registration_status === 'pending_review';

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Official logo */}
          <View style={styles.logoRow}>
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          </View>

          {/* Status Display */}
          <View style={styles.statusBox}>
            <View style={[styles.statusIconBg, isPending ? styles.pendingBg : styles.rejectedBg]}>
              <Ionicons
                name={isPending ? 'time-outline' : 'close-circle-outline'}
                size={48}
                color={isPending ? Brand.warning : Brand.danger}
              />
            </View>

            <Text style={styles.statusTitle}>
              {isPending ? 'Account Under Review' : 'Registration Rejected'}
            </Text>

            <Text style={styles.statusSubtitle}>
              {isPending
                ? "Our compliance team is currently reviewing your registration details. This process usually takes under 24 hours."
                : "Your registration was not approved based on the submitted documents."}
            </Text>

            {!isPending && user.rejection_reason && (
              <View style={styles.rejectionCard}>
                <Text style={styles.rejectionLabel}>REASON FOR REJECTION:</Text>
                <Text style={styles.rejectionText}>&ldquo;{user.rejection_reason}&rdquo;</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsBox}>
            {isPending ? (
              <Pressable
                onPress={handleRefresh}
                disabled={refreshing}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.9 },
                  refreshing && { opacity: 0.6 },
                ]}>
                {refreshing ? (
                  <ActivityIndicator color={Brand.textOnPrimary} size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={16} color={Brand.textOnPrimary} />
                    <Text style={styles.btnPrimaryText}>Check Status</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.replace('/(auth)/verify-id')}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && { opacity: 0.9 },
                ]}>
                <Ionicons name="document-text-outline" size={16} color={Brand.textOnPrimary} />
                <Text style={styles.btnPrimaryText}>Edit & Resubmit ID</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && { opacity: 0.8 },
              ]}>
              <Ionicons name="log-out-outline" size={16} color={Brand.textSecondary} />
              <Text style={styles.btnSecondaryText}>Log Out</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AccountStateProvider>
      <LiteModeProvider>
        <MFAProvider>
          <RealtimeProvider>
            <ConfirmProvider>
              <SafeAreaView
                style={{ flex: 1, backgroundColor: Brand.bg }}
                edges={['top']}>
                <FrozenBanner />
                <ConnectionBanner />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: Brand.bg },
                  }}
                />
              </SafeAreaView>
            </ConfirmProvider>
          </RealtimeProvider>
        </MFAProvider>
      </LiteModeProvider>
    </AccountStateProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  logo: {
    width: 150,
    height: 64,
  },
  statusBox: {
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
    paddingHorizontal: Spacing.md,
  },
  statusIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  pendingBg: {
    backgroundColor: `${Brand.warning}15`,
    borderColor: `${Brand.warning}30`,
  },
  rejectedBg: {
    backgroundColor: `${Brand.danger}15`,
    borderColor: `${Brand.danger}30`,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Brand.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xs,
  },
  rejectionCard: {
    width: '100%',
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: `${Brand.danger}40`,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    gap: 4,
  },
  rejectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.danger,
    letterSpacing: 0.5,
  },
  rejectionText: {
    fontSize: 13,
    lineHeight: 18,
    color: Brand.text,
    fontStyle: 'italic',
  },
  actionsBox: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  btnPrimary: {
    height: 48,
    width: '100%',
    borderRadius: Radius.md,
    backgroundColor: Brand.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.textOnPrimary,
  },
  btnSecondary: {
    height: 48,
    width: '100%',
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.textSecondary,
  },
});
