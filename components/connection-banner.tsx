import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';
import { useLiteMode } from '@/lib/lite-mode';

export function ConnectionBanner() {
  const { liteMode, isOnline, queue, flushQueue } = useLiteMode();

  // Hide entirely if nothing notable is happening
  if (isOnline && !liteMode && queue.length === 0) return null;

  // Offline takes priority over Lite mode in the message
  if (!isOnline) {
    return (
      <View style={[styles.banner, styles.bannerOffline]}>
        <View style={styles.dot} />
        <Ionicons name="cloud-offline-outline" size={14} color={Brand.warning} />
        <Text style={[styles.label, { color: Brand.warning }]}>
          Offline
          {queue.length > 0 ? ` · ${queue.length} queued for sync` : ' · transactions will be queued'}
        </Text>
      </View>
    );
  }

  // Online but with queued items → show flush prompt
  if (queue.length > 0) {
    return (
      <Pressable
        onPress={() => flushQueue()}
        style={({ pressed }) => [
          styles.banner,
          styles.bannerSync,
          pressed && { opacity: 0.85 },
        ]}>
        <Ionicons name="sync-outline" size={14} color={Brand.primary} />
        <Text style={[styles.label, { color: Brand.primary }]}>
          {queue.length} pending · tap to sync now
        </Text>
      </Pressable>
    );
  }

  // Lite mode banner
  return (
    <View style={[styles.banner, styles.bannerLite]}>
      <Ionicons name="leaf-outline" size={14} color={Brand.ai} />
      <Text style={[styles.label, { color: Brand.ai }]}>
        Lite mode · optimised for low bandwidth
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  bannerLite: {
    backgroundColor: Brand.aiSoft,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  bannerOffline: {
    backgroundColor: Brand.warningSoft,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  bannerSync: {
    backgroundColor: Brand.primarySoft,
    borderColor: 'rgba(6,182,212,0.35)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.warning,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
