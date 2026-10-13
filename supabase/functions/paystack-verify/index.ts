// Supabase Edge Function (Deno runtime): confirms a Paystack payment and completes the task.
//
// Called by the app after Paystack's checkout redirects back. It re-checks the transaction
// with Paystack directly (never trusting the client's word), including currency and the exact
// amount, before marking the payment and task complete. Needs the same PAYSTACK_SECRET_KEY
// secret as paystack-initialize.
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { taskId, reference } = await req.json();
    if (!taskId || !reference) {
      return json({ error: "taskId and reference are required" }, 400);
    }

    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("*, task:tasks(client_id)")
      .eq("task_id", taskId)
      .eq("reference", reference)
      .single();
    if (paymentError || !payment) {
      return json({ error: "Payment record not found" }, 404);
    }
    if ((payment.task as { client_id: string }).client_id !== user.id) {
      return json({ error: "Only the task's client can confirm this payment" }, 403);
    }
    if (payment.status === "succeeded") {
      return json({ status: "completed" });
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const paystack = await paystackResponse.json();
    if (!paystackResponse.ok || !paystack.status) {
      return json({ error: `Paystack: ${paystack.message ?? "could not verify payment"}` }, 502);
    }

    const transaction = paystack.data;
    if (transaction.status !== "success") {
      // abandoned / failed / ongoing — leave the task assigned so the client can try again.
      return json({ error: `Payment not completed (status: ${transaction.status})` }, 400);
    }
    const expectedCents = Math.round(Number(payment.amount) * 100);
    if (transaction.currency !== "ZAR" || Number(transaction.amount) !== expectedCents) {
      await adminClient.from("payments").update({ status: "failed" }).eq("task_id", taskId);
      return json({ error: "Paid amount or currency doesn't match this task" }, 400);
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
