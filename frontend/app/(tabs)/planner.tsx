import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { ScrollView, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Sheet } from "@/src/components/sheet";
import { EconomicsCard, Timeline } from "@/src/components/timeline";
import { useToast } from "@/src/components/toast";
import { bounceProps, Button, Chip, Ionicons, PressableScale, T } from "@/src/components/ui";
import { MODE_ICON, MODE_LABEL } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import type { Plan, PlanParams, Step } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const INTERESTS = [
  { key: "gourmand", label: "Gourmand", icon: "restaurant-outline" },
  { key: "culture", label: "Culture", icon: "color-palette-outline" },
  { key: "fete", label: "Fête", icon: "musical-notes-outline" },
  { key: "sport", label: "Sport", icon: "football-outline" },
  { key: "detente", label: "Détente", icon: "leaf-outline" },
];
const WEATHERS = [
  { key: "sun", label: "Soleil", icon: "sunny-outline" },
  { key: "rain", label: "Pluie", icon: "rainy-outline" },
  { key: "cold", label: "Froid", icon: "snow-outline" },
];
const MODES = ["walk", "transit", "bike", "car"];

const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const toStr = (m: number) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

export default function Planner() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const minor = user?.age_group === "minor";

  const [budget, setBudget] = useState("60");
  const [group, setGroup] = useState<"solo" | "couple" | "groupe">("couple");
  const [groupSize, setGroupSize] = useState(4);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("19:00");
  const [weather, setWeather] = useState("sun");
  const [mode, setMode] = useState("walk");
  const [interests, setInterests] = useState<string[]>(["gourmand", "culture"]);
  const [student, setStudent] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [excludes, setExcludes] = useState<Record<string, string[]>>({});
  const [swapping, setSwapping] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (user?.preferences?.interests?.length) setInterests(user.preferences.interests.filter((k) => !(minor && k === "fete")));
    setStudent(user?.age_group === "young" || user?.age_group === "minor");
  }, [user, minor]);

  const wq = useQuery({ queryKey: ["weather"], queryFn: () => api<{ condition: string }>("/weather") });
  useEffect(() => {
    if (wq.data) setWeather(wq.data.condition);
  }, [wq.data]);

  const people = group === "solo" ? 1 : group === "couple" ? 2 : groupSize;
  const params = (): PlanParams => ({
    budget: Math.max(0, parseFloat(budget.replace(",", ".")) || 0),
    people,
    start,
    end,
    weather,
    mode,
    interests,
    student,
  });

  const gen = useMutation({
    mutationFn: (body: any) => api<Plan>("/planner/generate", { method: "POST", body }),
  });

  const generate = async () => {
    if (!params().budget) {
      toast("Indiquez un budget", "error");
      return;
    }
    setExcludes({});
    try {
      const p = await gen.mutateAsync({ ...params(), with_ai: true });
      setPlan(p);
    } catch {
      toast("Échec de la génération, réessayez", "error");
    }
  };

  const regenerate = async () => {
    if (!plan) return;
    setExcludes({});
    try {
      const p = await gen.mutateAsync({ ...plan.params, seed: undefined, with_ai: true });
      setPlan(p);
      toast("Nouvelle journée générée");
    } catch {
      toast("Échec de la génération", "error");
    }
  };

  const swap = async (s: Step) => {
    if (!plan || !s.place) return;
    const key = String(s.index);
    const ex = { ...excludes, [key]: [...(excludes[key] ?? []), s.place.id] };
    setSwapping(s.index);
    try {
      const p = await api<Plan>("/planner/generate", {
        method: "POST",
        body: { ...plan.params, pinned: plan.pinned.map((id, i) => (i === s.index ? null : id)), excludes: ex, with_ai: false },
      });
      setExcludes(ex);
      setPlan({ ...p, ai: plan.ai });
      const ns = p.steps[s.index];
      toast(ns && ns.place && ns.place.id !== s.place.id ? `Remplacé par ${ns.title}` : "Aucune autre option disponible", ns?.place ? "success" : "info");
    } catch {
      toast("Impossible de modifier l'étape", "error");
    } finally {
      setSwapping(null);
    }
  };

  const save = useMutation({
    mutationFn: () => api("/itineraries", { method: "POST", body: { name: name || plan?.ai?.title || "Ma journée", plan, ai: plan?.ai } }),
    onSuccess: () => {
      setSaveOpen(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["itineraries"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast("Itinéraire enregistré dans le carnet");
    },
    onError: () => toast("Enregistrement impossible", "error"),
  });

  const shift = (which: "start" | "end", d: number) => {
    if (which === "start") {
      const v = Math.min(toMin(start) + d, toMin(end) - 120);
      setStart(toStr(Math.max(6 * 60, v)));
    } else {
      const v = Math.max(toMin(end) + d, toMin(start) + 120);
      setEnd(toStr(Math.min(23 * 60 + 30, v)));
    }
  };

  if (gen.isPending && !swapping) return <Thinking />;

  if (plan) {
    return (
      <View style={styles.screen} testID="planner-result">
        <View style={[styles.resultHeader, { paddingTop: insets.top + spacing.sm }]}>
          <PressableScale testID="planner-back-to-form" onPress={() => setPlan(null)} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="options-outline" size={18} color={colors.onSurface} />
            <Text style={styles.backText}>Modifier</Text>
          </PressableScale>
          <Text style={styles.resultMeta}>
            {plan.params.start}–{plan.params.end} · {plan.params.people} pers.
          </Text>
        </View>
        <ScrollView {...bounceProps} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: bottomChrome + 100 }}>
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: spacing.sm }}>
            <View style={styles.aiTag}>
              <Ionicons name="sparkles" size={13} color={colors.onBrandTertiary} />
              <Text style={styles.aiTagText}>Généré par l&apos;IA CityPulse</Text>
            </View>
            <T variant="title" testID="planner-ai-title">{plan.ai?.title ?? "Votre journée"}</T>
            {plan.ai?.summary ? <T style={{ color: colors.muted }}>{plan.ai.summary}</T> : null}
          </Animated.View>
          <EconomicsCard plan={plan} />
          <Timeline plan={plan} onSwap={swap} swapping={swapping} />
          {plan.ai?.tips?.length ? (
            <View style={styles.tips} testID="planner-ai-tips">
              <Text style={styles.tipsTitle}>Conseils du local</Text>
              {plan.ai.tips.map((t, i) => (
                <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Ionicons name="bulb-outline" size={16} color={colors.brandSecondary} />
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.actionBar, { bottom: bottomChrome + 16 }]}>
          <Button label="Régénérer" icon="refresh" variant="secondary" onPress={regenerate} testID="planner-regenerate-button" style={{ flex: 1 }} />
          <Button label="Enregistrer" icon="bookmark-outline" onPress={() => setSaveOpen(true)} testID="planner-save-button" style={{ flex: 1 }} />
        </View>
        <Sheet visible={saveOpen} onClose={() => setSaveOpen(false)} testID="save-itinerary-sheet">
          <View style={{ gap: spacing.lg }}>
            <T variant="h2">Enregistrer dans le carnet</T>
            <TextInput
              testID="save-itinerary-name-input"
              value={name}
              onChangeText={setName}
              placeholder={plan.ai?.title ?? "Ma journée à Tours"}
              placeholderTextColor={colors.muted}
              style={styles.field}
            />
            <Button label="Enregistrer" onPress={() => save.mutate()} loading={save.isPending} testID="save-itinerary-confirm" />
          </View>
        </Sheet>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="planner-form">
      <View style={[styles.formHeader, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.sub}>Organisateur IA</Text>
        <Text style={styles.title}>Ma journée parfaite</Text>
      </View>
      <KeyboardAwareScrollView {...bounceProps} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" bottomOffset={96} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: bottomChrome + 120 }}>
        {minor ? (
          <View style={styles.minor} testID="planner-minor-banner">
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.onBrandTertiary} />
            <Text style={styles.minorText}>Mode -18 ans : bars, boîtes de nuit et offres d&apos;alcool sont exclus de vos journées.</Text>
          </View>
        ) : null}
        <Section label="Budget max total">
          <View style={styles.budgetRow}>
            <TextInput
              testID="planner-budget-input"
              value={budget}
              onChangeText={(t) => setBudget(t.replace(/[^0-9.,]/g, ""))}
              keyboardType="decimal-pad"
              style={styles.budgetInput}
              placeholder="60"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.euro}>€</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[20, 40, 60, 100, 150].map((b) => (
              <Chip key={b} testID={`planner-budget-${b}`} label={`${b} €`} selected={budget === String(b)} onPress={() => setBudget(String(b))} />
            ))}
          </ScrollView>
        </Section>

        <Section label="Participants">
          <Segmented
            options={[
              { key: "solo", label: "Solo", icon: "person-outline" },
              { key: "couple", label: "Couple", icon: "people-outline" },
              { key: "groupe", label: "Groupe", icon: "people-circle-outline" },
            ]}
            value={group}
            onChange={(v) => setGroup(v as any)}
            testPrefix="planner-group"
          />
          {group === "groupe" ? (
            <Animated.View entering={FadeIn} style={styles.stepper}>
              <Text style={styles.stepperLabel}>Nombre de personnes</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <RoundBtn icon="remove" onPress={() => setGroupSize((n) => Math.max(3, n - 1))} testID="planner-group-minus" />
                <Text style={styles.stepperVal} testID="planner-group-size">{groupSize}</Text>
                <RoundBtn icon="add" onPress={() => setGroupSize((n) => Math.min(20, n + 1))} testID="planner-group-plus" />
              </View>
            </Animated.View>
          ) : null}
        </Section>

        <Section label="Plage horaire">
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            {(["start", "end"] as const).map((w) => (
              <View key={w} style={styles.timeBox}>
                <Text style={styles.timeLabel}>{w === "start" ? "Début" : "Fin"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <RoundBtn icon="remove" small onPress={() => shift(w, -30)} testID={`planner-${w}-minus`} />
                  <Text style={styles.timeVal} testID={`planner-${w}-value`}>{w === "start" ? start : end}</Text>
                  <RoundBtn icon="add" small onPress={() => shift(w, 30)} testID={`planner-${w}-plus`} />
                </View>
              </View>
            ))}
          </View>
        </Section>

        <Section label="Météo prévue">
          <Segmented options={WEATHERS} value={weather} onChange={setWeather} testPrefix="planner-weather" />
        </Section>

        <Section label="Déplacement">
          <Segmented
            options={MODES.map((m) => ({ key: m, label: MODE_LABEL[m], icon: MODE_ICON[m] }))}
            value={mode}
            onChange={setMode}
            testPrefix="planner-mode"
          />
        </Section>

        <Section label="Centres d'intérêt">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {INTERESTS.filter((i) => !(minor && i.key === "fete")).map((i) => (
              <Chip
                key={i.key}
                testID={`planner-interest-${i.key}`}
                label={i.label}
                icon={i.icon}
                selected={interests.includes(i.key)}
                onPress={() => setInterests((x) => (x.includes(i.key) ? x.filter((k) => k !== i.key) : [...x, i.key]))}
              />
            ))}
          </ScrollView>
        </Section>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Je suis étudiant·e</Text>
            <Text style={styles.switchSub}>Active les réductions étudiantes</Text>
          </View>
          <Switch
            testID="planner-student-switch"
            value={student}
            onValueChange={setStudent}
            trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
            thumbColor={colors.onBrandPrimary}
          />
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView offset={{ opened: bottomChrome }} style={[styles.sticky, { bottom: bottomChrome + 16 }]}>
        <Button label="Générer ma journée" icon="sparkles" onPress={generate} testID="planner-generate-button" />
      </KeyboardStickyView>
    </View>
  );
}

