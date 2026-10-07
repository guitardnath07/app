import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Ionicons, PressableScale, Spinner } from "@/src/components/ui";
import { font, radius, spacing, useTheme } from "@/src/theme";

const BG =
  "https://images.unsplash.com/photo-1541371301799-86ad7e6e44cd?w=1200&q=75&auto=format&fit=crop";

export function LoginScreen() {
  const { login, signingIn, error } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View testID="login-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Image source={{ uri: BG }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={400} />
      <LinearGradient
        colors={["rgba(15,15,15,0.2)", "rgba(15,15,15,0.7)", colors.surface]}
        locations={[0, 0.55, 0.9]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ flex: 1, paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <Animated.View entering={FadeInDown.duration(600)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="pulse" size={20} color={colors.onBrandPrimary} />
          </View>
          <Text style={{ fontFamily: font.bold, fontSize: 20, color: "#FFFFFF", letterSpacing: -0.4 }}>CityPulse</Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View entering={FadeInUp.delay(150).duration(700)} style={{ gap: spacing.md }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.brandSecondary, letterSpacing: 1.5 }}>
            TOURS · VAL DE LOIRE
          </Text>
          <Text style={{ fontFamily: font.bold, fontSize: 40, lineHeight: 44, color: "#FFFFFF", letterSpacing: -1.2 }}>
            Votre ville,{"\n"}à votre budget.
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 16, lineHeight: 23, color: "rgba(255,255,255,0.75)" }}>
            Découvrez les meilleurs lieux, profitez des bons plans et laissez l&apos;IA organiser votre journée.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(700)} style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <PressableScale
            testID="google-login-button"
            onPress={login}
            disabled={signingIn}
            style={{
              height: 56,
              borderRadius: radius.pill,
              backgroundColor: "#FFFFFF",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.md,
            }}
          >
            {signingIn ? (
              <Spinner color="#0F0F0F" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#0F0F0F" />
                <Text style={{ fontFamily: font.semibold, fontSize: 16, color: "#0F0F0F" }}>Continuer avec Google</Text>
              </>
            )}
          </PressableScale>
          {error ? (
            <Text testID="login-error" style={{ fontFamily: font.medium, fontSize: 13, color: colors.error, textAlign: "center" }}>
              {error}
            </Text>
          ) : null}
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
            En continuant, vous acceptez nos conditions d&apos;utilisation.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
