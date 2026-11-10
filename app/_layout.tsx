import { useEffect } from "react";
import { AppState, StyleSheet, View, type AppStateStatus } from "react-native";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { ToastProvider } from "../lib/toast";
import { supabase } from "../lib/supabase";
import { isNetworkError } from "../lib/errors";
import { colors } from "../lib/theme";
import { EmptyState } from "../components/EmptyState";
import { OfflineBanner } from "../components/OfflineBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Realtime subscriptions keep on-screen data fresh; this just avoids refetching the
      // same thing when two screens mount within moments of each other.
      staleTime: 15_000,
      // Retry a dropped connection, not a refusal: a "permission denied" won't change.
      retry: (failureCount, error) => failureCount < 2 && isNetworkError(error),
    },
    mutations: { retry: false },
  },
});

// On native there's no browser "window focus" event, so tell React Query (refetch on focus)
// and Supabase Auth (keep the session refreshed only while in the foreground) when the app
// comes to the front or goes to the background.
function onAppStateChange(status: AppStateStatus) {
  const active = status === "active";
  focusManager.setFocused(active);
  if (active) supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
}

// Shown by Expo Router in place of any screen that throws while rendering.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.error(error);
  return (
    <View style={styles.flex}>
      <EmptyState
        icon="alert-circle-outline"
        title="Something went wrong"
        subtitle="That wasn't supposed to happen. Try again, and if it keeps happening, restart the app."
        action={{ label: "Try again", onPress: retry }}
      />
    </View>
  );
}

// Which screens exist depends on who's looking. A protected group whose guard is false
// can't be navigated to, and anyone already on one of its screens is sent back to the
// start (index), which forwards them to the right place. So signing out, an expired
// session or a deleted account can never leave someone on a signed-in screen.
function RootNavigator() {
  const { session, profile, loading, recoveringPassword } = useAuth();
  // Someone part-way through a password reset has a session but isn't in yet.
  const signedIn = !!session && !!profile && !recoveringPassword;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "600", fontSize: 17, color: colors.text },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Protected guard={!loading && !signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="task/[id]" options={{ title: "Task" }} />
        <Stack.Screen name="chat/[threadId]" options={{ title: "Chat" }} />
        <Stack.Screen name="user/[id]" options={{ title: "Profile" }} />
        <Stack.Screen name="activity" options={{ title: "Activity" }} />
        <Stack.Screen name="checkout/[taskId]" options={{ title: "Checkout", presentation: "modal" }} />
        <Stack.Screen name="report" options={{ title: "Report", presentation: "modal" }} />
        <Stack.Screen name="settings/edit-profile" options={{ title: "Edit profile" }} />
        <Stack.Screen name="settings/change-password" options={{ title: "Change password" }} />
        <Stack.Screen name="settings/blocked" options={{ title: "Blocked people" }} />
        <Stack.Screen name="settings/delete-account" options={{ title: "Delete account" }} />
      </Stack.Protected>

      {/* Readable signed in or out: linked from the welcome and sign-up screens too. */}
      <Stack.Screen name="legal/terms" options={{ title: "Terms of Service" }} />
      <Stack.Screen name="legal/privacy" options={{ title: "Privacy Policy" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <View style={styles.flex}>
              <RootNavigator />
            </View>
            <OfflineBanner />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
});
