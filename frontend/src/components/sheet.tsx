import React from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, useTheme } from "@/src/theme";

export function Sheet({
  visible,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1, backgroundColor: colors.overlay }}>
          <Pressable testID="sheet-backdrop" style={{ flex: 1 }} onPress={onClose} />
          <Animated.View
            testID={testID}
            entering={SlideInDown.springify().damping(19).stiffness(170).mass(0.9)}
            style={{
              backgroundColor: colors.surfaceSecondary,
              borderTopLeftRadius: radius.lg + 8,
              borderTopRightRadius: radius.lg + 8,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.lg,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 5,
                borderRadius: 3,
                backgroundColor: colors.borderStrong,
                marginBottom: spacing.lg,
              }}
            />
            {children}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
