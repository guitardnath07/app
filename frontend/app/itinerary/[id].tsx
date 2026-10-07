import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { EconomicsCard, Timeline } from "@/src/components/timeline";
import { useToast } from "@/src/components/toast";
import { Button, EmptyState, Ionicons, Skeleton, T } from "@/src/components/ui";
import { MODE_LABEL } from "@/src/constants";
import type { Itinerary } from "@/src/types";
import { font, radius, spacing, useTheme } from "@/src/theme";

import { ScreenHeader } from "../journal";

export default function ItineraryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["itinerary", id], queryFn: () => api<Itinerary>(`/itineraries/${id}`) });
  const del = useMutation({
    mutationFn: () => api(`/itineraries/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["itineraries"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      toast("Itinéraire supprimé");
      router.back();
    },
  });
  const it = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="itinerary-detail-screen">
      <ScreenHeader title="Itinéraire" testID="itinerary" />
      {q.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton style={{ height: 30, width: "60%" }} />
          <Skeleton style={{ height: 160 }} />
        </View>
      ) : !it ? (
        <EmptyState icon="alert-circle-outline" title="Itinéraire introuvable" testID="itinerary-error" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
          <View style={{ gap: spacing.sm }}>
            <T variant="title" testID="itinerary-name">{it.name}</T>
            <Text style={{ fontFamily: font.regular, fontSize: 13, color: colors.muted }}>
              {it.plan.params.start}–{it.plan.params.end} · {it.plan.params.people} pers. · {MODE_LABEL[it.plan.params.mode]}
            </Text>
            {it.ai?.summary ? <T style={{ color: colors.onSurfaceTertiary }}>{it.ai.summary}</T> : null}
          </View>
          <EconomicsCard plan={it.plan} />
          <Timeline plan={it.plan} />
          {it.ai?.tips?.length ? (
            <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
              {it.ai.tips.map((t, i) => (
                <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Ionicons name="bulb-outline" size={16} color={colors.brandSecondary} />
                  <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 14, color: colors.onSurfaceTertiary }}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Button label="Supprimer du carnet" icon="trash-outline" variant="secondary" onPress={() => del.mutate()} loading={del.isPending} testID="itinerary-delete-button" />
        </ScrollView>
      )}
    </View>
  );
}
