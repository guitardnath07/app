import { Ionicons } from "@react-native-vector-icons/ionicons";
import React, { useEffect } from "react";
import { Pressable, PressableProps, StyleProp, Text, TextProps, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export { Ionicons };

export function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Ionicons name={name as any} size={size} color={color ?? colors.onSurface} />;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  style,
  children,
  scaleTo = 0.96,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children?: React.ReactNode }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, { damping: 18, stiffness: 400 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 14, stiffness: 300 });
        rest.onPressOut?.(e);
      }}
      style={[style, a]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function T({
  variant = "body",
  style,
  ...rest
}: TextProps & { variant?: "display" | "title" | "h2" | "body" | "label" | "caption" }) {
  const styles = useTextStyles();
  return <Text {...rest} style={[styles[variant], style]} />;
}

const useTextStyles = makeStyles((c) => ({
  display: { fontFamily: font.bold, fontSize: 30, letterSpacing: -0.8, color: c.onSurface },
  title: { fontFamily: font.bold, fontSize: 24, letterSpacing: -0.5, color: c.onSurface },
  h2: { fontFamily: font.semibold, fontSize: 18, letterSpacing: -0.2, color: c.onSurface },
  body: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, color: c.onSurface },
  label: { fontFamily: font.medium, fontSize: 14, color: c.onSurface },
  caption: { fontFamily: font.regular, fontSize: 12, color: c.muted },
}));

export function Chip({
  label,
  selected,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useChipStyles();
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityState={{ selected }}
    >
      {icon ? (
        <Ionicons
          name={icon as any}
          size={15}
          color={selected ? colors.onSurfaceInverse : colors.onSurfaceTertiary}
        />
      ) : null}
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </PressableScale>
  );
}

const useChipStyles = makeStyles((c) => ({
  chip: {
    height: 36,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.surfaceTertiary,
  },
  chipSelected: { backgroundColor: c.surfaceInverse, borderColor: c.surfaceInverse },
  text: { fontFamily: font.medium, fontSize: 13, color: c.onSurfaceTertiary },
  textSelected: { color: c.onSurfaceInverse },
}));

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  loading,
  disabled,
  testID,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: string;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useBtnStyles();
  const fg =
    variant === "primary" ? colors.onBrandPrimary : variant === "secondary" ? colors.onSurface : colors.brandPrimary;
  return (
    <PressableScale
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.base, styles[variant], (disabled || loading) && { opacity: 0.6 }, style]}
    >
      {loading ? (
        <Spinner color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon as any} size={18} color={fg} /> : null}
          <Text style={[styles.text, { color: fg }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

const useBtnStyles = makeStyles((c) => ({
  base: {
    height: 52,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary },
  ghost: { backgroundColor: "transparent" },
  text: { fontFamily: font.semibold, fontSize: 15 },
}));

export function Spinner({ color, size = 20 }: { color?: string; size?: number }) {
  const { colors } = useTheme();
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(360, { duration: 800 }), -1, false);
  }, [r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          borderColor: color ?? colors.brandPrimary,
          borderTopColor: "transparent",
        },
        a,
      ]}
    />
  );
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const o = useSharedValue(0.4);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: colors.surfaceTertiary, borderRadius: radius.md }, style, a]} />;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  testID,
}: {
  icon: string;
  title: string;
  text?: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.brandTertiary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.sm,
        }}
      >
        <Ionicons name={icon as any} size={28} color={colors.onBrandTertiary} />
      </View>
      <T variant="h2" style={{ textAlign: "center" }}>
        {title}
      </T>
      {text ? (
        <T variant="caption" style={{ textAlign: "center", fontSize: 14 }}>
          {text}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  testID,
  color,
  bg,
  size = 44,
}: {
  icon: string;
  onPress?: () => void;
  testID?: string;
  color?: string;
  bg?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? colors.surfaceTertiary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon as any} size={20} color={color ?? colors.onSurface} />
    </PressableScale>
  );
}
