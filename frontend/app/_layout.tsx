import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, Platform, Modal, View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeContext";
import { AppProvider } from "@/src/context/AppContext";
import { CatalogProvider } from "@/src/context/CatalogContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/src/lib/revenuecat";
import { registerForPush } from "@/src/lib/push";
import { storage } from "@/src/utils/storage";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// --- Push notifications: module-scope setup (before any component mounts) ---
// Foreground display behavior.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
// Android channel — must exist before any push arrives.
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Déclic",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

// Configure RevenueCat exactly once, at module scope, before any component mounts.
initializeRevenueCat();

const queryClient = new QueryClient();

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    "ClashDisplay-Bold": require("@/assets/fonts/ClashDisplay-Bold.ttf"),
    "ClashDisplay-Semibold": require("@/assets/fonts/ClashDisplay-Semibold.ttf"),
    "ClashDisplay-Medium": require("@/assets/fonts/ClashDisplay-Medium.ttf"),
    "Satoshi-Medium": require("@/assets/fonts/Satoshi-Medium.ttf"),
    "Satoshi-Bold": require("@/assets/fonts/Satoshi-Bold.ttf"),
    "Satoshi-Regular": require("@/assets/fonts/Satoshi-Regular.ttf"),
    "Satoshi-Black": require("@/assets/fonts/Satoshi-Black.ttf"),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <SubscriptionProvider>
              <ThemeProvider>
                <AppProvider>
                  <CatalogProvider>
                    <BottomSheetModalProvider>
                      <ThemedChrome />
                    </BottomSheetModalProvider>
                  </CatalogProvider>
                </AppProvider>
              </ThemeProvider>
            </SubscriptionProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedChrome() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [nudgeVisible, setNudgeVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;

    // Register this device for push (best-effort, re-runs on every app open).
    registerForPush();

    const routeFromData = (data: any) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      if (typeof url === "string" && url.startsWith("http")) Linking.openURL(url);
      else router.push(url);
    };

    // Warm tap — user taps a notification while the app is open.
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromData(response.notification.request.content.data || {});
    });

    // Cold-start tap — app was killed when the notification was tapped.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) routeFromData(response.notification.request.content.data || {});
    });

    // Weekly nudge for users who permanently denied notifications.
    (async () => {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();
      if (status !== "denied" || canAskAgain) return;
      const lastNudge = await storage.getItem<number>("pushNudgeAt", 0);
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (lastNudge && Date.now() - Number(lastNudge) <= oneWeek) return;
      setNudgeVisible(true);
    })();

    return () => {
      tapSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissNudge = async (openSettings: boolean) => {
    await storage.setItem("pushNudgeAt", Date.now());
    setNudgeVisible(false);
    if (openSettings) Linking.openSettings();
  };

  const nudge = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 24 },
    card: { width: "100%", maxWidth: 360, backgroundColor: colors.surfaceSecondary, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: "center" },
    iconWrap: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 14, backgroundColor: colors.brand + "22" },
    title: { fontFamily: "ClashDisplay-Semibold", color: colors.onSurface, fontSize: 22, textAlign: "center" },
    body: { fontFamily: "Satoshi-Regular", color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 10 },
    primary: { minHeight: 52, alignSelf: "stretch", borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 22, backgroundColor: colors.brand },
    primaryText: { fontFamily: "ClashDisplay-Semibold", color: colors.onBrand, fontSize: 15, letterSpacing: 0.5 },
    later: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
    laterText: { fontFamily: "Satoshi-Medium", color: colors.muted, fontSize: 14 },
  });

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: "fade",
        }}
      />
      <Modal visible={nudgeVisible} transparent animationType="fade" onRequestClose={() => dismissNudge(false)}>
        <View style={nudge.backdrop}>
          <View style={nudge.card} testID="push-nudge-card">
            <View style={nudge.iconWrap}>
              <MaterialCommunityIcons name="bell-ring-outline" size={28} color={colors.brand} />
            </View>
            <Text style={nudge.title}>Reste dans la boucle</Text>
            <Text style={nudge.body}>
              Active les notifications pour recevoir les nouveaux packs de questions et les
              défis du week-end.
            </Text>
            <Pressable style={nudge.primary} onPress={() => dismissNudge(true)} testID="push-nudge-settings">
              <Text style={nudge.primaryText}>OUVRIR LES RÉGLAGES</Text>
            </Pressable>
            <Pressable style={nudge.later} onPress={() => dismissNudge(false)} testID="push-nudge-later">
              <Text style={nudge.laterText}>Plus tard</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
