// Design tokens for CityPulse. Dark is the default scheme; light is available
// through the in-app toggle (Profil). Keys match /app/design_guidelines.json.

import { useMemo, useSyncExternalStore } from "react";
import { Appearance, StyleSheet } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0F0F0F",
  onSurface: "#F2F2F2",
  surfaceSecondary: "#1C1C1C",
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#2C2C2C",
  onSurfaceTertiary: "#E0E0E0",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0F0F0F",
  muted: "#8E8E93",

  brand: "#E27443",
  onBrand: "#FFFFFF",
  brandPrimary: "#E27443",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F4B376",
  onBrandSecondary: "#1A1A1A",
  brandTertiary: "#432616",
  onBrandTertiary: "#F4B376",

  success: "#34C759",
  onSuccess: "#000000",
  warning: "#F5A623",
  onWarning: "#000000",
  error: "#FF3B30",
  onError: "#FFFFFF",
  info: "#64D2FF",
  onInfo: "#000000",

  border: "#2C2C2C",
  borderStrong: "#4A4A4A",
  divider: "#2C2C2C",

  overlay: "rgba(0,0,0,0.6)",
  mapBase: "#151515",
  mapStreet: "#262626",
  mapWater: "#16232B",
  mapPark: "#17201A",
};

export type ThemeColors = typeof dark;

const light: ThemeColors = {
  surface: "#F7F5F2",
  onSurface: "#141414",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#141414",
  surfaceTertiary: "#ECE8E3",
  onSurfaceTertiary: "#3A3A3A",
  surfaceInverse: "#141414",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6E6E73",

  brand: "#E27443",
  onBrand: "#FFFFFF",
  brandPrimary: "#D5652F",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F4B376",
  onBrandSecondary: "#1A1A1A",
  brandTertiary: "#FBE6DA",
  onBrandTertiary: "#9A4520",

  success: "#1F9D45",
  onSuccess: "#FFFFFF",
  warning: "#B97500",
  onWarning: "#FFFFFF",
  error: "#D92D20",
  onError: "#FFFFFF",
  info: "#0A84C2",
  onInfo: "#FFFFFF",

  border: "#E4DFD8",
  borderStrong: "#C9C2B8",
  divider: "#ECE8E3",

  overlay: "rgba(0,0,0,0.4)",
  mapBase: "#EDE9E3",
  mapStreet: "#FFFFFF",
  mapWater: "#CFE2EA",
  mapPark: "#DCE8D5",
};

export const defaultScheme: ColorScheme = "dark";
export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

let current: ColorScheme = defaultScheme;
const listeners = new Set<() => void>();

export function setColorScheme(scheme: ColorScheme | null) {
  current = scheme ?? defaultScheme;
  Appearance.setColorScheme?.(current);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

setColorScheme(defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const scheme = useSyncExternalStore(subscribe, () => current, () => current);
  return { scheme, colors: themes[scheme] };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const font = {
  regular: "Geist",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
};
