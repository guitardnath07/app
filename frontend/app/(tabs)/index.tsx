import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { CityMap } from "@/src/components/city-map";
import { PlaceCard } from "@/src/components/place-card";
import { Button, Chip, EmptyState, Ionicons, PressableScale, Skeleton } from "@/src/components/ui";
import { CATEGORIES } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import type { Place } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

const WEATHER_ICON: Record<string, string> = { sun: "sunny-outline", rain: "rainy-outline", cold: "snow-outline" };

export default function Discover() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const [dealsOnly, setDealsOnly] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (cats.length) p.set("category", cats.join(","));
    if (price) p.set("price", String(price));
    if (openNow) p.set("open_now", "true");
    if (dealsOnly) p.set("deals", "true");
    return p.toString();
  }, [q, cats, price, openNow, dealsOnly]);

  const places = useQuery({ queryKey: ["places", qs], queryFn: () => api<Place[]>(`/places?${qs}`) });
  const weather = useQuery({ queryKey: ["weather"], queryFn: () => api<{ label: string; temp_c: number; condition: string }>("/weather") });

  const toggleCat = (k: string) => setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const clearAll = () => {
    setQ("");
    setCats([]);
    setPrice(null);
    setOpenNow(false);
    setDealsOnly(false);
  };
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <View style={styles.screen} testID="discover-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Bonjour {firstName}</Text>
            <Text style={styles.title}>Découvrir Tours</Text>
          </View>
          {weather.data ? (
            <Animated.View entering={FadeIn} style={styles.weather} testID="discover-weather">
              <Ionicons name={(WEATHER_ICON[weather.data.condition] ?? "partly-sunny-outline") as any} size={16} color={colors.brandSecondary} />
              <Text style={styles.weatherText}>{weather.data.temp_c}°</Text>
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="discover-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Resto, musée, bar, adresse…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="search"
          />
          {q ? (
            <PressableScale testID="discover-search-clear" onPress={() => setQ("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </PressableScale>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipContent}>
          {CATEGORIES.map((c) => (
            <Chip key={c.key} testID={`filter-category-${c.key}`} label={c.label} icon={c.icon} selected={cats.includes(c.key)} onPress={() => toggleCat(c.key)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipContent}>
          <Chip testID="filter-open-now" label="Ouvert" icon="time-outline" selected={openNow} onPress={() => setOpenNow((v) => !v)} />
          <Chip testID="filter-deals" label="Bons plans" icon="pricetag-outline" selected={dealsOnly} onPress={() => setDealsOnly((v) => !v)} />
          {[1, 2, 3].map((n) => (
            <Chip key={n} testID={`filter-price-${n}`} label={"€".repeat(n)} selected={price === n} onPress={() => setPrice(price === n ? null : n)} />
          ))}
        </ScrollView>
      </View>

      {places.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Skeleton style={{ height: 240, borderRadius: radius.lg }} />
          <Skeleton style={{ height: 240, borderRadius: radius.lg }} />
        </View>
      ) : places.isError ? (
        <EmptyState
          testID="discover-error"
          icon="cloud-offline-outline"
          title="Impossible de charger les lieux"
          action={<Button label="Réessayer" variant="secondary" onPress={() => places.refetch()} testID="discover-retry" />}
        />
      ) : view === "map" ? (
        <CityMap places={places.data ?? []} bottomInset={bottomChrome + 80} />
      ) : (
        <FlatList
          testID="discover-list"
          data={places.data}
          keyExtractor={(p) => p.id}
          renderItem={({ item, index }) => <PlaceCard place={item} index={index} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: bottomChrome + 96 }}
          refreshControl={<RefreshControl refreshing={places.isRefetching} onRefresh={places.refetch} tintColor={colors.brandPrimary} />}
          ListHeaderComponent={
            <Text style={styles.count} testID="discover-count">
              {places.data?.length ?? 0} lieu{(places.data?.length ?? 0) > 1 ? "x" : ""} à Tours
            </Text>
          }
          ListEmptyComponent={
            <EmptyState
              testID="discover-empty"
              icon="search-outline"
              title="Aucun lieu trouvé"
              text="Essayez d'élargir vos filtres."
              action={<Button label="Effacer les filtres" variant="secondary" onPress={clearAll} testID="discover-clear-filters" />}
            />
          }
        />
      )}

      <View style={[styles.toggleWrap, { bottom: bottomChrome + 16 }]} pointerEvents="box-none">
        <View style={styles.toggle}>
          {(["list", "map"] as const).map((v) => (
            <PressableScale
              key={v}
              testID={`view-toggle-${v}`}
              onPress={() => setView(v)}
              style={[styles.toggleBtn, view === v && { backgroundColor: colors.surfaceInverse }]}
            >
              <Ionicons name={v === "list" ? "list" : "map"} size={16} color={view === v ? colors.onSurfaceInverse : colors.onSurface} />
              <Text style={[styles.toggleText, { color: view === v ? colors.onSurfaceInverse : colors.onSurface }]}>
                {v === "list" ? "Liste" : "Carte"}
              </Text>
            </PressableScale>
          ))}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider, paddingBottom: spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  hello: { fontFamily: font.regular, fontSize: 14, color: c.muted },
  title: { fontFamily: font.bold, fontSize: 28, letterSpacing: -0.8, color: c.onSurface },
  weather: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  weatherText: { fontFamily: font.semibold, fontSize: 14, color: c.onSurface },
  search: {
    marginHorizontal: spacing.lg,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 15, color: c.onSurface, height: 48 },
  chipRow: { height: 52, flexGrow: 0 },
  chipContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  count: { fontFamily: font.medium, fontSize: 13, color: c.muted },
  toggleWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  toggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  toggleBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  toggleText: { fontFamily: font.semibold, fontSize: 14 },
}));
