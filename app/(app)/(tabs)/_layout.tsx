import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedTabIcon,
  AnimatedTabLabel,
  ProfileTabIcon,
  WhatsAppTabButton,
} from '@/components/ui/animated-tab-icon';
import { Brand } from '@/constants/theme';

function TabBarBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.bg]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 90}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: Brand.textSecondary,
        tabBarShowLabel: true,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          // Normal docked bar — full width, square, flush to the bottom.
          height: 62 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(255,255,255,0.10)',
          elevation: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 0,
        },
        tabBarButton: (props) => <WhatsAppTabButton {...props} />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="home" color={color} focused={focused} size={26} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel label="Home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="swap-horizontal" color={color} focused={focused} size={28} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel label="Activity" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon name="shield-checkmark" color={color} focused={focused} size={26} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel label="Alerts" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <ProfileTabIcon color={color} focused={focused} size={28} />
          ),
          tabBarLabel: ({ color, focused }) => (
            <AnimatedTabLabel label="Profile" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bg: {
    overflow: 'hidden',
  },
  tint: {
    backgroundColor: 'rgba(17,24,39,0.65)',
  },
});
