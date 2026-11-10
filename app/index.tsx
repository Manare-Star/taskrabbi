import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { ScreenLoader } from "../components/ScreenLoader";

// Entry point: send the user to the right stack based on auth state.
export default function Index() {
  const { session, profile, loading, recoveringPassword } = useAuth();

  if (loading) return <ScreenLoader />;
  if (recoveringPassword) return <Redirect href="/(auth)/forgot-password" />;
  if (session && profile) return <Redirect href="/(tabs)/browse" />;
  return <Redirect href="/(auth)/welcome" />;
}
