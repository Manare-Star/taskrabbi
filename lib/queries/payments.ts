import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type { Payment } from "../types";

// supabase.functions.invoke reports any non-2xx as a generic "Edge Function returned a
// non-2xx status code"; the function's own { error } message is in the response body.
async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      if (payload?.error) throw new Error(payload.error);
    }
    throw error;
  }
  if (!data) throw new Error(`No response from ${name}`);
  return data;
}

export interface PaystackCheckout {
  authorizationUrl: string;
  reference: string;
  amount: number;
  // Paystack redirects here when checkout ends; the app intercepts these, never loads them.
  callbackUrl: string;
  cancelUrl: string;
  // True when the server is using a Paystack test key (no real money moves).
  testMode?: boolean;
}

export function usePaymentForTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ["payment-for-task", taskId],
    queryFn: async (): Promise<Payment | null> => {
      const { data, error } = await supabase.from("payments").select("*").eq("task_id", taskId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
}

// The paystack-initialize Edge Function holds the Paystack secret key (never in the app)
// and returns a hosted checkout page for the accepted bid's amount.
//
// Each call starts a new Paystack transaction, so this runs once when the checkout screen
// opens and never refetches by itself (no retry, focus or reconnect refetch, and nothing
// cached for the next visit). `refetch` starts a fresh one after a failure.
export function usePaystackCheckout(taskId: string | undefined) {
  return useQuery({
    queryKey: ["paystack-checkout", taskId],
    queryFn: () => invokeFunction<PaystackCheckout>("paystack-initialize", { taskId }),
    enabled: !!taskId,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

// paystack-verify re-checks the transaction with Paystack directly (rather than trusting the
// client) before marking the payment and task complete.
export function useVerifyPaystackPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; reference: string }) =>
      invokeFunction<{ status: string }>("paystack-verify", input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["my-posted-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["payment-for-task", variables.taskId] });
    },
  });
}
