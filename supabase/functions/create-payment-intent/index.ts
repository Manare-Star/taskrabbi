// Supabase Edge Function (Deno runtime). Deploy with:
//   supabase functions deploy create-payment-intent
// Requires one secret that is NEVER put in the app or committed to git:
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import Stripe from "npm:stripe@16";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const amountCents = Math.round(Number(acceptedBid.amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "zar",
      automatic_payment_methods: { enabled: true },
      metadata: { taskId, clientId: user.id },
    });

    const { error: upsertError } = await adminClient.from("payments").upsert(
      {
        task_id: taskId,
        stripe_payment_intent_id: paymentIntent.id,
        amount: acceptedBid.amount,
        status: "pending",
      },
      { onConflict: "task_id" }
    );
    if (upsertError) {
      return json({ error: upsertError.message }, 500);
    }

    return json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: acceptedBid.amount,
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
