import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Brand, Radius, Spacing } from '@/constants/theme';

type Accent = 'cyan' | 'ai' | 'secondary';

type Slide = {
  key: string;
  title: string;
  body: string;
  accent: Accent;
  icon: keyof typeof Ionicons.glyphMap;
};

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    title: 'Welcome to SafePay',
    body: 'Send, receive, and manage money with confidence — built with safety at the core.',
    accent: 'cyan',
    icon: 'wallet',
  },
  {
    key: 'ai',
    title: 'AI watches your back',
    body: 'Our on-device AI flags suspicious transactions before they cost you, in real time.',
    accent: 'ai',
    icon: 'shield-checkmark',
  },
  {
    key: 'control',
    title: 'You stay in control',
    body: 'Approve, freeze, or reverse a payment in one tap. Your money, your rules.',
    accent: 'secondary',
    icon: 'finger-print',
  },
];

const ACCENT_TINTS: Record<Accent, { ring: string; bg: string; icon: string }> = {
  cyan: { ring: 'rgba(6,182,212,0.10)', bg: Brand.primarySoft, icon: Brand.primary },
  ai: { ring: 'rgba(139,92,246,0.10)', bg: Brand.aiSoft, icon: Brand.ai },
  secondary: { ring: 'rgba(37,99,235,0.10)', bg: Brand.secondarySoft, icon: Brand.secondary },
};

export default function OnboardingCarousel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index) setIndex(next);
    },
    [index, width],
  );

  const goNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [index, router, width]);

  const skip = useCallback(() => {
    router.replace('/(auth)/welcome');
  }, [router]);

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        {!isLast && (
          <Pressable onPress={skip} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}>
        {SLIDES.map((slide) => {
          const tint = ACCENT_TINTS[slide.accent];
          return (
            <View key={slide.key} style={[styles.slide, { width }]}>
              <View style={[styles.illustrationRing, { backgroundColor: tint.ring }]}>
                <View style={[styles.illustrationCircle, { backgroundColor: tint.bg }]}>
                  <Ionicons name={slide.icon} size={104} color={tint.icon} />
                </View>
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => {
            const active = i === index;
            return (
              <View
                key={s.key}
                style={[
                  styles.dot,
                  {
                    width: active ? 22 : 8,
                    backgroundColor: active ? Brand.primary : Brand.border,
                  },
                ]}
              />
            );
          })}
        </View>

        <Button label={isLast ? 'Get started' : 'Next'} onPress={goNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 32,
  },
  skip: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationRing: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  illustrationCircle: {
    width: 184,
    height: 184,
    borderRadius: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
    color: Brand.text,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
    color: Brand.textSecondary,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 12,
  },
  dot: {
    height: 8,
    borderRadius: Radius.pill,
  },
});