function Thinking() {
  const { colors } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [p]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + p.value * 0.3 }, { rotate: `${p.value * 90}deg` }], opacity: 0.6 + p.value * 0.4 }));
  return (
    <View testID="planner-loading" style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.xl }}>
      <Animated.View style={[{ width: 120, height: 120, borderRadius: 40, overflow: "hidden" }, a]}>
        <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary, colors.brandTertiary]} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      </Animated.View>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <T variant="h2">L&apos;IA compose votre journée…</T>
        <T variant="caption" style={{ fontSize: 14 }}>Horaires, trajets, budget et bons plans</T>
      </View>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Segmented({
  options,
  value,
  onChange,
  testPrefix,
}: {
  options: { key: string; label: string; icon?: string }[];
  value: string;
  onChange: (k: string) => void;
  testPrefix: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <PressableScale key={o.key} testID={`${testPrefix}-${o.key}`} onPress={() => onChange(o.key)} style={[styles.segBtn, on && { backgroundColor: colors.surfaceInverse }]}>
            {o.icon ? <Ionicons name={o.icon as any} size={17} color={on ? colors.onSurfaceInverse : colors.onSurfaceTertiary} /> : null}
            <Text numberOfLines={1} style={[styles.segText, { color: on ? colors.onSurfaceInverse : colors.onSurfaceTertiary }]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function RoundBtn({ icon, onPress, testID, small }: { icon: string; onPress: () => void; testID: string; small?: boolean }) {
  const { colors } = useTheme();
  const s = small ? 36 : 44;
  return (
    <PressableScale testID={testID} onPress={onPress} hitSlop={6} style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon as any} size={18} color={colors.onSurface} />
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  formHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  sub: { fontFamily: font.regular, fontSize: 14, color: c.muted },
  title: { fontFamily: font.bold, fontSize: 28, letterSpacing: -0.8, color: c.onSurface },
  label: { fontFamily: font.semibold, fontSize: 13, color: c.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  budgetRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs },
  budgetInput: { fontFamily: font.bold, fontSize: 48, letterSpacing: -1.5, color: c.onSurface, minWidth: 80, padding: 0 },
  euro: { fontFamily: font.semibold, fontSize: 28, color: c.muted },
  chips: { gap: spacing.sm, alignItems: "center" },
  seg: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md + 4, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  segBtn: { flex: 1, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: 2 },
  segText: { fontFamily: font.medium, fontSize: 12 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    paddingLeft: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  stepperLabel: { fontFamily: font.medium, fontSize: 14, color: c.onSurface },
  stepperVal: { fontFamily: font.bold, fontSize: 20, color: c.onSurface, minWidth: 28, textAlign: "center" },
  timeBox: { flex: 1, padding: spacing.md, gap: spacing.sm, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  timeLabel: { fontFamily: font.regular, fontSize: 12, color: c.muted },
  timeVal: { fontFamily: font.bold, fontSize: 20, color: c.onSurface },
  switchRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  switchTitle: { fontFamily: font.semibold, fontSize: 15, color: c.onSurface },
  switchSub: { fontFamily: font.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  sticky: { position: "absolute", left: spacing.lg, right: spacing.lg },
  field: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
    paddingHorizontal: spacing.lg,
    fontFamily: font.regular,
    fontSize: 15,
    color: c.onSurface,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  backText: { fontFamily: font.medium, fontSize: 14, color: c.onSurface },
  resultMeta: { fontFamily: font.medium, fontSize: 13, color: c.muted },
  aiTag: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 26, borderRadius: radius.pill, backgroundColor: c.brandTertiary },
  aiTagText: { fontFamily: font.semibold, fontSize: 12, color: c.onBrandTertiary },
  tips: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  tipsTitle: { fontFamily: font.semibold, fontSize: 16, color: c.onSurface },
  tipText: { flex: 1, fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: c.onSurfaceTertiary },
  minor: { flexDirection: "row", gap: spacing.sm, alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: c.brandTertiary },
  minorText: { flex: 1, fontFamily: font.medium, fontSize: 13, color: c.onBrandTertiary },
  actionBar: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", gap: spacing.md },
}));
