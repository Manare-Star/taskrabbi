// Supabase's Postgrest/Auth/Functions errors are plain objects with a `message` field,
// not always real Error instances, so `err instanceof Error` silently misses them and
// falls back to a useless generic string. Check for a `message` property instead.
export function getErrorMessage(err: unknown, fallback = "Please try again."): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (typeof err === "string") return err;
  return fallback;
}
