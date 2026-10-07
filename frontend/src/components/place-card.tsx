import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Ionicons, PressableScale } from "@/src/components/ui";
import { CATEGORY_LABEL, priceLevel } from "@/src/constants";
import type { Place } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function PlaceCard({ place, index = 0, compact }: { place: Place; index?: number; compact?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).springify().damping(18)}>
      <PressableScale
        testID={`place-card-${place.id}`}
        scaleTo={0.98}
        onPress={() => router.push(`/place/${place.id}`)}
        style={[styles.card, compact && { height: 180 }]}
      >
        <Image source={{ uri: place.images[0] }} style={styles.img} contentFit="cover" transition={250} />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} style={styles.scrim} />
        <View style={styles.topRow}>
          {place.deals_count > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.brandPrimary }]}>
              <Ionicons name="pricetag" size={12} color={colors.onBrandPrimary} />
              <Text style={[styles.badgeText, { color: colors.onBrandPrimary }]}>
                {place.best_discount > 0 ? `-${place.best_discount}%` : "Bon plan"}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View style={[styles.badge, styles.glass]}>
            <View style={[styles.dot, { backgroundColor: place.is_open ? colors.success : colors.error }]} />
            <Text style={[styles.badgeText, { color: "#FFFFFF" }]}>{place.is_open ? "Ouvert" : "Fermé"}</Text>
          </View>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.cat}>
            {CATEGORY_LABEL[place.category]} · {place.avg_price === 0 ? "Gratuit" : priceLevel(place.price_level)}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {place.name}
          </Text>
          <Text style={styles.addr} numberOfLines={1}>{place.address}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={13} color="#F4B376" />
            <Text style={styles.meta}>
              {place.rating.toFixed(1)} ({place.reviews_count})
            </Text>
            <Text style={styles.meta}>·</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {place.today_hours}
            </Text>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    height: 240,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: c.surfaceTertiary,
  },
  img: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const) },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "65%" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
  },
  glass: { backgroundColor: "rgba(0,0,0,0.45)" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontFamily: font.semibold, fontSize: 12 },
  bottom: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 2 },
  cat: { fontFamily: font.medium, fontSize: 12, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.6 },
  name: { fontFamily: font.bold, fontSize: 20, color: "#FFFFFF", letterSpacing: -0.3 },
  addr: { fontFamily: font.regular, fontSize: 12, color: "rgba(255,255,255,0.75)" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontFamily: font.regular, fontSize: 13, color: "rgba(255,255,255,0.85)" },
}));
