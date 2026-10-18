import { ActivityIndicator, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { totalUnread, useUnreadCounts } from "../../lib/queries/chat";
import { ActivityBell } from "../../components/ActivityBell";
import { colors } from "../../lib/theme";

export default function TabsLayout() {
  const { session, profile, loading } = useAuth();
  // Mounted for as long as you're signed in, so the Messages badge stays live on every tab.
  const { data: unreadByThread } = useUnreadCounts(profile?.id);
  const unreadMessages = totalUnread(unreadByThread);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session || !profile) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        tabBarStyle: {
          borderTopColor: colors.borderStrong,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerTitleStyle: { fontWeight: "600", fontSize: 17, color: colors.text },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerRight: () => <ActivityBell />,
        tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          // The screen draws its own large "Tasks near you" title.
          headerTitle: "",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" color={color} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Post a task",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-tasks"
        options={{
          title: "My tasks",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="reader-outline" color={color} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge: unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" color={color} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size - 1} />
          ),
        }}
      />
    </Tabs>
  );
}
