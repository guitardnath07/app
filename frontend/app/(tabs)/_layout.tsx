import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";
import { Platform } from "react-native";

import { Ionicons } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/constants";
import { font, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="safari.fill" />
          <NativeTabs.Trigger.Label>Découvrir</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="deals">
          <NativeTabs.Trigger.Icon sf="tag.fill" />
          <NativeTabs.Trigger.Label>Bons plans</NativeTabs.Trigger.Label>
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
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Découvrir", tabBarButtonTestID: "tab-discover", tabBarIcon: icon("compass", "compass-outline") }} />
      <Tabs.Screen name="deals" options={{ title: "Bons plans", tabBarButtonTestID: "tab-deals", tabBarIcon: icon("pricetags", "pricetags-outline") }} />
      <Tabs.Screen name="planner" options={{ title: "Organiser", tabBarButtonTestID: "tab-planner", tabBarIcon: icon("sparkles", "sparkles-outline") }} />
      <Tabs.Screen name="account" options={{ title: "Compte", tabBarButtonTestID: "tab-profile", tabBarIcon: icon("person-circle", "person-circle-outline") }} />
    </Tabs>
  );
}
