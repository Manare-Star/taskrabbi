import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import type { NearbyTask, Task } from "../types";

export function useNearbyTasks(params: {
  lat: number | null;
  lng: number | null;
  radiusMeters?: number;
  category?: string | null;
}) {
  const { lat, lng, radiusMeters = 20000, category = null } = params;
  return useQuery({
    queryKey: ["nearby-tasks", lat, lng, radiusMeters, category],
    queryFn: async (): Promise<NearbyTask[]> => {
      const { data, error } = await supabase.rpc("nearby_open_tasks", {
        lat,
        lng,
        radius_meters: radiusMeters,
        category_filter: category,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: lat !== null && lng !== null,
  });
}

export function useTask(taskId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["task", taskId],
    queryFn: async (): Promise<Task> => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`task:${taskId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${taskId}` },
        (payload) => queryClient.setQueryData(["task", taskId], payload.new as Task)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);

  return query;
}

export function useMyPostedTasks(clientId: string | undefined) {
  return useQuery({
    queryKey: ["my-posted-tasks", clientId],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });
}

interface NewTaskInput {
  clientId: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  addressText: string;
  lat: number;
  lng: number;
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTaskInput) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          client_id: input.clientId,
          title: input.title,
          description: input.description,
          category: input.category,
          budget: input.budget,
          address_text: input.addressText,
          // PostGIS geography(Point) accepts WKT via the PostgREST text cast
          location: `SRID=4326;POINT(${input.lng} ${input.lat})`,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-posted-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nearby-tasks"] });
    },
  });
}

export function useCancelTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").update({ status: "cancelled" }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-posted-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nearby-tasks"] });
    },
  });
}
