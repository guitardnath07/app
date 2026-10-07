import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Ionicons } from "@/src/components/ui";
import { font, radius, spacing, useTheme } from "@/src/theme";

type Toast = { id: number; text: string; type: "success" | "error" | "info" };
const Ctx = createContext<(text: string, type?: Toast["type"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback((text: string, type: Toast["type"] = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, type });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const iconName = toast?.type === "error" ? "alert-circle" : toast?.type === "info" ? "information-circle" : "checkmark-circle";
  const iconColor = toast?.type === "error" ? colors.error : toast?.type === "info" ? colors.info : colors.success;

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg }}>
          <Animated.View
            key={toast.id}
            entering={FadeInUp.springify().damping(18)}
            exiting={FadeOutUp}
            testID="toast-message"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.surfaceInverse,
              borderRadius: radius.pill,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              alignSelf: "center",
            }}
          >
            <Ionicons name={iconName as any} size={18} color={iconColor} />
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: colors.onSurfaceInverse }}>{toast.text}</Text>
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
