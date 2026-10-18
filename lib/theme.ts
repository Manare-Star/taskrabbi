// Siza's look: calm and trustworthy. Neutral white surfaces, near-black text, one deep-teal
// accent, hairline dividers instead of heavy shadows.
export const colors = {
  primary: "#0F6E56",
  primaryDark: "#085041",
  primaryLight: "#E1F5EE",
  // Star ratings only; everything else stays within the teal + neutral palette.
  accent: "#D99A0B",
  ink: "#16181A",
  background: "#FFFFFF",
  surface: "#F7F8F9",
  surfaceAlt: "#F1F3F5",
  border: "#ECEEF0",
  borderStrong: "#D9DCE0",
  text: "#16181A",
  textMuted: "#6B7280",
  textFaint: "#9AA0A6",
  danger: "#B42318",
  dangerLight: "#FEF0EF",
  warning: "#9A5B05",
  warningLight: "#FDF4E3",
  success: "#0F6E56",
  successLight: "#E1F5EE",
  white: "#FFFFFF",
  black: "#000000",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
};

export const typography = {
  h1: { fontSize: 26, fontWeight: "600" as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: "600" as const, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: "600" as const, letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "600" as const },
};

// Kept very soft: separation comes mostly from hairline borders.
export const shadow = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  raised: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  button: {},
};

export const statusColors: Record<string, { bg: string; fg: string }> = {
  open: { bg: colors.primaryLight, fg: colors.primaryDark },
  pending: { bg: colors.surfaceAlt, fg: colors.textMuted },
  assigned: { bg: colors.warningLight, fg: colors.warning },
  accepted: { bg: colors.primaryLight, fg: colors.primaryDark },
  completed: { bg: colors.surfaceAlt, fg: colors.textMuted },
  cancelled: { bg: colors.dangerLight, fg: colors.danger },
  rejected: { bg: colors.dangerLight, fg: colors.danger },
};
