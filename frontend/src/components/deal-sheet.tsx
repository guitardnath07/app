import { useMutation } from "@tanstack/react-query";
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, { ZoomIn } from "react-native-reanimated";

import { api } from "@/src/api";
import { Sheet } from "@/src/components/sheet";
import { Button, Ionicons, Spinner, T } from "@/src/components/ui";
import { DEAL_TYPE_LABEL, timeLeft } from "@/src/constants";
import type { Deal } from "@/src/types";
import { font, radius, spacing, useTheme } from "@/src/theme";

export function DealSheet({ deal, onClose }: { deal: Deal | null; onClose: () => void }) {
  const { colors } = useTheme();
  const claim = useMutation({
    mutationFn: (id: string) => api<{ code: string }>(`/deals/${id}/claim`, { method: "POST" }),
  });
  const { mutate, reset } = claim;

  useEffect(() => {
    if (deal && deal.kind === "promo") mutate(deal.id);
    else reset();
  }, [deal, mutate, reset]);

  const left = deal ? timeLeft(deal.expires_at) : null;

  return (
    <Sheet visible={!!deal} onClose={onClose} testID="deal-sheet">
      {deal ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.brandPrimary, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {deal.kind === "braderie" ? "Braderie locale" : DEAL_TYPE_LABEL[deal.type]}
              {left ? ` · expire dans ${left}` : ""}
            </Text>
            <T variant="title">{deal.title}</T>
            <T style={{ color: colors.muted }}>
              {deal.place ? `${deal.place.name} — ` : ""}
              {deal.description}
            </T>
          </View>

          {deal.kind === "promo" ? (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: radius.lg,
                padding: spacing.xl,
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              {claim.data ? (
                <Animated.View entering={ZoomIn.springify()} style={{ alignItems: "center", gap: spacing.md }}>
                  <View testID="deal-qr-code">
                    <QRCode value={`CITYPULSE:${claim.data.code}`} size={180} color="#0F0F0F" backgroundColor="#FFFFFF" />
                  </View>
                  <Text testID="deal-qr-code-value" style={{ fontFamily: font.bold, fontSize: 20, letterSpacing: 2, color: "#0F0F0F" }}>
                    {claim.data.code}
                  </Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: "#555555", textAlign: "center" }}>
                    Présentez ce QR code en caisse chez le commerçant partenaire
                  </Text>
                </Animated.View>
              ) : claim.isError ? (
                <View style={{ alignItems: "center", gap: spacing.sm }}>
                  <Text style={{ fontFamily: font.medium, color: "#B91C1C" }}>Impossible de générer le code</Text>
                  <Button label="Réessayer" variant="secondary" onPress={() => mutate(deal.id)} testID="deal-qr-retry" />
                </View>
              ) : (
                <View style={{ height: 240, alignItems: "center", justifyContent: "center" }}>
                  <Spinner color="#E27443" size={28} />
                </View>
              )}
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                gap: spacing.md,
                alignItems: "center",
                padding: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: colors.brandTertiary,
              }}
            >
              <Ionicons name="calendar-outline" size={22} color={colors.onBrandTertiary} />
              <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.onBrandTertiary }}>
                Événement en accès libre — aucun code nécessaire.
              </Text>
            </View>
          )}
          <Button label="Fermer" variant="secondary" onPress={onClose} testID="deal-sheet-close" />
        </View>
      ) : null}
    </Sheet>
  );
}
