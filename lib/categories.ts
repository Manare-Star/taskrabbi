// Playful per-category identity: an emoji plus a color, with a light tint for backgrounds.
export interface CategoryStyle {
  emoji: string;
  color: string;
  tint: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "Furniture Assembly": { emoji: "🪑", color: "#8E5BD9", tint: "#F3ECFC" },
  "Moving Help": { emoji: "📦", color: "#E07A2F", tint: "#FDF1E7" },
  Cleaning: { emoji: "🧽", color: "#1E9BD7", tint: "#E7F5FC" },
  Handyman: { emoji: "🔧", color: "#D64545", tint: "#FCEBEB" },
  Delivery: { emoji: "🚚", color: "#2F7FD6", tint: "#E9F1FC" },
  "Yard Work": { emoji: "🌿", color: "#3A9B48", tint: "#EAF6EC" },
  "Mounting & Installation": { emoji: "🖼️", color: "#C2559A", tint: "#FBEAF4" },
  Other: { emoji: "✨", color: "#C99A1E", tint: "#FBF5E4" },
};

const FALLBACK: CategoryStyle = { emoji: "✨", color: "#6B7370", tint: "#EFF2EF" };

export function categoryStyle(category: string | null | undefined): CategoryStyle {
  return (category && CATEGORY_STYLES[category]) || FALLBACK;
}
