import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { realtimeChannel, supabase } from "../supabase";
import type { ChatMessage, ChatThread, Profile, Task } from "../types";

const PARTICIPANTS_SELECT =
  "client:profiles!chat_threads_client_id_fkey(id, full_name, avatar_url), tasker:profiles!chat_threads_tasker_id_fkey(id, full_name, avatar_url)";

type ThreadWithDetails = ChatThread & {
  task: Task;
  client: Pick<Profile, "id" | "full_name" | "avatar_url">;
  tasker: Pick<Profile, "id" | "full_name" | "avatar_url">;
};

export type InboxThread = ThreadWithDetails & { lastMessage: ChatMessage | null };

function lastActivity(thread: InboxThread): number {
  return new Date(thread.lastMessage?.created_at ?? thread.created_at).getTime();
}

export function useMyThreads(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-threads", userId],
    queryFn: async (): Promise<InboxThread[]> => {
      // One round trip: each thread with its participants and only its newest message.
      const { data, error } = await supabase
        .from("chat_threads")
        .select(`*, task:tasks(*), ${PARTICIPANTS_SELECT}, chat_messages(id, thread_id, sender_id, body, created_at)`)
        .or(`client_id.eq.${userId},tasker_id.eq.${userId}`)
        .order("created_at", { referencedTable: "chat_messages", ascending: false })
        .limit(1, { referencedTable: "chat_messages" });
      if (error) throw error;

      const rows = (data ?? []) as unknown as (ThreadWithDetails & { chat_messages: ChatMessage[] | null })[];
      return rows
        .map(({ chat_messages, ...thread }) => ({ ...thread, lastMessage: chat_messages?.[0] ?? null }))
        .sort((a, b) => lastActivity(b) - lastActivity(a));
    },
    enabled: !!userId,
  });

  // Any new message in one of my threads should reorder the inbox and update its preview.
  // RLS scopes the realtime stream to threads this user can read.
  useEffect(() => {
    if (!userId) return;
    const channel = realtimeChannel(`inbox:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () =>
        queryClient.invalidateQueries({ queryKey: ["my-threads", userId] })
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_threads" }, () =>
        queryClient.invalidateQueries({ queryKey: ["my-threads", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
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
        .select(`*, task:tasks(*), ${PARTICIPANTS_SELECT}`)
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

    const channel = realtimeChannel(`chat_messages:${threadId}`)
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
      queryClient.invalidateQueries({ queryKey: ["my-threads"] });
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

// Unread message count per thread ({ [threadId]: count }, only threads with unread). Live:
// any new message in my threads (realtime is RLS-scoped to them) triggers a recount.
export function useUnreadCounts(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["unread-counts", userId],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc("my_unread_counts");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { thread_id: string; unread: number }[]) {
        counts[row.thread_id] = Number(row.unread);
      }
      return counts;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = realtimeChannel(`unread:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () =>
        queryClient.invalidateQueries({ queryKey: ["unread-counts", userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

export function totalUnread(counts: Record<string, number> | undefined): number {
  return Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0);
}

export function useMarkThreadRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase.rpc("mark_thread_read", { p_thread_id: threadId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["unread-counts"] }),
  });
}
