import type { Ionicons } from "@expo/vector-icons";

// Each category gets a line icon. Colour stays neutral so the list reads calmly; the
// category is recognised by its icon and name.
type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICONS: Record<string, IconName> = {
  "Furniture Assembly": "bed-outline",
  "Moving Help": "cube-outline",
  Cleaning: "sparkles-outline",
  Handyman: "hammer-outline",
  Delivery: "bicycle-outline",
  "Yard Work": "leaf-outline",
  "Mounting & Installation": "tv-outline",
  Other: "ellipsis-horizontal-circle-outline",
};

export function categoryIcon(category: string | null | undefined): IconName {
  return (category && CATEGORY_ICONS[category]) || "ellipsis-horizontal-circle-outline";
}
