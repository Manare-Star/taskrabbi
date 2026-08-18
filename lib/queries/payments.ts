import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { Payment } from "../types";

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
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

// Calls the create-payment-intent Edge Function, which uses the Stripe secret key
// (never present in the app) to create a PaymentIntent server-side.
export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: async (taskId: string): Promise<PaymentIntentResponse> => {
      const { data, error } = await supabase.functions.invoke<PaymentIntentResponse>("create-payment-intent", {
        body: { taskId },
      });
      if (error) throw error;
      if (!data) throw new Error("No response from create-payment-intent");
      return data;
    },
  });
}

// Calls the confirm-payment Edge Function, which re-checks the PaymentIntent status with
// Stripe directly (rather than trusting the client) before marking payment + task complete.
export function useConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; paymentIntentId: string }) => {
      const { data, error } = await supabase.functions.invoke("confirm-payment", { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["task", variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["my-posted-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["payment-for-task", variables.taskId] });
    },
  });
}
