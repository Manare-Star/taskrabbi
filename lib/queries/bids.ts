import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { realtimeChannel, supabase } from "../supabase";
import type { Bid, BidWithTasker, ChatThread, Task } from "../types";
import { TASK_COLUMNS } from "./tasks";

export function useBidsForTask(taskId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["bids-for-task", taskId],
    queryFn: async (): Promise<BidWithTasker[]> => {
      const { data, error } = await supabase
        .from("bids")
        .select("*, tasker:profiles!bids_tasker_id_fkey(id, full_name, avatar_url, rating_avg, rating_count)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BidWithTasker[];
    },
    enabled: !!taskId,
  });

  useEffect(() => {
    if (!taskId) return;
    const channel = realtimeChannel(`bids-for-task:${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bids", filter: `task_id=eq.${taskId}` },
        () => queryClient.invalidateQueries({ queryKey: ["bids-for-task", taskId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);

  return query;
}

export function useMyBidOnTask(taskId: string | undefined, taskerId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-bid", taskId, taskerId],
    queryFn: async (): Promise<Bid | null> => {
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("task_id", taskId)
        .eq("tasker_id", taskerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId && !!taskerId,
  });

  useEffect(() => {
    if (!taskId || !taskerId) return;
    const channel = realtimeChannel(`my-bid:${taskId}:${taskerId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bids", filter: `task_id=eq.${taskId}` },
        (payload) => {
          const updated = payload.new as Bid;
          if (updated.tasker_id === taskerId) {
            queryClient.setQueryData(["my-bid", taskId, taskerId], updated);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, taskerId, queryClient]);

  return query;
}

export function useMyBids(taskerId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-bids", taskerId],
    queryFn: async (): Promise<(Bid & { task: Task })[]> => {
      const { data, error } = await supabase
        .from("bids")
        .select(`*, task:tasks(${TASK_COLUMNS})`)
        .eq("tasker_id", taskerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (Bid & { task: Task })[];
    },
    enabled: !!taskerId,
  });

  useEffect(() => {
    if (!taskerId) return;
    const channel = realtimeChannel(`my-bids:${taskerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bids", filter: `tasker_id=eq.${taskerId}` },
        () => queryClient.invalidateQueries({ queryKey: ["my-bids", taskerId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskerId, queryClient]);

  return query;
}

// Places a bid. There's one bid row per tasker per task, so bidding again after withdrawing
// (pass the withdrawn bid's id) revives that row with the new amount and message.
export function usePlaceBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      taskerId: string;
      amount: number;
      message: string;
      withdrawnBidId?: string;
    }) => {
      const message = input.message.trim() || null;
      const request = input.withdrawnBidId
        ? supabase
            .from("bids")
            .update({ amount: input.amount, message, status: "pending" })
            .eq("id", input.withdrawnBidId)
        : supabase
            .from("bids")
            .insert({ task_id: input.taskId, tasker_id: input.taskerId, amount: input.amount, message });
      const { data, error } = await request.select().single();
      if (error) throw error;
      return data as Bid;
    },
    onSuccess: (bid, variables) => {
      queryClient.setQueryData(["my-bid", variables.taskId, variables.taskerId], bid);
      queryClient.invalidateQueries({ queryKey: ["bids-for-task", variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ["my-bids", variables.taskerId] });
    },
  });
}

// Takes a pending bid back. The tasker can bid again while the task is still open.
export function useWithdrawBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bid: Pick<Bid, "id" | "task_id" | "tasker_id">) => {
      const { data, error } = await supabase
        .from("bids")
        .update({ status: "withdrawn" })
        .eq("id", bid.id)
        .select()
        .single();
      if (error) throw error;
      return data as Bid;
    },
    onSuccess: (bid) => {
      queryClient.setQueryData(["my-bid", bid.task_id, bid.tasker_id], bid);
      queryClient.invalidateQueries({ queryKey: ["bids-for-task", bid.task_id] });
      queryClient.invalidateQueries({ queryKey: ["my-bids", bid.tasker_id] });
    },
  });
}

export function useAcceptBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bidId: string): Promise<ChatThread> => {
      const { data, error } = await supabase.rpc("accept_bid", { bid_id: bidId });
      if (error) throw error;
      return data as ChatThread;
    },
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ["bids-for-task", thread.task_id] });
      queryClient.invalidateQueries({ queryKey: ["task", thread.task_id] });
      queryClient.invalidateQueries({ queryKey: ["thread-for-task", thread.task_id] });
      queryClient.invalidateQueries({ queryKey: ["my-posted-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-threads"] });
    },
  });
}
