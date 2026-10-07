import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { Ionicons, PressableScale } from "@/src/components/ui";
import { CATEGORY_LABEL, euro } from "@/src/constants";
import type { Place } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export type ReneMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
  places: Place[];
  follow_ups: string[];
};

export function ReneAvatar({ size = 36 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.brandPrimary, colors.brandSecondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.45, color: colors.onBrandPrimary }}>R</Text>
    </LinearGradient>
  );
}

export function PlaceStrip({ places, testPrefix }: { places: Place[]; testPrefix: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!places.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingLeft: 44, paddingRight: spacing.lg }} style={{ flexGrow: 0, marginTop: spacing.sm }}>
      {places.map((p, i) => (
        <Animated.View key={p.id} entering={FadeInDown.delay(120 + i * 70).springify().damping(18)}>
          <PressableScale testID={`${testPrefix}-place-${p.id}`} scaleTo={0.97} onPress={() => router.push(`/place/${p.id}`)} style={styles.mini}>
            <Image source={{ uri: p.images[0] }} style={styles.miniImg} contentFit="cover" transition={200} />
            {p.best_discount > 0 ? (
              <View style={styles.miniBadge}>
                <Text style={styles.miniBadgeText}>-{p.best_discount}%</Text>
              </View>
            ) : null}
            <View style={{ padding: spacing.sm, gap: 2 }}>
              <Text style={styles.miniCat} numberOfLines={1}>
                {CATEGORY_LABEL[p.category]} · {p.avg_price === 0 ? "Gratuit" : `~${euro(p.avg_price)}`}
              </Text>
              <Text style={styles.miniName} numberOfLines={1}>{p.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="star" size={11} color={colors.brandSecondary} />
                <Text style={styles.miniMeta}>{p.rating.toFixed(1)}</Text>
                <View style={[styles.dot, { backgroundColor: p.is_open ? colors.success : colors.error }]} />
                <Text style={styles.miniMeta}>{p.is_open ? "Ouvert" : "Fermé"}</Text>
              </View>
              <Text style={styles.miniAddr} numberOfLines={1}>{p.address}</Text>
            </View>
          </PressableScale>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

export function Bubble({ m, onFollowUp, last }: { m: ReneMessage; onFollowUp: (t: string) => void; last: boolean }) {
  const styles = useStyles();
  if (m.role === "user") {
    return (
      <Animated.View entering={FadeInUp.springify().damping(20)} style={styles.userRow} testID={`chat-user-${m.id}`}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{m.text}</Text>
        </View>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={FadeInUp.springify().damping(20)} testID={`chat-rene-${m.id}`}>
      <View style={styles.botRow}>
        <ReneAvatar size={32} />
        <View style={styles.botBubble}>
          <Text style={styles.botText}>{m.text}</Text>
        </View>
      </View>
      <PlaceStrip places={m.places} testPrefix={`chat-${m.id}`} />
      {last && m.follow_ups.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingLeft: 44, paddingRight: spacing.lg }} style={{ flexGrow: 0, marginTop: spacing.sm }}>
          {m.follow_ups.map((f, i) => (
            <PressableScale key={i} testID={`chat-follow-up-${i}`} onPress={() => onFollowUp(f)} style={styles.follow}>
              <Text style={styles.followText}>{f}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const v = useSharedValue(0.3);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(0.3, { duration: 350 })), -1));
  }, [v, delay]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 3 }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted }, a]} />;
}

export function Typing() {
  const styles = useStyles();
  return (
    <Animated.View entering={FadeInUp} style={styles.botRow} testID="chat-typing">
      <ReneAvatar size={32} />
      <View style={[styles.botBubble, { flexDirection: "row", gap: 5, paddingVertical: spacing.lg }]}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  userRow: { alignItems: "flex-end", paddingLeft: 60 },
  userBubble: { backgroundColor: c.brandPrimary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 20, borderBottomRightRadius: 6 },
  userText: { fontFamily: font.medium, fontSize: 15, lineHeight: 21, color: c.onBrandPrimary },
  botRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingRight: 40 },
  botBubble: { flexShrink: 1, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 20, borderBottomLeftRadius: 6 },
  botText: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: c.onSurface },
  mini: { width: 200, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  miniImg: { width: "100%", height: 96 },
  miniBadge: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 8, height: 22, justifyContent: "center" },
  miniBadgeText: { fontFamily: font.bold, fontSize: 11, color: c.onBrandPrimary },
  miniCat: { fontFamily: font.medium, fontSize: 10, color: c.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  miniName: { fontFamily: font.semibold, fontSize: 14, color: c.onSurface },
  miniMeta: { fontFamily: font.regular, fontSize: 11, color: c.onSurfaceTertiary },
  miniAddr: { fontFamily: font.regular, fontSize: 11, color: c.muted },
  dot: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },
  follow: { height: 36, flexShrink: 0, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: c.brandPrimary, justifyContent: "center" },
  followText: { fontFamily: font.medium, fontSize: 13, color: c.brandPrimary },
}));
