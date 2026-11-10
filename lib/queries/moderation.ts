import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { BlockedUser, ReportReason } from "../types";

// People the signed-in user has blocked. (Nobody can see who has blocked them.)
export function useBlockedUsers(userId: string | undefined) {
  return useQuery({
    queryKey: ["blocked-users", userId],
    queryFn: async (): Promise<BlockedUser[]> => {
      const { data, error } = await supabase
        .from("user_blocks")
        .select("blocked_id, created_at, blocked:profiles!user_blocks_blocked_id_fkey(id, full_name, avatar_url)")
        .eq("blocker_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BlockedUser[];
    },
    enabled: !!userId,
  });
}

export function isBlocked(blocked: BlockedUser[] | undefined, userId: string | undefined): boolean {
  return !!userId && !!blocked?.some((entry) => entry.blocked_id === userId);
}

function invalidateAfterBlockChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
  // Blocking hides the other person's tasks from Browse.
  queryClient.invalidateQueries({ queryKey: ["nearby-tasks"] });
}

// Stops bids and messages between the two people, in both directions.
export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { blockerId: string; blockedId: string }) => {
      const { error } = await supabase
        .from("user_blocks")
        .upsert({ blocker_id: input.blockerId, blocked_id: input.blockedId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => invalidateAfterBlockChange(queryClient),
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { blockerId: string; blockedId: string }) => {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", input.blockerId)
        .eq("blocked_id", input.blockedId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAfterBlockChange(queryClient),
  });
}

// Files a report for the operator to review. At least one of reportedUserId / taskId.
export function useSubmitReport() {
  return useMutation({
    mutationFn: async (input: {
      reporterId: string;
      reportedUserId?: string;
      taskId?: string;
      reason: ReportReason;
      details: string;
    }) => {
      const { error } = await supabase.from("reports").insert({
        reporter_id: input.reporterId,
        reported_user_id: input.reportedUserId ?? null,
        task_id: input.taskId ?? null,
        reason: input.reason,
        details: input.details.trim() || null,
      });
      if (error) throw error;
    },
  });
}
