import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/src/auth";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { LoginScreen } from "@/src/components/login-screen";
import { ProfileCompletion } from "@/src/components/profile-completion";
import { ToastProvider } from "@/src/components/toast";
import { Spinner } from "@/src/components/ui";
import { queryClient } from "@/src/query-client";
import { setColorScheme, useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

function Gate() {
  const { user, loading } = useAuth();
  const { colors, scheme } = useTheme();
  if (loading) {
    return (
      <View testID="app-loading" style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <Spinner size={28} />
      </View>
    );
  }
  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen />
      </>
    );
  }
  if (!user.birthdate) {
    return (
      <>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <ProfileCompletion />
      </>
    );
  }
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "slide_from_right", gestureEnabled: true }}>
        <Stack.Screen name="place/[id]" options={{ animation: "slide_from_bottom", gestureDirection: "vertical", fullScreenGestureEnabled: true, animationDuration: 380 }} />
        <Stack.Screen name="itinerary/[id]" options={{ animation: "slide_from_bottom", gestureDirection: "vertical", animationDuration: 380 }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Geist: require("../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("../assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("../assets/fonts/Geist-Bold.ttf"),
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
  });

  useEffect(() => {
    storage.getItem("cp_theme", "dark").then((s) => setColorScheme(s === "light" ? "light" : "dark"));
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "#0F0F0F" }} />;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <ToastProvider>
              <AuthProvider>
                <Gate />
              </AuthProvider>
            </ToastProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
