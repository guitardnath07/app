import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { Linking, View } from "react-native";

import { api } from "@/src/api";
import { LeafletMap } from "@/src/components/map/leaflet-map";
import type { LeafletMapHandle, TransitStop } from "@/src/components/map/types";
import { Sheet } from "@/src/components/sheet";
import { useToast } from "@/src/components/toast";
import { Button, IconButton, Ionicons, Spinner, T } from "@/src/components/ui";
import type { Place } from "@/src/types";
import { radius, spacing, useTheme } from "@/src/theme";

const TOURS = { lat: 47.3936, lng: 0.6875 };

function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

type PermState = null | "ask" | "denied" | "settings";

export function InteractiveMap({ places }: { places: Place[] }) {
  const { colors } = useTheme();
  const toast = useToast();
  const map = useRef<LeafletMapHandle>(null);
  const [perm, setPerm] = useState<PermState>(null);
  const [locating, setLocating] = useState(false);
  const stops = useQuery({ queryKey: ["transit-stops"], queryFn: () => api<TransitStop[]>("/transit-stops"), staleTime: Infinity });

  const goLocate = async () => {
    setLocating(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (distKm(me, TOURS) > 30) {
        toast("Vous êtes hors de Tours : recentrage sur le centre", "info");
        map.current?.send({ type: "center" });
      } else {
        map.current?.send({ type: "locate", ...me });
      }
    } catch {
      toast("Position indisponible, recentrage sur Tours", "info");
      map.current?.send({ type: "center" });
    } finally {
      setLocating(false);
    }
  };

  const onLocatePress = async () => {
    const p = await Location.getForegroundPermissionsAsync();
    if (p.granted) return goLocate();
    if (p.status === "undetermined") return setPerm("ask");
    setPerm(p.canAskAgain ? "denied" : "settings");
  };

  const request = async () => {
    const r = await Location.requestForegroundPermissionsAsync();
    if (r.granted) {
      setPerm(null);
      goLocate();
    } else {
      // one more contextual attempt maximum, then send to settings
      setPerm(perm === "ask" && r.canAskAgain ? "denied" : "settings");
    }
  };

  return (
    <View style={{ flex: 1 }} testID="city-map">
      <LeafletMap ref={map} places={places} stops={stops.data ?? []} onOpenPlace={(id) => router.push(`/place/${id}`)} />
      <View style={{ position: "absolute", right: spacing.lg, top: spacing.lg, gap: spacing.sm }}>
        <View style={{ borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <IconButton icon="add" bg="transparent" onPress={() => map.current?.send({ type: "zoomIn" })} testID="map-zoom-in" />
          <View style={{ height: 1, backgroundColor: colors.divider }} />
          <IconButton icon="remove" bg="transparent" onPress={() => map.current?.send({ type: "zoomOut" })} testID="map-zoom-out" />
        </View>
        <View style={{ borderRadius: 22, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
          {locating ? (
            <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Spinner size={18} />
            </View>
          ) : (
            <IconButton icon="locate" bg="transparent" color={colors.brandPrimary} onPress={onLocatePress} testID="map-locate-button" />
          )}
        </View>
      </View>

      <Sheet visible={!!perm} onClose={() => setPerm(null)} testID="location-permission-sheet">
        <View style={{ gap: spacing.lg }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="navigate" size={26} color={colors.onBrandTertiary} />
          </View>
          <T variant="h2">
            {perm === "settings" ? "Localisation désactivée" : "Voir les lieux autour de vous"}
          </T>
          <T style={{ color: colors.muted }}>
            {perm === "settings"
              ? "Activez la localisation dans les réglages pour vous recentrer sur la carte. Le reste de l'app reste utilisable."
              : perm === "denied"
                ? "Sans votre position, nous ne pouvons pas vous situer sur la carte. Vous pouvez réessayer une dernière fois."
                : "CityPulse utilise votre position uniquement pour vous situer sur la carte et calculer vos trajets."}
          </T>
          {perm === "settings" ? (
            <Button label="Ouvrir les réglages" icon="settings-outline" onPress={() => { setPerm(null); Linking.openSettings().catch(() => {}); }} testID="location-open-settings" />
          ) : (
            <Button label={perm === "denied" ? "Réessayer" : "Autoriser la localisation"} onPress={request} testID="location-allow-button" />
          )}
          <Button label="Plus tard" variant="secondary" onPress={() => { setPerm(null); map.current?.send({ type: "center" }); }} testID="location-later-button" />
        </View>
      </Sheet>
    </View>
  );
}
