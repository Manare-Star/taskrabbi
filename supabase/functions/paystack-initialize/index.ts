// Supabase Edge Function (Deno runtime): starts a Paystack payment for an assigned task.
//
// Requires one secret, set under Edge Functions > Secrets in the Supabase dashboard and
// NEVER put in the app or committed to git:
//   PAYSTACK_SECRET_KEY = sk_test_...  (from Paystack dashboard > Settings > API Keys)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from "npm:@supabase/supabase-js@2";

// Paystack sends the browser to these after checkout. They're never actually loaded:
// the app's in-app browser intercepts navigation to them and closes itself.
const CALLBACK_URL = "https://taskrabbit-clone.invalid/paystack/callback";
const CANCEL_URL = "https://taskrabbit-clone.invalid/paystack/cancel";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secretKey) {
      return json({ error: "PAYSTACK_SECRET_KEY is not configured on the server" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    // Client scoped to the caller's JWT, used only to identify who is asking.
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Invalid session" }, 401);
    }
    if (!user.email) {
      return json({ error: "Your account needs an email address to pay" }, 400);
    }

    const { taskId } = await req.json();
    if (!taskId) {
      return json({ error: "taskId is required" }, 400);
    }

    // Service-role client to read across RLS and to write the payments row.
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: task, error: taskError } = await adminClient
      .from("tasks")
      .select("id, client_id, status")
      .eq("id", taskId)
      .single();
    if (taskError || !task) {
      return json({ error: "Task not found" }, 404);
    }
    if (task.client_id !== user.id) {
      return json({ error: "Only the task's client can pay for it" }, 403);
    }
    if (task.status !== "assigned") {
      return json({ error: "Task must be assigned to a tasker before paying" }, 400);
    }

    const { data: acceptedBid, error: bidError } = await adminClient
      .from("bids")
      .select("amount")
      .eq("task_id", taskId)
      .eq("status", "accepted")
      .single();
    if (bidError || !acceptedBid) {
      return json({ error: "No accepted bid found for this task" }, 400);
    }

    // Paystack amounts are in the currency's subunit: cents for ZAR.
    const amountCents = Math.round(Number(acceptedBid.amount) * 100);
    const reference = `task-${taskId}-${crypto.randomUUID()}`;

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: amountCents,
        currency: "ZAR",
        reference,
        callback_url: CALLBACK_URL,
        metadata: { task_id: taskId, client_id: user.id, cancel_action: CANCEL_URL },
      }),
    });
    const paystack = await paystackResponse.json();
    if (!paystackResponse.ok || !paystack.status) {
      return json({ error: `Paystack: ${paystack.message ?? "could not start payment"}` }, 502);
    }

    const { error: upsertError } = await adminClient.from("payments").upsert(
      { task_id: taskId, reference, amount: acceptedBid.amount, status: "pending" },
      { onConflict: "task_id" }
    );
    if (upsertError) {
      return json({ error: upsertError.message }, 500);
    }

    return json({
      authorizationUrl: paystack.data.authorization_url,
      reference,
      amount: acceptedBid.amount,
      callbackUrl: CALLBACK_URL,
      cancelUrl: CANCEL_URL,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
