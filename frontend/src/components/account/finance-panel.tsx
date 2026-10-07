import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { api } from "@/src/api";
import { Button, EmptyState, Ionicons, PressableScale, Skeleton } from "@/src/components/ui";
import { CATEGORY_ICON, euro } from "@/src/constants";
import type { Finance } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Ring({ pct }: { pct: number }) {
  const { colors } = useTheme();
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.min(100, pct) / 100, { duration: 900 });
  }, [pct, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={colors.success} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={props} />
      </Svg>
      <Text testID="finance-savings-ratio" style={{ fontFamily: font.bold, fontSize: 20, color: colors.onSurface }}>
        {Math.round(pct)}%
      </Text>
    </View>
  );
}

function Bar({ ratio, color, delay }: { ratio: number; color: string; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withSpring(Math.max(0.03, ratio), { damping: 16 }));
  }, [ratio, delay, h]);
  const a = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));
  return (
    <View style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}>
      <Animated.View style={[{ width: "100%", borderRadius: 4, backgroundColor: color }, a]} />
    </View>
  );
}

export function FinancePanel() {
  const styles = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["finance"], queryFn: () => api<Finance>("/me/finance") });
  const f = q.data;

  if (q.isLoading) {
    return (
      <View style={{ gap: spacing.md }}>
        <Skeleton style={{ height: 160 }} />
        <Skeleton style={{ height: 200 }} />
      </View>
    );
  }
  if (q.isError || !f) {
    return <EmptyState icon="cloud-offline-outline" title="Bilan indisponible" testID="finance-error" action={<Button label="Réessayer" variant="secondary" onPress={() => q.refetch()} testID="finance-retry" />} />;
  }
  const max = Math.max(1, ...f.monthly.map((m) => Math.max(m.spent, m.saved)));

  return (
    <View style={{ gap: spacing.lg }} testID="finance-panel">
      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Total économisé</Text>
            <Text style={styles.big} testID="profile-total-saved">{euro(f.total_saved)}</Text>
            <Text style={[styles.label, { marginTop: spacing.md }]}>Total dépensé via l&apos;app</Text>
            <Text style={styles.mid} testID="finance-total-spent">{euro(f.total_spent)}</Text>
          </View>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Ring pct={f.savings_ratio} />
            <Text style={styles.small}>d&apos;économie</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.statsRow}>
        <Stat icon="map-outline" value={f.itineraries_count} label="Journées" testID="stat-itineraries" />
        <Stat icon="qr-code-outline" value={f.claims_count} label="QR promos" testID="stat-claims" />
        <Stat icon="heart-outline" value={f.favorites_count} label="Favoris" testID="stat-favorites" />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).springify().damping(18)} style={styles.card} testID="profile-monthly-chart">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>Dépenses vs économies</Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Legend color={colors.brandPrimary} label="Dépensé" />
            <Legend color={colors.success} label="Économisé" />
          </View>
        </View>
        <View style={{ flexDirection: "row", height: 120, marginTop: spacing.lg, gap: spacing.sm }}>
          {f.monthly.map((m, i) => (
            <View key={m.key} style={{ flex: 1, flexDirection: "row", gap: 3, alignItems: "flex-end" }}>
              <Bar ratio={m.spent / max} color={colors.brandPrimary} delay={i * 60} />
              <Bar ratio={m.saved / max} color={colors.success} delay={i * 60 + 30} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          {f.monthly.map((m) => (
            <Text key={m.key} style={[styles.small, { flex: 1, textAlign: "center" }]}>{m.label}</Text>
          ))}
        </View>
      </Animated.View>

      <View style={{ gap: spacing.md }}>
        <Text style={styles.title}>Historique des activités</Text>
        {f.transactions.length === 0 ? (
          <EmptyState icon="receipt-outline" title="Aucune activité" text="Enregistrez une journée depuis l'Organisateur pour suivre vos dépenses." testID="finance-history-empty"
            action={<Button label="Organiser une journée" onPress={() => router.push("/planner")} testID="finance-go-planner" />} />
        ) : (
          <View style={styles.list} testID="finance-history">
            {f.transactions.map((t, i) => (
              <PressableScale key={t.id} testID={`finance-tx-${t.id}`} onPress={() => router.push(`/itinerary/${t.itinerary_id}`)} style={[styles.tx, i > 0 && styles.sep]}>
                <View style={styles.txIcon}>
                  <Ionicons name={(t.category === "transport" ? "bus-outline" : CATEGORY_ICON[t.category ?? ""] ?? "pricetag-outline") as any} size={16} color={colors.onSurface} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.txLabel} numberOfLines={1}>{t.label}</Text>
                  <Text style={styles.small} numberOfLines={1}>
                    {new Date(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {t.deal ?? t.itinerary_name}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={styles.txLabel}>{euro(t.final)}</Text>
                  {t.saved > 0 ? (
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Text style={[styles.small, { textDecorationLine: "line-through" }]}>{euro(t.full)}</Text>
                      <Text style={[styles.small, { color: colors.success, fontFamily: font.semibold }]}>-{euro(t.saved)}</Text>
                    </View>
                  ) : null}
                </View>
              </PressableScale>
            ))}
          </View>
        )}
      </View>

      <View style={styles.list}>
        <LinkRow icon="book-outline" label="Carnet de voyage" onPress={() => router.push("/journal")} testID="profile-journal-row" />
        <View style={[styles.sep, { marginLeft: 52 }]} />
        <LinkRow icon="heart-outline" label="Mes favoris" onPress={() => router.push("/favorites")} testID="profile-favorites-row" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

function Stat({ icon, value, label, testID }: { icon: string; value: number; label: string; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stat} testID={testID}>
      <Ionicons name={icon as any} size={18} color={colors.brandPrimary} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

export function LinkRow({ icon, label, onPress, testID, color }: { icon: string; label: string; onPress: () => void; testID: string; color?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} style={styles.row}>
      <Ionicons name={icon as any} size={20} color={color ?? colors.onSurface} />
      <Text style={[styles.rowLabel, color ? { color } : null]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  card: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  label: { fontFamily: font.medium, fontSize: 13, color: c.muted },
  big: { fontFamily: font.bold, fontSize: 36, letterSpacing: -1.2, color: c.brandPrimary },
  mid: { fontFamily: font.bold, fontSize: 22, letterSpacing: -0.5, color: c.onSurface },
  small: { fontFamily: font.regular, fontSize: 11, color: c.muted },
  title: { fontFamily: font.semibold, fontSize: 16, color: c.onSurface },
  statsRow: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, padding: spacing.md, gap: 4, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  statVal: { fontFamily: font.bold, fontSize: 22, color: c.onSurface },
  list: { borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  tx: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  sep: { borderTopWidth: 1, borderTopColor: c.divider },
  txIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  txLabel: { fontFamily: font.semibold, fontSize: 14, color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg },
  rowLabel: { flex: 1, fontFamily: font.medium, fontSize: 15, color: c.onSurface },
}));
