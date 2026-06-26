import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import { Brand } from '@/constants/theme';
import { avatarUri } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type IconProps = {
  name: keyof typeof Ionicons.glyphMap;
  focusedName?: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
  focused: boolean;
};

/**
 * Animated tab icon — a small spring "lift" when the tab becomes active.
 * The pill background is rendered by WhatsAppTabButton (see below) so the
 * highlight wraps both icon and label.
 */
export function AnimatedTabIcon({ name, focusedName, color, size = 26, focused }: IconProps) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, {
      damping: 14,
      stiffness: 220,
      mass: 0.7,
    });
  }, [focused, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.08 }],
  }));

  const iconName = focused ? (focusedName ?? name) : name;

  return (
    <Animated.View style={style}>
      <Ionicons name={iconName} size={size} color={color} />
    </Animated.View>
  );
}

/**
 * Profile tab icon — shows the user's avatar when they've set one (with an
 * active-colour ring when focused), otherwise the standard person icon. Keeps
 * the same spring "lift" as the other tabs.
 */
export function ProfileTabIcon({
  color,
  focused,
  size = 28,
}: {
  color: string;
  focused: boolean;
  size?: number;
}) {
  const { user } = useAuth();
  const avatar = avatarUri(user?.avatar_url);

  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 220, mass: 0.7 });
  }, [focused, progress]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.08 }],
  }));

  if (!avatar) {
    return <AnimatedTabIcon name="person" color={color} focused={focused} size={size} />;
  }

  return (
    <Animated.View style={style}>
      <View
        style={[
          styles.avatarRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: focused ? color : 'transparent',
          },
        ]}>
        <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" />
      </View>
    </Animated.View>
  );
}

type LabelProps = {
  label: string;
  color: string;
  focused: boolean;
};

export function AnimatedTabLabel({ label, color, focused }: LabelProps) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [focused, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.7 + progress.value * 0.3,
  }));

  return (
    <Animated.Text style={[styles.label, { color }, style, focused && styles.labelFocused]}>
      {label}
    </Animated.Text>
  );
}

/**
 * Custom tabBarButton that draws a WhatsApp-style rounded pill *behind* the
 * icon + label of the focused tab. The pill fades + scales in/out so the
 * transition between tabs feels smooth.
 */
export function WhatsAppTabButton({
  children,
  onPress,
  onLongPress,
  accessibilityState,
  accessibilityLabel,
  testID,
}: BottomTabBarButtonProps) {
  const focused = !!accessibilityState?.selected;
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, {
      damping: 16,
      stiffness: 200,
      mass: 0.8,
    });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={styles.button}
      android_ripple={null}>
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 6,
    right: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(6,182,212,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.55)',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  labelFocused: {
    fontWeight: '700',
  },
  avatarRing: {
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: Brand.surfaceElevated,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
});
