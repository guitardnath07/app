import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { FlatList, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Button, EmptyState, IconButton, Ionicons, PressableScale, Skeleton } from "@/src/components/ui";
import { euro } from "@/src/constants";
import type { Itinerary } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function ScreenHeader({ title, testID }: { title: string; testID: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
      <IconButton icon="chevron-back" onPress={() => router.back()} testID={`${testID}-back-button`} />
      <Text style={{ fontFamily: font.bold, fontSize: 22, letterSpacing: -0.5, color: colors.onSurface }}>{title}</Text>
    </View>
  );
}

export default function Journal() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["itineraries"], queryFn: () => api<Itinerary[]>("/itineraries") });

  return (
    <View style={styles.screen} testID="journal-screen">
      <ScreenHeader title="Carnet de voyage" testID="journal" />
      {q.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton style={{ height: 96 }} />
          <Skeleton style={{ height: 96 }} />
        </View>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={
            <EmptyState icon="book-outline" title="Votre carnet est vide" text="Générez et enregistrez une journée depuis l'Organisateur IA." testID="journal-empty"
              action={<Button label="Organiser une journée" onPress={() => router.push("/planner")} testID="journal-go-planner" />} />
          }
          renderItem={({ item, index }) => {
            const first = item.plan.steps.find((s) => s.place)?.place;
            return (
              <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)}>
                <PressableScale testID={`journal-item-${item.id}`} scaleTo={0.98} onPress={() => router.push(`/itinerary/${item.id}`)} style={styles.card}>
                  {first ? <Image source={{ uri: first.image }} style={styles.img} contentFit="cover" /> : <View style={styles.img} />}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.date}>
                      {new Date(item.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} · {item.plan.steps.length} étapes
                    </Text>
                    <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                    <View style={{ flexDirection: "row", gap: spacing.md }}>
                      <Text style={styles.meta}>{euro(item.plan.totals.final_total)}</Text>
                      <Text style={[styles.meta, { color: colors.success }]}>-{euro(item.plan.totals.savings)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </PressableScale>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, paddingRight: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  img: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: c.surfaceTertiary },
  date: { fontFamily: font.medium, fontSize: 12, color: c.muted },
  title: { fontFamily: font.semibold, fontSize: 16, color: c.onSurface },
  meta: { fontFamily: font.semibold, fontSize: 13, color: c.onSurface },
}));
