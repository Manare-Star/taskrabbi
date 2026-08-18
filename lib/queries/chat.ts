import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { ChatMessage, ChatThread, Profile, Task } from "../types";

type ThreadWithDetails = ChatThread & {
  task: Task;
  client: Pick<Profile, "id" | "full_name" | "avatar_url">;
  tasker: Pick<Profile, "id" | "full_name" | "avatar_url">;
};

export function useMyThreads(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-threads", userId],
    queryFn: async (): Promise<(ChatThread & { task: Task })[]> => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("*, task:tasks(*)")
        .or(`client_id.eq.${userId},tasker_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (ChatThread & { task: Task })[];
    },
    enabled: !!userId,
  });
}

export function useThreadForTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ["thread-for-task", taskId],
    queryFn: async (): Promise<ChatThread | null> => {
      const { data, error } = await supabase.from("chat_threads").select("*").eq("task_id", taskId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
}

export function useThread(threadId: string | undefined) {
  return useQuery({
    queryKey: ["thread", threadId],
    queryFn: async (): Promise<ThreadWithDetails> => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select(
          "*, task:tasks(*), client:profiles!chat_threads_client_id_fkey(id, full_name, avatar_url), tasker:profiles!chat_threads_tasker_id_fkey(id, full_name, avatar_url)"
        )
        .eq("id", threadId)
        .single();
      if (error) throw error;
      return data as unknown as ThreadWithDetails;
    },
    enabled: !!threadId,
  });
}

export function useThreadMessages(threadId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!threadId,
  });

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`chat_messages:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          queryClient.setQueryData<ChatMessage[]>(
            ["thread-messages", threadId],
            (existing: ChatMessage[] | undefined) => {
              const incoming = payload.new as ChatMessage;
              if (existing?.some((m: ChatMessage) => m.id === incoming.id)) return existing;
              return [...(existing ?? []), incoming];
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { threadId: string; senderId: string; body: string }) => {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({ thread_id: input.threadId, sender_id: input.senderId, body: input.body })
        .select()
        .single();
      if (error) throw error;
      return data as ChatMessage;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(
        ["thread-messages", message.thread_id],
        (existing: ChatMessage[] | undefined) => {
          if (existing?.some((m: ChatMessage) => m.id === message.id)) return existing;
          return [...(existing ?? []), message];
        }
      );
    },
  });
}
