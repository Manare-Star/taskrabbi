// Supabase Edge Function (Deno runtime). Deploy with:
//   supabase functions deploy confirm-payment
// Called by the app right after the Stripe Payment Sheet reports success. It re-checks
// the PaymentIntent status directly with Stripe (never trusts the client's word alone)
// before marking the payment + task as complete.
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

    const { taskId, paymentIntentId } = await req.json();
    if (!taskId || !paymentIntentId) {
      return json({ error: "taskId and paymentIntentId are required" }, 400);
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("*, task:tasks(client_id)")
      .eq("task_id", taskId)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .single();
    if (paymentError || !payment) {
      return json({ error: "Payment record not found" }, 404);
    }
    if ((payment.task as { client_id: string }).client_id !== user.id) {
      return json({ error: "Only the task's client can confirm this payment" }, 403);
    }

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== "succeeded") {
      return json({ error: `Payment not completed yet (status: ${intent.status})` }, 400);
    }

    const { error: paymentUpdateError } = await adminClient
      .from("payments")
      .update({ status: "succeeded" })
      .eq("task_id", taskId);
    if (paymentUpdateError) return json({ error: paymentUpdateError.message }, 500);

    const { error: taskUpdateError } = await adminClient
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", taskId);
    if (taskUpdateError) return json({ error: taskUpdateError.message }, 500);

    return json({ status: "completed" });
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
