import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { ScreenLoader } from "../../components/ScreenLoader";
import { colors } from "../../lib/theme";

export default function AuthLayout() {
  const { session, profile, loading, recoveringPassword } = useAuth();

  if (loading) return <ScreenLoader />;

  // Mid password reset the user is signed in but not finished: keep them here until the new
  // password is saved.
  if (session && profile && !recoveringPassword) return <Redirect href="/(tabs)/browse" />;

  return (
    <Stack
      screenOptions={{
        title: "",
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
