import MaskedView from '@react-native-masked-view/masked-view';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

const LOGO = require('@/assets/images/splashlogo.png');

const SPLASH_BG = Brand.bg;
const REVEAL_COLOR = Brand.primary;
const LOGO_SIZE = 220;
const TAGLINE_COLOR = Brand.textSecondary;

const PULSE_DURATION = 220;
const ZOOM_DURATION = 560;
const MAX_SCALE = 32;
const FADE_OUT_DURATION = 220;

type Props = {
  onDismissed: () => void;
};

export function SplashOverlay({ onDismissed }: Props) {
  const scale = useSharedValue(1);
  const introOpacity = useSharedValue(0);
  const tagOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    introOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    tagOpacity.value = withDelay(450, withTiming(1, { duration: 380 }));

    const startReveal = setTimeout(() => {
      tagOpacity.value = withTiming(0, { duration: 180 });
      scale.value = withSequence(
        withTiming(0.78, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.quad) }),
        withTiming(
          MAX_SCALE,
          { duration: ZOOM_DURATION, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) {
              overlayOpacity.value = withTiming(
                0,
                { duration: FADE_OUT_DURATION, easing: Easing.out(Easing.cubic) },
                (done) => {
                  if (done) runOnJS(onDismissed)();
                },
              );
            }
          },
        ),
      );
    }, 1100);

    return () => clearTimeout(startReveal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const maskScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: introOpacity.value,
  }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tagOpacity.value }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, containerStyle]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG }]} />

      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <View style={styles.maskContainer}>
            <Animated.Image
              source={LOGO}
              style={[{ width: LOGO_SIZE, height: LOGO_SIZE }, maskScaleStyle]}
              resizeMode="contain"
            />
          </View>
        }>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: REVEAL_COLOR }]} />
      </MaskedView>

      <View style={styles.taglineWrap}>
        <Animated.Text style={[styles.tagline, { color: TAGLINE_COLOR }, tagStyle]}>
          Smarter, safer payments
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  maskContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  taglineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '32%',
    alignItems: 'center',
  },
  tagline: {
    fontSize: 15,
    letterSpacing: 0.3,
    fontWeight: '500',
  },
});
