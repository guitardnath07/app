import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { DealSheet } from "@/src/components/deal-sheet";
import { bounceProps, Button, Chip, EmptyState, Ionicons, PressableScale, Skeleton } from "@/src/components/ui";
import { DEAL_TYPES, DEAL_TYPE_LABEL, timeLeft } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import type { Deal } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Deals() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const [type, setType] = useState("");
  const [open, setOpen] = useState<Deal | null>(null);

  const deals = useQuery({ queryKey: ["deals", type], queryFn: () => api<Deal[]>(`/deals${type ? `?type=${type}` : ""}`) });
  const flash = (deals.data ?? []).filter((d) => d.type === "flash");
  const rest = type ? deals.data ?? [] : (deals.data ?? []).filter((d) => d.type !== "flash");

  return (
    <View style={styles.screen} testID="deals-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <Text style={styles.sub}>Hub d&apos;économies</Text>
          <Text style={styles.title}>Bons plans</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 56, flexGrow: 0 }} contentContainerStyle={styles.chipContent}>
          {DEAL_TYPES.map((t) => (
            <Chip key={t.key || "all"} testID={`deal-filter-${t.key || "all"}`} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        {...bounceProps}
        contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl, paddingTop: spacing.lg }}
        refreshControl={<RefreshControl refreshing={deals.isRefetching} onRefresh={deals.refetch} tintColor={colors.brandPrimary} />}
      >
        {deals.isLoading ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            <Skeleton style={{ height: 200, borderRadius: radius.lg }} />
            <Skeleton style={{ height: 92 }} />
            <Skeleton style={{ height: 92 }} />
          </View>
        ) : deals.isError ? (
          <EmptyState icon="cloud-offline-outline" title="Impossible de charger les bons plans" testID="deals-error"
            action={<Button label="Réessayer" variant="secondary" onPress={() => deals.refetch()} testID="deals-retry" />} />
        ) : (deals.data ?? []).length === 0 ? (
          <EmptyState icon="pricetags-outline" title="Aucun bon plan pour le moment" text="Revenez bientôt, les commerçants publient chaque jour." testID="deals-empty" />
        ) : (
          <>
            {!type && flash.length > 0 ? (
              <View style={{ marginBottom: spacing.xl }}>
                <View style={styles.sectionHead}>
                  <Ionicons name="flash" size={16} color={colors.brandPrimary} />
                  <Text style={styles.section}>Ventes flash · moins de 24h</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}>
                  {flash.map((d, i) => (
                    <Animated.View key={d.id} entering={FadeInRight.delay(i * 80).springify().damping(18)}>
                      <PressableScale testID={`flash-deal-${d.id}`} onPress={() => setOpen(d)} style={styles.flashCard}>
                        <Image source={{ uri: d.image }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
                        <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.85)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                        <View style={styles.timer}>
                          <Ionicons name="time" size={12} color={colors.onBrandPrimary} />
                          <Text style={styles.timerText}>{timeLeft(d.expires_at)}</Text>
                        </View>
                        <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 2 }}>
                          <Text style={styles.flashPlace} numberOfLines={1}>{d.place?.name ?? (d.kind === "braderie" ? "Braderie" : "")}</Text>
                          <Text style={styles.flashTitle} numberOfLines={2}>{d.title}</Text>
                        </View>
                      </PressableScale>
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
              {!type ? <Text style={[styles.section, { marginBottom: spacing.xs }]}>Le fil des réductions</Text> : null}
              {rest.map((d, i) => (
                <Animated.View key={d.id} entering={FadeInDown.delay(i * 50).springify().damping(18)}>
                  <PressableScale testID={`deal-row-${d.id}`} onPress={() => setOpen(d)} style={styles.row}>
                    <Image source={{ uri: d.image }} style={styles.rowImg} contentFit="cover" />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.rowType}>
                        {d.kind === "braderie" ? "Braderie" : DEAL_TYPE_LABEL[d.type]}
                        {d.expires_at ? ` · ${timeLeft(d.expires_at)}` : ""}
                      </Text>
                      <Text style={styles.rowTitle} numberOfLines={1}>{d.title}</Text>
                      <Text style={styles.rowPlace} numberOfLines={1}>{d.place?.name ?? d.description}</Text>
                    </View>
                    {d.discount_pct > 0 ? (
                      <View style={styles.pct}>
                        <Text style={styles.pctText}>-{d.discount_pct}%</Text>
                      </View>
                    ) : (
                      <Ionicons name="calendar-outline" size={20} color={colors.muted} />
                    )}
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <DealSheet deal={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  sub: { fontFamily: font.regular, fontSize: 14, color: c.muted },
  title: { fontFamily: font.bold, fontSize: 28, letterSpacing: -0.8, color: c.onSurface },
  chipContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  section: { fontFamily: font.semibold, fontSize: 17, color: c.onSurface, letterSpacing: -0.2 },
  flashCard: { width: 260, height: 200, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  timer: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: c.brandPrimary,
  },
  timerText: { fontFamily: font.semibold, fontSize: 12, color: c.onBrandPrimary },
  flashPlace: { fontFamily: font.medium, fontSize: 12, color: "rgba(255,255,255,0.75)" },
  flashTitle: { fontFamily: font.bold, fontSize: 18, color: "#FFFFFF", letterSpacing: -0.3 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  rowImg: { width: 72, height: 72, borderRadius: radius.md },
  rowType: { fontFamily: font.medium, fontSize: 11, color: c.brandPrimary, textTransform: "uppercase", letterSpacing: 0.5 },
  rowTitle: { fontFamily: font.semibold, fontSize: 15, color: c.onSurface },
  rowPlace: { fontFamily: font.regular, fontSize: 13, color: c.muted },
  pct: { backgroundColor: c.brandTertiary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md },
  pctText: { fontFamily: font.bold, fontSize: 14, color: c.onBrandTertiary },
}));
