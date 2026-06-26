import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Default handler — show alert + banner in tray, even when app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const ANDROID_CHANNEL_ID = 'default';

export type NotificationKind =
  | 'fraud_alert'
  | 'transaction_sent'
  | 'transaction_received'
  | 'test';

/**
 * Android (8+) won't display ANY notification without a channel, and (13+)
 * won't display one without runtime permission. Create the channel eagerly so
 * it always exists — independent of whether/when permission is granted.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'SafePay alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// Set the channel up at startup (fire-and-forget).
void ensureAndroidChannel();

export async function ensurePermission(): Promise<boolean> {
  // Channel must exist before a notification can show on Android — ensure it
  // every time, not just on the first permission request.
  await ensureAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** True only if permission is already granted — never prompts. */
export async function hasPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  return existing.granted;
}

export async function fireLocal(opts: {
  title: string;
  body: string;
  kind?: NotificationKind;
}): Promise<void> {
  const ok = await ensurePermission();
  if (!ok) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      sound: 'default',
      data: { kind: opts.kind ?? 'test' },
    },
    // On Android, target the high-importance channel so it shows as a banner.
    trigger:
      Platform.OS === 'android'
        ? ({ channelId: ANDROID_CHANNEL_ID } as Notifications.NotificationTriggerInput)
        : null,
  });
}
