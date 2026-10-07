import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { Ionicons, PressableScale } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/constants";
import { font, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" />
          <NativeTabs.Trigger.Label>René</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="discover">
          <NativeTabs.Trigger.Icon sf="safari.fill" />
          <NativeTabs.Trigger.Label>Découvrir</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="deals">
          <NativeTabs.Trigger.Icon sf="tag.fill" />
          <NativeTabs.Trigger.Label>Promos</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="planner">
          <NativeTabs.Trigger.Icon sf="sparkles" />
          <NativeTabs.Trigger.Label>Organiser</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="account">
          <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
          <NativeTabs.Trigger.Label>Compte</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  const icon = (on: string, off: string) => {
    const TabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
      <Ionicons name={(focused ? on : off) as any} size={22} color={color} />
    );
    return TabIcon;
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarHideOnKeyboard: true,
        tabBarButton: ({ children, onPress, onLongPress, accessibilityState, style, testID }: any) => (
          <PressableScale testID={testID} onPress={onPress} onLongPress={onLongPress} accessibilityRole="tab" accessibilityState={accessibilityState} style={style} scaleTo={0.92}>
            {children}
          </PressableScale>
        ),
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 10 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "René", tabBarButtonTestID: "tab-rene", tabBarIcon: icon("chatbubbles", "chatbubbles-outline") }} />
      <Tabs.Screen name="discover" options={{ title: "Découvrir", tabBarButtonTestID: "tab-discover", tabBarIcon: icon("compass", "compass-outline") }} />
      <Tabs.Screen name="deals" options={{ title: "Promos", tabBarButtonTestID: "tab-deals", tabBarIcon: icon("pricetags", "pricetags-outline") }} />
      <Tabs.Screen name="planner" options={{ title: "Organiser", tabBarButtonTestID: "tab-planner", tabBarIcon: icon("sparkles", "sparkles-outline") }} />
      <Tabs.Screen name="account" options={{ title: "Compte", tabBarButtonTestID: "tab-profile", tabBarIcon: icon("person-circle", "person-circle-outline") }} />
    </Tabs>
  );
}
