import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Ionicons, PressableScale, Spinner } from "@/src/components/ui";
import { CATEGORY_LABEL, MODE_ICON, MODE_LABEL, euro } from "@/src/constants";
import type { Plan, Step } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function Timeline({
  plan,
  onSwap,
  swapping,
}: {
  plan: Plan;
  onSwap?: (step: Step) => void;
  swapping?: number | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View testID="itinerary-timeline">
      {plan.steps.map((s, i) => (
        <Animated.View key={`${s.index}-${s.title}`} entering={FadeInDown.delay(i * 80).springify().damping(18)}>
          {s.travel_before && s.travel_before.duration_min > 0 ? (
            <View style={styles.travelRow} testID={`timeline-travel-${s.index}`}>
              <View style={styles.timeCol} />
              <View style={styles.lineCol}>
                <View style={[styles.line, styles.dashed]} />
              </View>
              <View style={styles.travelBox}>
                <Ionicons name={(MODE_ICON[s.travel_before.mode] ?? "walk-outline") as any} size={15} color={colors.muted} />
                <Text style={styles.travelText}>
                  {s.travel_before.duration_min} min · {MODE_LABEL[s.travel_before.mode]}
                  {s.travel_before.lines.length ? ` · ${s.travel_before.lines.join(", ")}` : ""}
                  {` · ${s.travel_before.distance_km.toFixed(1).replace(".", ",")} km`}
                  {s.travel_before.cost > 0 ? ` · ${euro(s.travel_before.cost)}` : ""}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={styles.row}>
            <View style={styles.timeCol}>
              <Text style={styles.time}>{s.start}</Text>
              <Text style={styles.timeEnd}>{s.end}</Text>
            </View>
            <View style={styles.lineCol}>
              <View style={[styles.node, s.kind === "free" && styles.nodeFree]} />
              {i < plan.steps.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <PressableScale
              testID={`timeline-step-${s.index}`}
              scaleTo={0.98}
              disabled={!s.place}
              onPress={() => s.place && router.push(`/place/${s.place.id}`)}
              style={styles.card}
            >
              {s.place ? (
                <Image source={{ uri: s.place.image }} style={styles.thumb} contentFit="cover" transition={200} />
              ) : (
                <View style={[styles.thumb, styles.freeThumb]}>
                  <Ionicons name="footsteps-outline" size={22} color={colors.muted} />
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.slot}>
                  {s.slot_label}
                  {s.place ? ` · ${CATEGORY_LABEL[s.place.category]}` : ""}
                </Text>
                <Text style={styles.title} numberOfLines={2}>
                  {s.title}
                </Text>
                <View style={styles.priceRow}>
                  {s.deal && s.full_price !== s.final_price ? (
                    <Text style={styles.strike}>{euro(s.full_price)}</Text>
                  ) : null}
                  <Text style={styles.price}>{s.final_price === 0 ? "Gratuit" : euro(s.final_price)}</Text>
                  {s.deal ? (
                    <View style={styles.dealBadge}>
                      <Text style={styles.dealText}>-{s.deal.discount_pct}%</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {onSwap && s.place ? (
                <PressableScale
                  testID={`timeline-swap-${s.index}`}
                  onPress={() => onSwap(s)}
                  hitSlop={8}
                  style={styles.swap}
                >
                  {swapping === s.index ? (
                    <Spinner size={16} />
                  ) : (
                    <Ionicons name="swap-horizontal" size={18} color={colors.onSurface} />
                  )}
                </PressableScale>
              ) : null}
            </PressableScale>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export function EconomicsCard({ plan }: { plan: Plan }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = plan.totals;
  const pct = Math.min(1, t.budget > 0 ? t.final_total / t.budget : 0);
  return (
    <View style={styles.eco} testID="economics-card">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={styles.ecoLabel}>Coût total</Text>
          <Text style={styles.ecoBig} testID="economics-final-total">
            {euro(t.final_total)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.ecoLabel}>Budget</Text>
          <Text style={styles.ecoMid}>{euro(t.budget)}</Text>
        </View>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFg, { width: `${pct * 100}%`, backgroundColor: t.within_budget ? colors.brandPrimary : colors.error }]} />
      </View>
      <View style={styles.ecoRows}>
        <EcoRow label="Prix plein" value={euro(t.full_total)} testID="economics-full-total" />
        <EcoRow label="Bons plans CityPulse" value={`- ${euro(t.savings)}`} accent testID="economics-savings" />
        <EcoRow label="dont transports" value={euro(t.travel_total)} />
        <EcoRow label="Reste du budget" value={euro(t.remaining)} testID="economics-remaining" />
      </View>
    </View>
  );
}

function EcoRow({ label, value, accent, testID }: { label: string; value: string; accent?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: font.regular, fontSize: 14, color: colors.muted }}>{label}</Text>
      <Text testID={testID} style={{ fontFamily: font.semibold, fontSize: 14, color: accent ? colors.success : colors.onSurface }}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "stretch" },
  travelRow: { flexDirection: "row", alignItems: "center", minHeight: 40 },
  timeCol: { width: 48, paddingTop: spacing.md },
  time: { fontFamily: font.semibold, fontSize: 13, color: c.onSurface },
  timeEnd: { fontFamily: font.regular, fontSize: 11, color: c.muted, marginTop: 2 },
  lineCol: { width: 24, alignItems: "center" },
  node: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: c.brandPrimary,
    borderWidth: 3,
    borderColor: c.brandTertiary,
    marginTop: spacing.md + 2,
  },
  nodeFree: { backgroundColor: c.muted, borderColor: c.surfaceTertiary },
  line: { flex: 1, width: 2, backgroundColor: c.borderStrong, minHeight: 12 },
  dashed: { backgroundColor: c.border, minHeight: 40 },
  travelBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: spacing.sm },
  travelText: { flex: 1, fontFamily: font.regular, fontSize: 12, color: c.muted },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    marginLeft: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  freeThumb: { backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  slot: { fontFamily: font.medium, fontSize: 11, color: c.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontFamily: font.semibold, fontSize: 15, color: c.onSurface },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  strike: { fontFamily: font.regular, fontSize: 12, color: c.muted, textDecorationLine: "line-through" },
  price: { fontFamily: font.semibold, fontSize: 13, color: c.onSurface },
  dealBadge: { backgroundColor: c.brandTertiary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  dealText: { fontFamily: font.bold, fontSize: 11, color: c.onBrandTertiary },
  swap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  eco: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.md,
  },
  ecoLabel: { fontFamily: font.regular, fontSize: 12, color: c.muted },
  ecoBig: { fontFamily: font.bold, fontSize: 30, letterSpacing: -0.8, color: c.onSurface },
  ecoMid: { fontFamily: font.semibold, fontSize: 18, color: c.onSurface },
  barBg: { height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  barFg: { height: 8, borderRadius: 4 },
  ecoRows: { gap: spacing.sm, paddingTop: spacing.xs },
}));
