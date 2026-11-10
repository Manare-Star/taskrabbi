import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { totalUnread, useUnreadCounts } from "../../lib/queries/chat";
import { ActivityBell } from "../../components/ActivityBell";
import { ScreenLoader } from "../../components/ScreenLoader";
import { colors } from "../../lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

// Outline when idle, filled when selected: the standard tab bar cue alongside the colour.
// The colours match tabBarActiveTintColor / tabBarInactiveTintColor below.
function tabIcon(idle: IconName, selected: IconName) {
  return function TabIcon({ size, focused }: { size: number; focused: boolean }) {
    return <Ionicons name={focused ? selected : idle} color={focused ? colors.primary : colors.textFaint} size={size - 1} />;
  };
}

export default function TabsLayout() {
  const { session, profile, loading, recoveringPassword } = useAuth();
  // Mounted for as long as you're signed in, so the Messages badge stays live on every tab.
  const { data: unreadByThread } = useUnreadCounts(profile?.id);
  const unreadMessages = totalUnread(unreadByThread);

  if (loading) return <ScreenLoader />;
  if (recoveringPassword) return <Redirect href="/(auth)/forgot-password" />;
  if (!session || !profile) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        tabBarStyle: { borderTopColor: colors.borderStrong, backgroundColor: colors.background },
        headerTitleStyle: { fontWeight: "600", fontSize: 17, color: colors.text },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerRight: () => <ActivityBell />,
        tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.white, fontSize: 10, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: "Browse",
          // The screen draws its own large "Tasks near you" title.
          headerTitle: "",
          tabBarIcon: tabIcon("search-outline", "search"),
        }}
      />
      <Tabs.Screen name="post" options={{ title: "Post", headerTitle: "Post a task", tabBarIcon: tabIcon("add-circle-outline", "add-circle") }} />
      <Tabs.Screen name="my-tasks" options={{ title: "My tasks", tabBarIcon: tabIcon("reader-outline", "reader") }} />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge: unreadMessages > 0 ? (unreadMessages > 99 ? "99+" : unreadMessages) : undefined,
          tabBarIcon: tabIcon("chatbubble-outline", "chatbubble"),
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("person-outline", "person") }} />
    </Tabs>
  );
}
