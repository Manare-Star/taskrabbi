import Constants from "expo-constants";

// App-wide settings that aren't secrets. Anything environment-specific comes from
// EXPO_PUBLIC_* variables (see .env.example) so it can differ per build without code changes.

export const APP_NAME = "Siza";

// Where "Contact support" and the legal pages send people. Set EXPO_PUBLIC_SUPPORT_EMAIL to
// a real, monitored inbox before publishing: the app stores require a working contact.
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || "support@example.com";

// The legal entity that operates the service, as named in the Terms and Privacy Policy.
export const OPERATOR_NAME = process.env.EXPO_PUBLIC_OPERATOR_NAME || APP_NAME;

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

// Last revision of the Terms and Privacy Policy shown in the app (lib/legal.ts).
export const LEGAL_UPDATED = "10 November 2026";

export const LIMITS = {
  nameMax: 80,
  bioMax: 1000,
  taskTitleMin: 3,
  taskTitleMax: 120,
  taskDescriptionMax: 5000,
  areaMax: 120,
  addressMax: 300,
  bidMessageMax: 1000,
  chatMessageMax: 2000,
  reviewMax: 1000,
  reportDetailsMax: 2000,
  moneyMax: 1_000_000,
  passwordMin: 8,
} as const;

// How far Browse looks for tasks, in metres.
export const SEARCH_RADIUS_METERS = 20_000;
