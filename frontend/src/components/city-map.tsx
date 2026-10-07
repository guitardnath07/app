import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import Svg, { Path, Rect, Circle } from "react-native-svg";

import { Ionicons, PressableScale } from "@/src/components/ui";
import { CATEGORY_ICON, CATEGORY_LABEL, priceLevel } from "@/src/constants";
import type { Place } from "@/src/types";
import { font, radius, spacing, useTheme } from "@/src/theme";

// Fixed bounding box around Tours so pins keep their real relative positions.
const BOUNDS = { minLat: 47.383, maxLat: 47.401, minLng: 0.6765, maxLng: 0.6985 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function CityMap({ places, bottomInset }: { places: Place[]; bottomInset: number }) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<string | null>(places[0]?.id ?? null);
  const sel = places.find((p) => p.id === selected) ?? null;

  // Central Tours fills the view; outlying places are pinned to the edges.
  const project = (lat: number, lng: number) => ({
    x: clamp(((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * size.w, 28, size.w - 28),
    y: clamp(((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * size.h * 0.7 + 24, 24, size.h * 0.72),
  });

  const streets = useMemo(() => {
    const { w, h } = size;
    if (!w) return [];
    const lines: string[] = [];
    for (let i = 1; i < 9; i++) {
      const y = (h / 9) * i;
      lines.push(`M0 ${y + 8} Q ${w / 2} ${y - 14} ${w} ${y + 4}`);
    }
    for (let i = 1; i < 6; i++) {
      const x = (w / 6) * i;
      lines.push(`M${x - 10} 0 L ${x + 14} ${h}`);
    }
    lines.push(`M0 ${h * 0.3} L ${w} ${h * 0.75}`);
    return lines;
  }, [size]);

  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const loireY = project(47.3995, 0.68).y - 18;
  const cherY = size.h * 0.78;

  return (
    <View testID="city-map" style={{ flex: 1, backgroundColor: colors.mapBase, overflow: "hidden" }} onLayout={onLayout}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} style={{ position: "absolute" }}>
          <Rect x={0} y={0} width={size.w} height={size.h} fill={colors.mapBase} />
          {streets.map((d, i) => (
            <Path key={i} d={d} stroke={colors.mapStreet} strokeWidth={i % 3 === 0 ? 5 : 2.5} fill="none" />
          ))}
          <Circle cx={project(47.389, 0.672).x} cy={project(47.389, 0.672).y} r={34} fill={colors.mapPark} />
          <Path
            d={`M0 ${loireY - 14} C ${size.w * 0.3} ${loireY - 30}, ${size.w * 0.6} ${loireY + 6}, ${size.w} ${loireY - 18} L ${size.w} ${loireY + 22} C ${size.w * 0.6} ${loireY + 40}, ${size.w * 0.3} ${loireY + 4}, 0 ${loireY + 18} Z`}
            fill={colors.mapWater}
          />
          <Path
            d={`M0 ${cherY} C ${size.w * 0.4} ${cherY + 18}, ${size.w * 0.7} ${cherY - 14}, ${size.w} ${cherY + 6}`}
            stroke={colors.mapWater}
            strokeWidth={16}
            fill="none"
          />
        </Svg>
      ) : null}
      <Text
        style={{
          position: "absolute",
          top: loireY - 6,
          left: spacing.lg,
          fontFamily: font.medium,
          fontSize: 11,
          letterSpacing: 2,
          color: colors.muted,
        }}
      >
        LA LOIRE
      </Text>

      {size.w > 0 &&
        places.map((p, i) => {
          const { x, y } = project(p.lat, p.lng);
          const active = p.id === selected;
          return (
            <Animated.View
              key={p.id}
              entering={ZoomIn.delay(i * 40).springify()}
              style={{ position: "absolute", left: x - 20, top: y - 20 }}
            >
              <PressableScale
                testID={`map-pin-${p.id}`}
                onPress={() => setSelected(p.id)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary,
                  borderWidth: 2,
                  borderColor: active ? colors.onBrandPrimary : colors.borderStrong,
                }}
              >
                <Ionicons
                  name={(CATEGORY_ICON[p.category] ?? "location-outline") as any}
                  size={17}
                  color={active ? colors.onBrandPrimary : colors.onSurface}
                />
              </PressableScale>
            </Animated.View>
          );
        })}

      {sel ? (
        <Animated.View
          key={sel.id}
          entering={FadeInDown.springify().damping(18)}
          style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: bottomInset }}
        >
          <PressableScale
            testID="map-selected-card"
            scaleTo={0.98}
            onPress={() => router.push(`/place/${sel.id}`)}
            style={{
              flexDirection: "row",
              gap: spacing.md,
              padding: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Image source={{ uri: sel.images[0] }} style={{ width: 84, height: 84, borderRadius: radius.md }} />
            <View style={{ flex: 1, justifyContent: "center", gap: 3 }}>
              <Text style={{ fontFamily: font.medium, fontSize: 11, color: colors.muted, textTransform: "uppercase" }}>
                {CATEGORY_LABEL[sel.category]} · {sel.avg_price === 0 ? "Gratuit" : priceLevel(sel.price_level)}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 16, color: colors.onSurface }}>
                {sel.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="star" size={12} color={colors.brandSecondary} />
                <Text style={{ fontFamily: font.regular, fontSize: 12, color: colors.onSurfaceTertiary }}>
                  {sel.rating.toFixed(1)} · {sel.is_open ? "Ouvert" : "Fermé"}
                </Text>
                {sel.deals_count > 0 ? (
                  <Text style={{ fontFamily: font.semibold, fontSize: 12, color: colors.brandPrimary }}>
                    · {sel.deals_count} bon{sel.deals_count > 1 ? "s" : ""} plan{sel.deals_count > 1 ? "s" : ""}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={{ justifyContent: "center", paddingRight: spacing.sm }}>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </PressableScale>
        </Animated.View>
      ) : null}
    </View>
  );
}
