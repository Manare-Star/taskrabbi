import { LIMITS } from "./config";

// Form validation. Each validator returns a message to show under the field, or null when
// the value is fine. They mirror the database's own limits (migration 0019), so the user
// hears about a problem next to the field instead of as a failed save.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(email)) return "That doesn't look like an email address.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Enter a password.";
  if (value.length < LIMITS.passwordMin) return `Use at least ${LIMITS.passwordMin} characters.`;
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) return "Include at least one letter and one number.";
  return null;
}

export function validateName(value: string): string | null {
  const name = value.trim();
  if (name.length < 2) return "Enter your full name.";
  if (name.length > LIMITS.nameMax) return `Keep it under ${LIMITS.nameMax} characters.`;
  return null;
}

export function validateRequired(value: string, message: string): string | null {
  return value.trim() ? null : message;
}

export function validateLength(value: string, { min = 0, max, label }: { min?: number; max: number; label: string }): string | null {
  const length = value.trim().length;
  if (length < min) return min === 1 ? `Enter ${label}.` : `${capitalize(label)} needs at least ${min} characters.`;
  if (length > max) return `${capitalize(label)} can be at most ${max} characters (currently ${length}).`;
  return null;
}

// Reads an amount the way people type it: "1250", "1 250", "1,250.50", "R 1250".
// Returns null for anything that isn't a positive amount with at most two decimals.
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/^\s*R/i, "").replace(/[\s ]/g, "");
  if (!cleaned) return null;

  let normalised = cleaned;
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    normalised = cleaned.replace(/,/g, ""); // 1,250.50 → thousands separators
  } else if (/^\d+,\d{1,2}$/.test(cleaned)) {
    normalised = cleaned.replace(",", "."); // 99,50 → decimal comma
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return null;

  const amount = Number(normalised);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function validateMoney(input: string, label = "an amount"): string | null {
  if (!input.trim()) return `Enter ${label}.`;
  const amount = parseMoney(input);
  if (amount === null) return "Enter an amount in Rand, like 450 or 450.50.";
  if (amount > LIMITS.moneyMax) return "That's more than the R 1 000 000 limit.";
  return null;
}

// One-time codes from email: digits only, 6 or more (Supabase's length is configurable).
export function validateCode(value: string): string | null {
  const code = value.trim();
  if (!code) return "Enter the code from the email.";
  if (!/^\d{6,10}$/.test(code)) return "The code is the 6-digit number in the email.";
  return null;
}

// True when every validator passed.
export function isValid(errors: Record<string, string | null | undefined>): boolean {
  return Object.values(errors).every((error) => !error);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
