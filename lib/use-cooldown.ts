import { useCallback, useEffect, useState } from "react";

// A countdown for "send again" buttons, so a tap can't fire off email after email (and run
// into the email provider's rate limit). `start()` begins it; `remaining` is seconds left.
export function useCooldown(seconds: number) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setEndsAt(null);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [endsAt]);

  const start = useCallback(() => setEndsAt(Date.now() + seconds * 1000), [seconds]);

  return { remaining, start, active: remaining > 0 };
}
