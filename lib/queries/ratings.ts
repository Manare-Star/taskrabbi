import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { Profile, Rating } from "../types";

export type RatingWithRater = Rating & { rater: Pick<Profile, "id" | "full_name" | "avatar_url"> };

export function useRatingsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ["ratings-for-user", userId],
    queryFn: async (): Promise<RatingWithRater[]> => {
      const { data, error } = await supabase
        .from("ratings")
        .select("*, rater:profiles!ratings_rater_id_fkey(id, full_name, avatar_url)")
        .eq("ratee_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RatingWithRater[];
    },
    enabled: !!userId,
  });
}

export function useMyRatingForTask(taskId: string | undefined, raterId: string | undefined) {
  return useQuery({
    queryKey: ["my-rating", taskId, raterId],
    queryFn: async (): Promise<Rating | null> => {
      const { data, error } = await supabase
        .from("ratings")
        .select("*")
        .eq("task_id", taskId)
        .eq("rater_id", raterId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId && !!raterId,
  });
}

export function useSubmitRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; rateeId: string; stars: number; comment?: string }) => {
      const { data, error } = await supabase.rpc("submit_rating", {
        p_task_id: input.taskId,
        p_ratee_id: input.rateeId,
        p_stars: input.stars,
        p_comment: input.comment ?? null,
      });
      if (error) throw error;
      return data as Rating;
    },
    onSuccess: (rating) => {
      queryClient.invalidateQueries({ queryKey: ["my-rating", rating.task_id, rating.rater_id] });
      queryClient.invalidateQueries({ queryKey: ["profile", rating.ratee_id] });
      queryClient.invalidateQueries({ queryKey: ["ratings-for-user", rating.ratee_id] });
    },
  });
}
