import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { DatePickerSheet, formatBirthdate } from "@/src/components/date-picker";
import { Button, Ionicons, PressableScale, T } from "@/src/components/ui";
import type { User } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

// Shown right after login while the mandatory birthdate is missing.
export function ProfileCompletion() {
  const { user, updateUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [first, setFirst] = useState(user?.first_name ?? "");
  const [last, setLast] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [birth, setBirth] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!first.trim()) return setErr("Le prénom est obligatoire");
    if (!birth) return setErr("La date de naissance est obligatoire");
    setBusy(true);
    setErr(null);
    try {
      updateUser(await api<User>("/me/profile", { method: "PATCH", body: { first_name: first, last_name: last, phone, birthdate: birth } }));
    } catch (e: any) {
      setErr(e?.message ?? "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="profile-completion-screen">
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.xl }}>
        <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: spacing.sm }}>
          <View style={styles.badge}>
            <Ionicons name="person-add-outline" size={24} color={colors.onBrandTertiary} />
          </View>
          <T variant="display">Complétez votre profil</T>
          <T style={{ color: colors.muted }}>
            Votre âge permet à l&apos;IA d&apos;adapter vos sorties : bons plans jeunes, accès à la vie nocturne réservé aux majeurs, sorties au calme…
          </T>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).springify().damping(18)} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput testID="completion-first-name-input" value={first} onChangeText={setFirst} placeholder="Prénom *" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} />
            <TextInput testID="completion-last-name-input" value={last} onChangeText={setLast} placeholder="Nom" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} />
          </View>
          <PressableScale testID="completion-birthdate-button" onPress={() => setPicker(true)} style={[styles.input, styles.row]}>
            <Ionicons name="calendar-outline" size={18} color={colors.muted} />
            <Text style={[styles.value, !birth && { color: colors.muted }]}>{birth ? formatBirthdate(birth) : "Date de naissance *"}</Text>
          </PressableScale>
          <TextInput testID="completion-phone-input" value={phone} onChangeText={setPhone} placeholder="Téléphone (facultatif)" keyboardType="phone-pad" placeholderTextColor={colors.muted} style={styles.input} />
          {err ? <Text testID="completion-error" style={{ fontFamily: font.medium, fontSize: 13, color: colors.error }}>{err}</Text> : null}
          <Button label="Continuer" onPress={submit} loading={busy} testID="completion-submit-button" />
          <Button label="Se déconnecter" variant="ghost" onPress={logout} testID="completion-logout-button" />
        </Animated.View>
      </KeyboardAwareScrollView>
      <DatePickerSheet visible={picker} value={birth} onClose={() => setPicker(false)} onConfirm={(iso) => { setBirth(iso); setPicker(false); }} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    fontFamily: font.regular,
    fontSize: 15,
    color: c.onSurface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  value: { fontFamily: font.regular, fontSize: 15, color: c.onSurface },
}));
