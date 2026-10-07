import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { Button, Ionicons, PressableScale, Spinner } from "@/src/components/ui";
import { font, radius, spacing, useTheme } from "@/src/theme";

const BG = "https://images.unsplash.com/photo-1541371301799-86ad7e6e44cd?w=1200&q=75&auto=format&fit=crop";

export function LoginScreen() {
  const { login, loginEmail, register, signingIn, error } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    setFormError(null);
    if (!email.includes("@")) return setFormError("Adresse email invalide");
    if (password.length < 8) return setFormError("Le mot de passe doit contenir au moins 8 caractères");
    if (mode === "signup" && !first.trim()) return setFormError("Indiquez votre prénom");
    setBusy(true);
    try {
      if (mode === "login") await loginEmail(email.trim(), password);
      else await register({ email: email.trim(), password, first_name: first.trim(), last_name: last.trim() });
    } catch (e: any) {
      setFormError(e?.message ?? "Connexion impossible");
    } finally {
      setBusy(false);
    }
  };

  const input = {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: spacing.lg,
    fontFamily: font.regular,
    fontSize: 15,
    color: "#FFFFFF",
  } as const;

  return (
    <View testID="login-screen" style={{ flex: 1, backgroundColor: colors.surface }}>
      <Image source={{ uri: BG }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={400} />
      <LinearGradient
        colors={["rgba(15,15,15,0.25)", "rgba(15,15,15,0.8)", "#0F0F0F"]}
        locations={[0, 0.4, 0.75]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
      >
        <Animated.View entering={FadeInDown.duration(600)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="pulse" size={20} color={colors.onBrandPrimary} />
          </View>
          <Text style={{ fontFamily: font.bold, fontSize: 20, color: "#FFFFFF", letterSpacing: -0.4 }}>CityPulse</Text>
        </Animated.View>

        <View style={{ flex: 1, minHeight: 80 }} />

        <Animated.View entering={FadeInUp.delay(150).duration(700)} style={{ gap: spacing.sm }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: colors.brandSecondary, letterSpacing: 1.5 }}>TOURS · VAL DE LOIRE</Text>
          <Text style={{ fontFamily: font.bold, fontSize: 36, lineHeight: 40, color: "#FFFFFF", letterSpacing: -1.1 }}>
            Votre ville,{"\n"}à votre budget.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).duration(700)} style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.1)" }}>
            {(["login", "signup"] as const).map((m) => (
              <PressableScale
                key={m}
                testID={`auth-mode-${m}`}
                onPress={() => { setMode(m); setFormError(null); }}
                style={{ flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: mode === m ? "#FFFFFF" : "transparent" }}
              >
                <Text style={{ fontFamily: font.semibold, fontSize: 14, color: mode === m ? "#0F0F0F" : "#FFFFFF" }}>
                  {m === "login" ? "Connexion" : "Inscription"}
                </Text>
              </PressableScale>
            ))}
          </View>
          {mode === "signup" ? (
            <Animated.View entering={FadeIn} style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput testID="auth-first-name-input" value={first} onChangeText={setFirst} placeholder="Prénom" placeholderTextColor="rgba(255,255,255,0.5)" style={[input, { flex: 1 }]} />
              <TextInput testID="auth-last-name-input" value={last} onChangeText={setLast} placeholder="Nom" placeholderTextColor="rgba(255,255,255,0.5)" style={[input, { flex: 1 }]} />
            </Animated.View>
          ) : null}
          <TextInput testID="auth-email-input" value={email} onChangeText={setEmail} placeholder="Adresse email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholderTextColor="rgba(255,255,255,0.5)" style={input} />
          <TextInput testID="auth-password-input" value={password} onChangeText={setPassword} placeholder="Mot de passe (8 caractères min.)" secureTextEntry placeholderTextColor="rgba(255,255,255,0.5)" style={input} onSubmitEditing={submit} />
          {formError || error ? (
            <Text testID="login-error" style={{ fontFamily: font.medium, fontSize: 13, color: colors.error }}>{formError ?? error}</Text>
          ) : null}
          <Button label={mode === "login" ? "Se connecter" : "Créer mon compte"} onPress={submit} loading={busy} testID="auth-submit-button" />

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xs }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>ou</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
          </View>

          <PressableScale
            testID="google-login-button"
            onPress={login}
            disabled={signingIn}
            style={{ height: 52, borderRadius: radius.pill, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md }}
          >
            {signingIn ? (
              <Spinner color="#0F0F0F" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#0F0F0F" />
                <Text style={{ fontFamily: font.semibold, fontSize: 15, color: "#0F0F0F" }}>Continuer avec Google</Text>
              </>
            )}
          </PressableScale>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}
