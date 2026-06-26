import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Radius, Shadow, Spacing } from '@/constants/theme';

/**
 * Reusable bottom sheet built on Reanimated + gesture-handler.
 *
 *  - Spring slide-in / timed slide-out, animated backdrop fade.
 *  - Drag the grab-handle down to dismiss (distance or velocity threshold).
 *  - Pinned flush to the bottom edge; fills the home-indicator safe area.
 *  - Content (children) owns its own scroll/keyboard handling.
 *
 * The sheet provides the surface chrome (rounded top, handle, horizontal
 * padding, bottom safe-area). Children render header/body/footer only.
 */

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Fraction of screen height the sheet may grow to. Default 0.92. */
  maxHeightRatio?: number;
};

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const OPEN_SPRING = { damping: 26, stiffness: 320, mass: 0.7 };
const CLOSE_MS = 200;
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 800;
const MAX_BLUR = 32;

export function BottomSheet({ visible, onClose, children, maxHeightRatio = 0.92 }: Props) {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(screenH);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withSpring(0, OPEN_SPRING);
    } else if (mounted) {
      translateY.value = withTiming(screenH, { duration: CLOSE_MS }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = () => onClose();

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(screenH, { duration: CLOSE_MS }, (finished) => {
          if (finished) runOnJS(requestClose)();
        });
      } else {
        translateY.value = withSpring(0, OPEN_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, screenH], [1, 0], Extrapolation.CLAMP),
  }));

  const blurProps = useAnimatedProps(() => ({
    intensity: interpolate(translateY.value, [0, screenH], [MAX_BLUR, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={requestClose}>
      {/* Gestures inside a RN Modal need their own root view. */}
      <GestureHandlerRootView style={styles.fill}>
        <AnimatedBlurView
          tint="dark"
          animatedProps={blurProps}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, Spacing.md),
              maxHeight: screenH * maxHeightRatio,
            },
            sheetStyle,
          ]}>
          <GestureDetector gesture={pan}>
            <View style={styles.grabArea}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Brand.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderColor: Brand.border,
    ...Shadow.lg,
  },
  grabArea: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.border,
  },
});
