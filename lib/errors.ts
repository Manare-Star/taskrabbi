// Turning whatever a failed request threw into a sentence worth showing someone.
//
// Supabase's Postgrest/Auth/Functions errors are plain objects with a `message` field, not
// always real Error instances, so `err instanceof Error` silently misses them. Read the
// fields directly. Messages raised by our own database functions are already written for
// users and pass through; Postgres/Auth/network internals are translated.

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}

// Checked in order against the lower-cased message.
const MESSAGE_TRANSLATIONS: [RegExp, string][] = [
  [/network request failed|failed to fetch|network error|fetch failed/, "No internet connection. Check your connection and try again."],
  [/invalid login credentials/, "That email and password don't match. Check them and try again."],
  [/email not confirmed/, "Confirm your email address first. We sent you a code when you signed up."],
  [/user already registered|already been registered/, "An account with this email already exists. Log in instead."],
  [/token has expired or is invalid|otp.*expired|invalid.*otp/, "That code is wrong or has expired. Check it, or ask for a new one."],
  [/for security purposes, you can only request this after (\d+) seconds?/, "Please wait a moment before asking for another email."],
  [/email rate limit exceeded|rate limit/, "Too many attempts. Please wait a few minutes and try again."],
  [/new password should be different/, "Choose a password you haven't used here before."],
  [/password should be at least|weak password|password is too weak/, "Choose a longer, less common password."],
  [/jwt expired|invalid jwt|jwt issued at future|session.*(missing|not found)/, "Your session expired. Log in again."],
  [/row-level security|permission denied/, "You don't have permission to do that."],
  [/only the task client can accept a bid/, "Only the person who posted this task can accept bids."],
  [/task is not open for bidding/, "This task is no longer open."],
  [/task must be completed before rating/, "You can leave a review once the task is completed."],
  [/edge function returned a non-2xx/, "The server couldn't complete that. Please try again."],
];

const CONSTRAINT_TRANSLATIONS: [RegExp, string][] = [
  [/bids_task_id_tasker_id_key/, "You've already bid on this task."],
  [/tasks_title_length/, "The title needs to be between 3 and 120 characters."],
  [/tasks_description_length/, "The description is too long."],
  [/tasks_area_length/, "Enter the suburb or area."],
  [/tasks_address_length/, "The address is too long."],
  [/tasks_budget_max|bids_amount_max/, "That amount is over the R 1 000 000 limit."],
  [/tasks_budget_check|bids_amount_check/, "Enter an amount above zero."],
  [/chat_messages_body_length/, "Messages can be up to 2 000 characters."],
  [/_length/, "Some of that text is too long."],
];

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw = rawMessage(err);
  if (!raw) return fallback;

  const lower = raw.toLowerCase();
  for (const [pattern, message] of CONSTRAINT_TRANSLATIONS) {
    if (pattern.test(lower)) return message;
  }
  for (const [pattern, message] of MESSAGE_TRANSLATIONS) {
    if (pattern.test(lower)) return message;
  }
  // Anything else that still reads like database output isn't worth showing.
  if (/violates|constraint|syntax error|relation .* does not exist|column .* does not exist|function .* does not exist/.test(lower)) {
    return fallback;
  }
  return raw;
}

// True when the failure was the device being offline rather than anything the user did.
export function isNetworkError(err: unknown): boolean {
  return /network request failed|failed to fetch|network error|fetch failed/i.test(rawMessage(err) ?? "");
}

// Supabase Auth says "Email not confirmed" when a user who hasn't entered their code tries
// to log in; the app sends them to the code screen instead of showing an error.
export function isEmailNotConfirmed(err: unknown): boolean {
  return /email not confirmed/i.test(rawMessage(err) ?? "");
}

function rawMessage(err: unknown): string | null {
  if (typeof err === "string") return err.trim() || null;
  if (err && typeof err === "object") {
    const message = (err as ErrorLike).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}
