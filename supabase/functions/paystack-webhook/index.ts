// Supabase Edge Function (Deno runtime): receives Paystack's webhook, the server-side way a
// payment gets confirmed.
//
// The app confirms a payment by calling paystack-verify when checkout redirects back. That
// misses payments where the app never got back (phone died, app killed mid-checkout). Paystack
// also POSTs a `charge.success` event here for every successful payment, so those still
// complete the task.
//
// Paystack sends no Supabase JWT, so this function is deployed with JWT verification OFF.
// Every request is authenticated instead by its x-paystack-signature header: an HMAC-SHA512
// of the raw body keyed with PAYSTACK_SECRET_KEY (the same secret the other two functions
// use). Unsigned or wrongly signed requests are rejected before anything else happens.
//
// Paystack retries until it gets a 200, and this can race paystack-verify for the same
// payment, so completing is idempotent: repeating it changes nothing and the task_paid
// notification trigger only fires on the first transition to completed.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return text("Method not allowed", 405);
  }

  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) {
      // 5xx so Paystack retries once the secret is configured.
      return text("PAYSTACK_SECRET_KEY is not configured on the server", 500);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";
    if (!(await isValidSignature(rawBody, signature, secretKey))) {
      return text("Invalid signature", 401);
    }

    const event = JSON.parse(rawBody);
    if (event?.event !== "charge.success") {
      return text("Ignored event"); // 200: nothing to do, don't make Paystack retry.
    }

    const reference = String(event.data?.reference ?? "");
    const metadataTaskId = taskIdFromMetadata(event.data?.metadata);
    if (!reference) {
      return text("Ignored: no reference");
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Normally the payment row carries this reference. If the client paid an earlier checkout
    // attempt and then opened checkout again, the row holds the newer reference instead, so
    // fall back to the task id paystack-initialize put in the metadata.
    let { data: payment } = await adminClient
      .from("payments")
      .select("task_id, amount, status")
      .eq("reference", reference)
      .maybeSingle();
    if (!payment && metadataTaskId) {
      ({ data: payment } = await adminClient
        .from("payments")
        .select("task_id, amount, status")
        .eq("task_id", metadataTaskId)
        .maybeSingle());
    }
    if (!payment) {
      // Not one of ours (e.g. another integration on the same Paystack account).
      return text("Ignored: no matching payment");
    }

    if (payment.status !== "succeeded") {
      // The signature proves Paystack sent this, but check the transaction with Paystack's
      // API as well, with the same rules as paystack-verify.
      const paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } }
      );
      const paystack = await paystackResponse.json();
      if (!paystackResponse.ok || !paystack.status) {
        return text(`Paystack: ${paystack.message ?? "could not verify payment"}`, 502); // retried
      }

      const transaction = paystack.data;
      if (transaction.status !== "success") {
        return text(`Ignored: transaction status ${transaction.status}`);
      }
      const expectedCents = Math.round(Number(payment.amount) * 100);
      if (transaction.currency !== "ZAR" || Number(transaction.amount) !== expectedCents) {
        await adminClient.from("payments").update({ status: "failed" }).eq("task_id", payment.task_id);
        console.error(`paystack-webhook: amount/currency mismatch for ${reference}`);
        return text("Ignored: amount or currency doesn't match this task");
      }

      const { error: paymentUpdateError } = await adminClient
        .from("payments")
        .update({ status: "succeeded", reference })
        .eq("task_id", payment.task_id)
        .neq("status", "succeeded");
      if (paymentUpdateError) return text(paymentUpdateError.message, 500);
    }

    // Also done when the payment was already marked succeeded, in case whoever marked it
    // stopped before completing the task. Repeating this is harmless.
    const { error: taskUpdateError } = await adminClient
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", payment.task_id)
      .neq("status", "completed");
    if (taskUpdateError) return text(taskUpdateError.message, 500);

    return text("ok");
  } catch (err) {
    console.error("paystack-webhook:", err);
    return text(err instanceof Error ? err.message : "Unexpected error", 500);
  }
});

async function isValidSignature(body: string, signature: string, secretKey: string): Promise<boolean> {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expected, signature.toLowerCase());
}

// Compares in time independent of where the strings differ, so the signature can't be guessed
// byte by byte from response timings.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

// Paystack echoes back the metadata given at initialize, usually as an object but sometimes
// as a JSON string.
function taskIdFromMetadata(metadata: unknown): string | null {
  let value = metadata;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const taskId = (value as { task_id?: unknown } | null)?.task_id;
  return typeof taskId === "string" ? taskId : null;
}

function text(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain" } });
}
