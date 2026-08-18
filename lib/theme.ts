export const colors = {
  primary: "#2E7D32",
  primaryDark: "#1B5E20",
  primaryLight: "#EAF4EB",
  accent: "#F5A623",
  background: "#FFFFFF",
  surface: "#F7F8F7",
  surfaceAlt: "#EFF2EF",
  border: "#E4E7E4",
  borderStrong: "#D3D8D3",
  text: "#15181A",
  textMuted: "#6B7370",
  textFaint: "#9AA29E",
  danger: "#C62828",
  dangerLight: "#FDECEA",
  warning: "#B45309",
  warningLight: "#FEF3E2",
  success: "#2E7D32",
  successLight: "#EAF4EB",
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
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
  label: { fontSize: 13, fontWeight: "600" as const },
};

export const shadow = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  button: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
};

export const statusColors: Record<string, { bg: string; fg: string }> = {
  open: { bg: colors.primaryLight, fg: colors.primaryDark },
  pending: { bg: colors.warningLight, fg: colors.warning },
  assigned: { bg: colors.warningLight, fg: colors.warning },
  accepted: { bg: colors.primaryLight, fg: colors.primaryDark },
  completed: { bg: colors.surfaceAlt, fg: colors.textMuted },
  cancelled: { bg: colors.dangerLight, fg: colors.danger },
  rejected: { bg: colors.dangerLight, fg: colors.danger },
};
