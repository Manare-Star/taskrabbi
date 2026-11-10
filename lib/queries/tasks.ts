import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { realtimeChannel, supabase } from "../supabase";
import { uploadImageFromUri } from "../storage";
import { SEARCH_RADIUS_METERS } from "../config";
import type { NearbyTask, Task, TaskPrivateDetails } from "../types";

// The columns of `tasks` the app is allowed to read. The street address and coordinates are
// not among them (migration 0021), so `select("*")` on tasks is refused: always select this.
export const TASK_COLUMNS =
  "id, client_id, title, description, category, budget, status, area_text, image_url, scheduled_for, tasker_done_at, created_at, updated_at";

export function useNearbyTasks(params: {
  lat: number | null;
  lng: number | null;
  radiusMeters?: number;
  category?: string | null;
}) {
  const { lat, lng, radiusMeters = SEARCH_RADIUS_METERS, category = null } = params;
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
    queryFn: async (): Promise<Task | null> => {
      const { data, error } = await supabase.from("tasks").select(TASK_COLUMNS).eq("id", taskId).maybeSingle();
      if (error) throw error;
      return data as Task | null;
    },
    enabled: !!taskId,
  });

  useEffect(() => {
    if (!taskId) return;
    const channel = realtimeChannel(`task:${taskId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${taskId}` },
        // Merge rather than replace: the payload only carries the columns we may read.
        (payload) =>
          queryClient.setQueryData<Task | null>(["task", taskId], (current) =>
            current ? { ...current, ...(payload.new as Partial<Task>) } : current
          )
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);

  return query;
}

// The exact address and coordinates. Returns null unless the caller is the task's client or
// the tasker whose bid was accepted; pass `enabled` so nobody else even asks.
export function useTaskPrivateDetails(taskId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["task-private", taskId],
    queryFn: async (): Promise<TaskPrivateDetails | null> => {
      const { data, error } = await supabase.rpc("task_private_details", { p_task_id: taskId });
      if (error) throw error;
      return ((data ?? []) as TaskPrivateDetails[])[0] ?? null;
    },
    enabled: !!taskId && enabled,
  });
}

export function useMyPostedTasks(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-posted-tasks", clientId],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select(TASK_COLUMNS)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!clientId,
  });

  // A bid being accepted, a tasker finishing or a payment landing all change my tasks'
  // statuses from somewhere else; keep the list current without a pull-to-refresh.
  useEffect(() => {
    if (!clientId) return;
    const channel = realtimeChannel(`my-posted-tasks:${clientId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `client_id=eq.${clientId}` },
        () => queryClient.invalidateQueries({ queryKey: ["my-posted-tasks", clientId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  return query;
}

export interface NewTaskInput {
  clientId: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  // Public: the suburb or town.
  areaText: string;
  // Private: shared only with the tasker who gets hired.
  addressText: string;
  lat: number;
  lng: number;
  imageUri?: string;
  scheduledFor?: string;
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewTaskInput): Promise<Task> => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          client_id: input.clientId,
          title: input.title,
          description: input.description,
          category: input.category,
          budget: input.budget,
          area_text: input.areaText,
          address_text: input.addressText,
          // PostGIS geography(Point) accepts EWKT through PostgREST's text cast.
          location: `SRID=4326;POINT(${input.lng} ${input.lat})`,
          scheduled_for: input.scheduledFor ?? null,
        })
        .select(TASK_COLUMNS)
        .single();
      if (error) throw error;
      let task = data as Task;

      if (input.imageUri) {
        // The task exists either way; a failed photo upload shouldn't lose the post.
        try {
          const extension = input.imageUri.split(".").pop()?.split("?")[0] ?? "jpg";
          const imageUrl = await uploadImageFromUri("task-images", `${task.id}/photo.${extension}`, input.imageUri);
          const { data: updated, error: updateError } = await supabase
            .from("tasks")
            .update({ image_url: imageUrl })
            .eq("id", task.id)
            .select(TASK_COLUMNS)
            .single();
          if (updateError) throw updateError;
          task = updated as Task;
        } catch (uploadError) {
          console.warn("Task posted, but its photo didn't upload:", uploadError);
        }
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-posted-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nearby-tasks"] });
    },
  });
}

function invalidateTask(queryClient: ReturnType<typeof useQueryClient>, taskId: string) {
  queryClient.invalidateQueries({ queryKey: ["task", taskId] });
  queryClient.invalidateQueries({ queryKey: ["my-posted-tasks"] });
  queryClient.invalidateQueries({ queryKey: ["my-bids"] });
  queryClient.invalidateQueries({ queryKey: ["nearby-tasks"] });
  queryClient.invalidateQueries({ queryKey: ["my-threads"] });
}

// Cancels an open task (its client) or a job in progress (either side, before payment).
export function useCancelTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.rpc("cancel_task", { p_task_id: taskId });
      if (error) throw error;
    },
    onSuccess: (_data, taskId) => invalidateTask(queryClient, taskId),
  });
}

// The hired tasker says the work is finished; the client is prompted to pay.
export function useMarkTaskDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.rpc("mark_task_done", { p_task_id: taskId });
      if (error) throw error;
    },
    onSuccess: (_data, taskId) => invalidateTask(queryClient, taskId),
  });
}
