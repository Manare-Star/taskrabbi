import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { uploadImageFromUri } from "../storage";
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

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; imageUri: string }) => {
      const extension = input.imageUri.split(".").pop() ?? "jpg";
      const avatarUrl = await uploadImageFromUri("avatars", `${input.userId}/avatar.${extension}`, input.imageUri);
      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
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
