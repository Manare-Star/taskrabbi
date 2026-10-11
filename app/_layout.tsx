import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { StripeProvider } from "@stripe/stripe-react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../lib/auth-context";
import { CelebrationProvider } from "../lib/celebration";
import { colors } from "../lib/theme";

const queryClient = new QueryClient();
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

// React Query's refetchOnWindowFocus needs to be told when the app itself regains
// focus on native platforms (there's no browser window-focus event to listen to).
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === "active");
}

export default function RootLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StripeProvider publishableKey={stripePublishableKey}>
          <AuthProvider>
            <CelebrationProvider>
              <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { fontWeight: "700" } }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="task/[id]" options={{ title: "Task" }} />
                <Stack.Screen name="chat/[threadId]" options={{ title: "Chat" }} />
                <Stack.Screen name="user/[id]" options={{ title: "Profile" }} />
                <Stack.Screen name="checkout/[taskId]" options={{ title: "Checkout", presentation: "modal" }} />
              </Stack>
            </CelebrationProvider>
          </AuthProvider>
        </StripeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
