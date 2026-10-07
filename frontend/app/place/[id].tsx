import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Dimensions, ScrollView, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { DealSheet } from "@/src/components/deal-sheet";
import { useToast } from "@/src/components/toast";
import { bounceProps, Button, EmptyState, IconButton, Ionicons, PressableScale, Skeleton } from "@/src/components/ui";
import { CATEGORY_LABEL, DEAL_TYPE_LABEL, TRANSPORT_ICON, euro, priceLevel, timeLeft } from "@/src/constants";
import type { Deal, Place } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const HERO = 340;
const W = Dimensions.get("window").width;

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [deal, setDeal] = useState<Deal | null>(null);
  const y = useSharedValue(0);

  const q = useQuery({ queryKey: ["place", id], queryFn: () => api<Place>(`/places/${id}`) });
  const fav = useMutation({
    mutationFn: () => api<{ is_favorite: boolean }>(`/favorites/${id}`, { method: "POST" }),
    onSuccess: (r) => {
      qc.setQueryData<Place>(["place", id], (p) => (p ? { ...p, is_favorite: r.is_favorite } : p));
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["places"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast(r.is_favorite ? "Ajouté aux favoris" : "Retiré des favoris");
    },
  });

  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(y.value, [-HERO, 0, HERO], [-HERO / 2, 0, HERO * 0.5]) },
      { scale: interpolate(y.value, [-HERO, 0], [2, 1], "clamp") },
    ],
  }));
  const headerBg = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [HERO - 140, HERO - 60], [0, 1], "clamp") }));

  const p = q.data;

  return (
    <View style={styles.screen} testID="place-detail-screen">
      {q.isLoading ? (
        <View>
          <Skeleton style={{ height: HERO, borderRadius: 0 }} />
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Skeleton style={{ height: 28, width: "70%" }} />
            <Skeleton style={{ height: 16, width: "40%" }} />
            <Skeleton style={{ height: 120 }} />
          </View>
        </View>
      ) : q.isError || !p ? (
        <View style={{ paddingTop: insets.top + 60 }}>
          <EmptyState icon={(q.error as any)?.status === 403 ? "shield-outline" : "alert-circle-outline"} title={(q.error as any)?.status === 403 ? "Lieu réservé aux personnes majeures" : "Lieu introuvable"} testID="place-error"
            action={<Button label="Retour" variant="secondary" onPress={() => router.back()} testID="place-error-back" />} />
        </View>
      ) : (
        <Animated.ScrollView {...bounceProps} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
          <Animated.View style={[{ height: HERO }, heroStyle]}>
            <Image source={{ uri: p.images[0] }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={300} />
            <LinearGradient colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.35)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          </Animated.View>
          <View style={styles.sheet}>
            <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: spacing.xs }}>
              <Text style={styles.cat}>
                {CATEGORY_LABEL[p.category]} · {p.avg_price === 0 ? "Gratuit" : `${priceLevel(p.price_level)} · ~${euro(p.avg_price)}/pers.`}
              </Text>
              <Text style={styles.name} testID="place-name">{p.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="star" size={14} color={colors.brandSecondary} />
                <Text style={styles.meta}>{p.rating.toFixed(1)} · {p.reviews_count} avis</Text>
                <View style={[styles.status, { backgroundColor: p.is_open ? colors.success : colors.error }]} />
                <Text style={[styles.meta, { color: p.is_open ? colors.success : colors.error }]} testID="place-open-status">
                  {p.is_open ? "Ouvert" : "Fermé"} · {p.today_hours}
                </Text>
              </View>
              <Text style={styles.desc}>{p.description}</Text>
            </Animated.View>

            {p.deals && p.deals.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={{ gap: spacing.md }}>
                <Text style={styles.section}>Bons plans du lieu</Text>
                {p.deals.map((d) => (
                  <PressableScale key={d.id} testID={`place-deal-${d.id}`} onPress={() => setDeal({ ...d, place: { id: p.id, name: p.name } as any })} style={styles.deal}>
                    <View style={styles.dealPct}>
                      <Text style={styles.dealPctText}>-{d.discount_pct}%</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.dealType}>
                        {DEAL_TYPE_LABEL[d.type]}
                        {d.expires_at ? ` · ${timeLeft(d.expires_at)}` : ""}
                      </Text>
                      <Text style={styles.dealTitle}>{d.title}</Text>
                    </View>
                    <Ionicons name="qr-code-outline" size={22} color={colors.onBrandTertiary} />
                  </PressableScale>
                ))}
              </Animated.View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {p.images.map((u, i) => (
                <Image key={i} source={{ uri: u }} style={{ width: W * 0.6, height: 140, borderRadius: radius.md }} contentFit="cover" />
              ))}
            </ScrollView>

            <View style={styles.block}>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.onSurface} />
                <Text style={styles.infoText}>{p.address}</Text>
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <Text style={styles.section}>Transports à proximité</Text>
              <View style={styles.block}>
                {p.transports.map((t, i) => (
                  <View key={i} style={[styles.infoRow, i > 0 && styles.rowSep]} testID={`place-transport-${i}`}>
                    <View style={styles.transIcon}>
                      <Ionicons name={(TRANSPORT_ICON[t.type] ?? "bus-outline") as any} size={16} color={colors.onBrandTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoTitle}>{t.line}</Text>
                      <Text style={styles.infoSub}>Arrêt {t.stop}</Text>
                    </View>
                    <Text style={styles.infoSub}>{t.walk_min} min à pied</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <Text style={styles.section}>Horaires</Text>
              <View style={styles.block}>
                {p.week_hours?.map((h, i) => (
                  <View key={h.day} style={[styles.hourRow, i > 0 && styles.rowSep]}>
                    <Text style={[styles.hourDay, h.today && { color: colors.brandPrimary, fontFamily: font.semibold }]}>{h.day}</Text>
                    <Text style={[styles.hourVal, h.today && { color: colors.brandPrimary }]}>{h.hours}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={{ gap: spacing.md }}>
              <Text style={styles.section}>Avis · {p.rating.toFixed(1)} / 5</Text>
              {p.reviews.map((r, i) => (
                <View key={i} style={styles.review}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={styles.infoTitle}>{r.author}</Text>
                    <View style={{ flexDirection: "row", gap: 2 }}>
                      {Array.from({ length: 5 }).map((_, k) => (
                        <Ionicons key={k} name={k < r.rating ? "star" : "star-outline"} size={12} color={colors.brandSecondary} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.desc}>{r.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.ScrollView>
      )}

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Animated.View style={[styles.headerBg, headerBg]} />
        <IconButton icon="chevron-back" onPress={() => router.back()} testID="place-back-button" bg="rgba(0,0,0,0.45)" color="#FFFFFF" />
        {p ? (
          <Animated.Text style={[styles.headerTitle, headerBg]} numberOfLines={1}>{p.name}</Animated.Text>
        ) : <View style={{ flex: 1 }} />}
        {p ? (
          <IconButton
            icon={p.is_favorite ? "heart" : "heart-outline"}
            color={p.is_favorite ? colors.brandPrimary : "#FFFFFF"}
            bg="rgba(0,0,0,0.45)"
            onPress={() => fav.mutate()}
            testID="place-favorite-button"
          />
        ) : null}
      </View>
      <DealSheet deal={deal} onClose={() => setDeal(null)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: c.border },
  headerTitle: { flex: 1, fontFamily: font.semibold, fontSize: 16, color: c.onSurface, textAlign: "center" },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: c.surface, padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.xl },
  cat: { fontFamily: font.medium, fontSize: 12, color: c.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  name: { fontFamily: font.bold, fontSize: 28, letterSpacing: -0.8, color: c.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  meta: { fontFamily: font.medium, fontSize: 13, color: c.onSurfaceTertiary },
  status: { width: 7, height: 7, borderRadius: 4, marginLeft: 6 },
  desc: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: c.onSurfaceTertiary, marginTop: spacing.xs },
  section: { fontFamily: font.semibold, fontSize: 18, letterSpacing: -0.2, color: c.onSurface },
  deal: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: c.brandTertiary },
  dealPct: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  dealPctText: { fontFamily: font.bold, fontSize: 16, color: c.onBrandPrimary },
  dealType: { fontFamily: font.medium, fontSize: 11, color: c.onBrandTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
  dealTitle: { fontFamily: font.semibold, fontSize: 15, color: c.onSurface },
  block: { borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowSep: { borderTopWidth: 1, borderTopColor: c.divider },
  infoText: { flex: 1, fontFamily: font.regular, fontSize: 14, color: c.onSurface },
  infoTitle: { fontFamily: font.semibold, fontSize: 14, color: c.onSurface },
  infoSub: { fontFamily: font.regular, fontSize: 12, color: c.muted },
  transIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  hourRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  hourDay: { fontFamily: font.regular, fontSize: 14, color: c.onSurfaceTertiary },
  hourVal: { fontFamily: font.medium, fontSize: 14, color: c.onSurface },
  review: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
}));
