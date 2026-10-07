import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Ionicons, PressableScale, Skeleton } from "@/src/components/ui";
import { euro } from "@/src/constants";
import { usesNativeTabs } from "@/src/navigation";
import type { Stats } from "@/src/types";
import { font, makeStyles, radius, setColorScheme, spacing, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const { user, logout } = useAuth();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/me/stats") });
  const s = stats.data;
  const max = Math.max(1, ...(s?.monthly.map((m) => m.spent) ?? [1]));

  const toggleTheme = (dark: boolean) => {
    setColorScheme(dark ? "dark" : "light");
    storage.setItem("cp_theme", dark ? "dark" : "light");
  };

  return (
    <View style={styles.screen} testID="profile-screen">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: bottomChrome + spacing.xl, gap: spacing.xl }}
        refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={stats.refetch} tintColor={colors.brandPrimary} />}
      >
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.userRow}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }]}>
              <Text style={{ fontFamily: font.bold, fontSize: 22, color: colors.onBrandTertiary }}>{user?.name?.[0] ?? "?"}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} testID="profile-name">{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.dash} testID="budget-dashboard">
          {stats.isLoading ? (
            <Skeleton style={{ height: 200 }} />
          ) : (
            <>
              <Text style={styles.dashLabel}>Total économisé avec CityPulse</Text>
              <Text style={styles.saved} testID="profile-total-saved">{euro(s?.total_saved ?? 0)}</Text>
              <Text style={styles.dashSub}>
                {euro(s?.total_spent ?? 0)} dépensés en sorties planifiées
              </Text>
              <View style={styles.chart} testID="profile-monthly-chart">
                {s?.monthly.map((m, i) => (
                  <Bar key={m.key} ratio={m.spent / max} label={m.label} value={m.spent} delay={i * 70} last={i === s.monthly.length - 1} />
                ))}
              </View>
            </>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify().damping(18)} style={styles.statsRow}>
          <StatBox icon="map-outline" value={s?.itineraries_count ?? 0} label="Journées" testID="stat-itineraries" />
          <StatBox icon="qr-code-outline" value={s?.claims_count ?? 0} label="QR promos" testID="stat-claims" />
          <StatBox icon="heart-outline" value={s?.favorites_count ?? 0} label="Favoris" testID="stat-favorites" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).springify().damping(18)} style={styles.list}>
          <Row icon="book-outline" label="Carnet de voyage" onPress={() => router.push("/journal")} testID="profile-journal-row" />
          <View style={styles.sep} />
          <Row icon="heart-outline" label="Mes favoris" onPress={() => router.push("/favorites")} testID="profile-favorites-row" />
          <View style={styles.sep} />
          <View style={styles.row}>
            <Ionicons name="moon-outline" size={20} color={colors.onSurface} />
            <Text style={styles.rowLabel}>Mode sombre</Text>
            <Switch
              testID="profile-theme-switch"
              value={scheme === "dark"}
              onValueChange={toggleTheme}
              trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
              thumbColor={colors.onBrandPrimary}
            />
          </View>
        </Animated.View>

        <PressableScale testID="profile-logout-button" onPress={logout} style={styles.logout}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.error }}>Se déconnecter</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

function Bar({ ratio, label, value, delay, last }: { ratio: number; label: string; value: number; delay: number; last: boolean }) {
  const { colors } = useTheme();
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withSpring(Math.max(0.04, ratio), { damping: 16 }));
  }, [ratio, delay, h]);
  const a = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 10, color: colors.muted }}>{value > 0 ? `${Math.round(value)}€` : ""}</Text>
      <View style={{ height: 100, width: "60%", justifyContent: "flex-end" }}>
        <Animated.View style={[{ width: "100%", borderRadius: 6, backgroundColor: last ? colors.brandPrimary : colors.surfaceTertiary }, a]} />
      </View>
      <Text style={{ fontFamily: font.medium, fontSize: 11, color: last ? colors.onSurface : colors.muted }}>{label}</Text>
    </View>
  );
}

function StatBox({ icon, value, label, testID }: { icon: string; value: number; label: string; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stat} testID={testID}>
      <Ionicons name={icon as any} size={18} color={colors.brandPrimary} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale testID={testID} onPress={onPress} scaleTo={0.98} style={styles.row}>
      <Ionicons name={icon as any} size={20} color={colors.onSurface} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  name: { fontFamily: font.bold, fontSize: 22, letterSpacing: -0.5, color: c.onSurface },
  email: { fontFamily: font.regular, fontSize: 13, color: c.muted },
  dash: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  dashLabel: { fontFamily: font.medium, fontSize: 13, color: c.muted },
  saved: { fontFamily: font.bold, fontSize: 40, letterSpacing: -1.4, color: c.brandPrimary, marginTop: 2 },
  dashSub: { fontFamily: font.regular, fontSize: 13, color: c.onSurfaceTertiary },
  chart: { flexDirection: "row", alignItems: "flex-end", marginTop: spacing.xl },
  statsRow: { flexDirection: "row", gap: spacing.md },
  stat: { flex: 1, padding: spacing.md, gap: 4, borderRadius: radius.md, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  statVal: { fontFamily: font.bold, fontSize: 22, color: c.onSurface },
  statLabel: { fontFamily: font.regular, fontSize: 12, color: c.muted },
  list: { borderRadius: radius.lg, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg },
  rowLabel: { flex: 1, fontFamily: font.medium, fontSize: 15, color: c.onSurface },
  sep: { height: 1, backgroundColor: c.divider, marginLeft: 52 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border },
}));
