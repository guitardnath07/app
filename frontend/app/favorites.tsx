import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PlaceCard } from "@/src/components/place-card";
import { Button, EmptyState, Skeleton } from "@/src/components/ui";
import type { Place } from "@/src/types";
import { spacing, useTheme } from "@/src/theme";

import { ScreenHeader } from "./journal";

export default function Favorites() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["favorites"], queryFn: () => api<Place[]>("/favorites") });
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="favorites-screen">
      <ScreenHeader title="Mes favoris" testID="favorites" />
      {q.isLoading ? (
        <View style={{ padding: spacing.lg }}>
          <Skeleton style={{ height: 180 }} />
        </View>
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => <PlaceCard place={item} index={index} compact />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={
            <EmptyState icon="heart-outline" title="Aucun favori" text="Touchez le cœur sur la fiche d'un lieu pour l'ajouter ici." testID="favorites-empty"
              action={<Button label="Découvrir des lieux" onPress={() => router.push("/")} testID="favorites-go-discover" />} />
          }
        />
      )}
    </View>
  );
}
