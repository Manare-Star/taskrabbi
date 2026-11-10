import { useMutation } from "@tanstack/react-query";
import { supabase } from "../supabase";

// Remove every file in a storage folder. Best effort: a leftover image must not stop
// someone deleting their account.
async function emptyFolder(bucket: string, folder: string) {
  try {
    const { data: files } = await supabase.storage.from(bucket).list(folder);
    if (!files?.length) return;
    await supabase.storage.from(bucket).remove(files.map((file) => `${folder}/${file.name}`));
  } catch (error) {
    console.warn(`Couldn't clear ${bucket}/${folder}:`, error);
  }
}

// Permanently deletes the signed-in user's account. The database refuses while they have a
// job in progress (see delete_my_account in migration 0020); that message reaches the UI.
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async (userId: string) => {
      // The database has the final say, but ask first: the photos below are deleted before
      // the account is, and must survive if the deletion is going to be refused.
      const [{ data: tasks, error: tasksError }, { data: jobs, error: jobsError }] = await Promise.all([
        supabase.from("tasks").select("id, status").eq("client_id", userId),
        supabase.from("bids").select("id, task:tasks!inner(status)").eq("tasker_id", userId).eq("status", "accepted").eq("task.status", "assigned"),
      ]);
      if (tasksError) throw tasksError;
      if (jobsError) throw jobsError;
      if (tasks?.some((task) => task.status === "assigned") || jobs?.length) {
        throw new Error("You have a job in progress. Finish or cancel it before deleting your account.");
      }

      // Photos first, while we still have a session that's allowed to delete them. Database
      // rows can't take storage objects with them.
      await Promise.all([
        emptyFolder("avatars", userId),
        ...(tasks ?? []).map((task) => emptyFolder("task-images", task.id)),
      ]);

      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;

      // The account is gone server-side; drop the local session without calling the server
      // (which would now reject the token).
      await supabase.auth.signOut({ scope: "local" });
    },
  });
}
