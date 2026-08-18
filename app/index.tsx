import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth-context";

// Entry point: send the user to the right stack based on auth state.
export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (session && profile) return <Redirect href="/(tabs)/browse" />;
  return <Redirect href="/(auth)/login" />;
}
