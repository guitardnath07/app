import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import React, { useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { FinancePanel } from "@/src/components/account/finance-panel";
import { AGE_GROUP_LABEL, ProfilePanel } from "@/src/components/account/profile-panel";
import { bounceProps, PressableScale } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Account() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"finance" | "profile">("finance");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["finance"] });
    setRefreshing(false);
  };

  return (
    <View style={styles.screen} testID="profile-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.userRow}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }]}>
              <Text style={{ fontFamily: font.bold, fontSize: 20, color: colors.onBrandTertiary }}>{user?.first_name?.[0] ?? user?.name?.[0] ?? "?"}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} testID="profile-name" numberOfLines={1}>{user?.name}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.age_group ? AGE_GROUP_LABEL[user.age_group] || user.email : user?.email}</Text>
          </View>
        </Animated.View>
        <View style={styles.seg}>
          {([["finance", "Bilan financier"], ["profile", "Mon profil"]] as const).map(([k, l]) => (
            <PressableScale key={k} testID={`account-tab-${k}`} onPress={() => setTab(k)} style={[styles.segBtn, tab === k && { backgroundColor: colors.surfaceInverse }]}>
              <Text style={[styles.segText, { color: tab === k ? colors.onSurfaceInverse : colors.onSurfaceTertiary }]}>{l}</Text>
            </PressableScale>
          ))}
        </View>
      </View>
      <KeyboardAwareScrollView
        {...bounceProps}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomChrome + spacing.xl }}
        refreshControl={tab === "finance" ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brandPrimary} /> : undefined}
      >
        <Animated.View key={tab} entering={FadeIn.duration(250)}>
          {tab === "finance" ? <FinancePanel /> : <ProfilePanel />}
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: c.divider },
  userRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  name: { fontFamily: font.bold, fontSize: 22, letterSpacing: -0.5, color: c.onSurface },
  email: { fontFamily: font.regular, fontSize: 13, color: c.muted },
  seg: { flexDirection: "row", padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: c.surfaceSecondary, borderWidth: 1, borderColor: c.border },
  segBtn: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segText: { fontFamily: font.semibold, fontSize: 14 },
}));
