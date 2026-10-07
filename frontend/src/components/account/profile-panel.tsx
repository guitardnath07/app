import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { LinkRow } from "@/src/components/account/finance-panel";
import { DatePickerSheet, formatBirthdate } from "@/src/components/date-picker";
import { Sheet } from "@/src/components/sheet";
import { useToast } from "@/src/components/toast";
import { Button, Chip, Ionicons, PressableScale, T } from "@/src/components/ui";
import type { User } from "@/src/types";
import { font, makeStyles, radius, setColorScheme, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const INTERESTS = [
  { key: "gourmand", label: "Gourmand" },
  { key: "culture", label: "Culture" },
  { key: "fete", label: "Fête" },
  { key: "sport", label: "Sport" },
  { key: "detente", label: "Détente" },
];
const MUSIC = ["Électro", "Rock", "Pop", "Jazz", "Hip-hop", "Classique", "Variété"];
const DIET = ["Aucun", "Végétarien", "Vegan", "Sans gluten", "Halal", "Casher"];

export const AGE_GROUP_LABEL: Record<string, string> = {
  minor: "Moins de 18 ans · vie nocturne masquée",
  young: "Étudiant / jeune actif",
  adult: "Adulte",
  senior: "Senior · sorties au calme",
  unknown: "",
};

export function ProfilePanel() {
  const { user, updateUser, logout, deleteAccount } = useAuth();
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const u = user as User;

  const [first, setFirst] = useState(u.first_name);
  const [last, setLast] = useState(u.last_name);
  const [phone, setPhone] = useState(u.phone);
  const [birth, setBirth] = useState(u.birthdate);
  const [prefs, setPrefs] = useState(u.preferences);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setFirst(u.first_name);
    setLast(u.last_name);
    setPhone(u.phone);
    setBirth(u.birthdate);
    setPrefs(u.preferences);
  }, [u]);

  const dirty = useMemo(
    () =>
      first !== u.first_name ||
      last !== u.last_name ||
      phone !== u.phone ||
      birth !== u.birthdate ||
      JSON.stringify(prefs) !== JSON.stringify(u.preferences),
    [first, last, phone, birth, prefs, u],
  );

  const toggle = (k: "interests" | "music" | "diet", v: string) =>
    setPrefs((p) => {
      const cur = p[k] ?? [];
      if (k === "diet" && v === "Aucun") return { ...p, diet: cur.includes("Aucun") ? [] : ["Aucun"] };
      const base = k === "diet" ? cur.filter((x) => x !== "Aucun") : cur;
      return { ...p, [k]: base.includes(v) ? base.filter((x) => x !== v) : [...base, v] };
    });

  const save = async () => {
    if (!first.trim()) return toast("Le prénom est obligatoire", "error");
    if (!birth) return toast("La date de naissance est obligatoire", "error");
    setSaving(true);
    try {
      const nu = await api<User>("/me/profile", { method: "PATCH", body: { first_name: first, last_name: last, phone, birthdate: birth, preferences: prefs } });
      updateUser(nu);
      qc.invalidateQueries();
      toast("Profil mis à jour");
    } catch (e: any) {
      toast(e?.message ?? "Enregistrement impossible", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleTheme = (dark: boolean) => {
    setColorScheme(dark ? "dark" : "light");
    storage.setItem("cp_theme", dark ? "dark" : "light");
  };

  return (
    <View style={{ gap: spacing.xl }} testID="profile-panel">
      <Group title="Informations personnelles">
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Field label="Prénom" style={{ flex: 1 }}>
            <TextInput testID="profile-first-name-input" value={first} onChangeText={setFirst} style={styles.input} placeholderTextColor={colors.muted} />
          </Field>
          <Field label="Nom" style={{ flex: 1 }}>
            <TextInput testID="profile-last-name-input" value={last} onChangeText={setLast} style={styles.input} placeholderTextColor={colors.muted} />
          </Field>
        </View>
        <Field label="Adresse e-mail">
          <View style={[styles.input, styles.inputRow, { opacity: 0.7 }]}>
            <Text style={styles.value} numberOfLines={1} testID="profile-email">{u.email}</Text>
            <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
          </View>
        </Field>
        <Field label="Téléphone">
          <TextInput testID="profile-phone-input" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="06 00 00 00 00" placeholderTextColor={colors.muted} style={styles.input} />
        </Field>
        <Field label="Date de naissance *">
          <PressableScale testID="profile-birthdate-button" onPress={() => setPicker(true)} style={[styles.input, styles.inputRow]}>
            <Text style={styles.value}>{formatBirthdate(birth)}</Text>
            <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          </PressableScale>
          {u.age !== null ? (
            <Text style={styles.hint} testID="profile-age">
              {u.age} ans · {AGE_GROUP_LABEL[u.age_group]}
            </Text>
          ) : null}
        </Field>
      </Group>

      <Group title="Préférences de sorties">
        <PrefRow label="Centres d'intérêt">
          {INTERESTS.filter((i) => !(i.key === "fete" && u.age_group === "minor")).map((i) => (
            <Chip key={i.key} testID={`pref-interest-${i.key}`} label={i.label} selected={prefs.interests.includes(i.key)} onPress={() => toggle("interests", i.key)} />
          ))}
        </PrefRow>
        <PrefRow label="Musique">
          {MUSIC.map((m) => (
            <Chip key={m} testID={`pref-music-${m}`} label={m} selected={prefs.music.includes(m)} onPress={() => toggle("music", m)} />
          ))}
        </PrefRow>
        <PrefRow label="Régime alimentaire">
          {DIET.map((d) => (
            <Chip key={d} testID={`pref-diet-${d}`} label={d} selected={prefs.diet.includes(d)} onPress={() => toggle("diet", d)} />
          ))}
        </PrefRow>
      </Group>

      {dirty ? <Button label="Enregistrer les modifications" icon="checkmark" onPress={save} loading={saving} testID="profile-save-button" /> : null}

      <Group title="Sécurité & paramètres">
        <View style={styles.list}>
          <LinkRow icon="key-outline" label={u.has_password ? "Modifier le mot de passe" : "Définir un mot de passe"} onPress={() => setPwOpen(true)} testID="profile-password-row" />
          <View style={styles.sep} />
          <View style={styles.row}>
            <Ionicons name="moon-outline" size={20} color={colors.onSurface} />
            <Text style={styles.rowLabel}>Mode sombre</Text>
            <Switch testID="profile-theme-switch" value={scheme === "dark"} onValueChange={toggleTheme} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.onBrandPrimary} />
          </View>
        </View>
        <PressableScale testID="profile-logout-button" onPress={logout} style={styles.outline}>
          <Ionicons name="log-out-outline" size={18} color={colors.onSurface} />
          <Text style={styles.outlineText}>Se déconnecter</Text>
        </PressableScale>
        <PressableScale testID="profile-delete-account-button" onPress={() => setDelOpen(true)} style={[styles.outline, { borderColor: colors.error }]}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={[styles.outlineText, { color: colors.error }]}>Supprimer mon compte</Text>
        </PressableScale>
      </Group>

      <DatePickerSheet visible={picker} value={birth} onClose={() => setPicker(false)} onConfirm={(iso) => { setBirth(iso); setPicker(false); }} />
      <PasswordSheet visible={pwOpen} hasPassword={u.has_password} onClose={() => setPwOpen(false)} onDone={() => { setPwOpen(false); updateUser({ ...u, has_password: true }); toast("Mot de passe mis à jour"); }} />
      <Sheet visible={delOpen} onClose={() => setDelOpen(false)} testID="delete-account-sheet">
        <View style={{ gap: spacing.lg }}>
          <T variant="h2">Supprimer votre compte ?</T>
          <T style={{ color: colors.muted }}>Vos itinéraires, favoris, QR codes et données personnelles seront définitivement effacés.</T>
          <PressableScale
            testID="delete-account-confirm"
            onPress={async () => {
              setDeleting(true);
              try {
                await deleteAccount();
              } catch {
                toast("Suppression impossible", "error");
                setDeleting(false);
              }
            }}
            style={[styles.outline, { backgroundColor: colors.error, borderColor: colors.error }]}
          >
            <Text style={[styles.outlineText, { color: colors.onError }]}>{deleting ? "Suppression…" : "Supprimer définitivement"}</Text>
          </PressableScale>
          <Button label="Annuler" variant="secondary" onPress={() => setDelOpen(false)} testID="delete-account-cancel" />
        </View>
      </Sheet>
    </View>
  );
}

function PasswordSheet({ visible, hasPassword, onClose, onDone }: { visible: boolean; hasPassword: boolean; onClose: () => void; onDone: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCur("");
      setNext("");
      setConf("");
      setErr(null);
    }
  }, [visible]);

  const submit = async () => {
    if (hasPassword && !cur) return setErr("Saisissez votre mot de passe actuel");
    if (next.length < 8) return setErr("Le nouveau mot de passe doit contenir au moins 8 caractères");
    if (next !== conf) return setErr("La confirmation ne correspond pas");
    setBusy(true);
    setErr(null);
    try {
      await api("/auth/change-password", { method: "POST", body: { current_password: hasPassword ? cur : null, new_password: next } });
      onDone();
    } catch (e: any) {
      setErr(e?.message ?? "Modification impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="password-sheet">
      <View style={{ gap: spacing.md }}>
        <T variant="h2">{hasPassword ? "Modifier le mot de passe" : "Définir un mot de passe"}</T>
        {!hasPassword ? <T style={{ color: colors.muted }}>Vous pourrez ensuite vous connecter aussi avec votre email.</T> : null}
        {hasPassword ? (
          <TextInput testID="password-current-input" value={cur} onChangeText={setCur} secureTextEntry placeholder="Ancien mot de passe" placeholderTextColor={colors.muted} style={styles.input} />
        ) : null}
        <TextInput testID="password-new-input" value={next} onChangeText={setNext} secureTextEntry placeholder="Nouveau mot de passe" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput testID="password-confirm-input" value={conf} onChangeText={setConf} secureTextEntry placeholder="Confirmation" placeholderTextColor={colors.muted} style={styles.input} />
        {err ? <Text testID="password-error" style={{ fontFamily: font.medium, fontSize: 13, color: colors.error }}>{err}</Text> : null}
        <Button label="Valider" onPress={submit} loading={busy} testID="password-submit-button" />
      </View>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  const styles = useStyles();
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PrefRow({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, alignItems: "center" }} style={{ flexGrow: 0, height: 40 }}>
        {children}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  groupTitle: { fontFamily: font.semibold, fontSize: 13, color: c.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  fieldLabel: { fontFamily: font.medium, fontSize: 12, color: c.muted },
  input: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    fontFamily: font.regular,
    fontSize: 15,
    color: c.onSurface,
  },
  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  value: { flex: 1, fontFamily: font.regular, fontSize: 15, color: c.onSurface },
  hint: { fontFamily: font.medium, fontSize: 12, color: c.brandPrimary },
  list: { borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg },
  rowLabel: { flex: 1, fontFamily: font.medium, fontSize: 15, color: c.onSurface },
  sep: { height: 1, backgroundColor: c.divider, marginLeft: 52 },
  outline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
  outlineText: { fontFamily: font.semibold, fontSize: 15, color: c.onSurface },
}));
