import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { Profile } from "../types";

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; fullName: string; bio: string }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ full_name: input.fullName, bio: input.bio })
        .eq("id", input.userId)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["profile", profile.id] });
    },
  });
}
