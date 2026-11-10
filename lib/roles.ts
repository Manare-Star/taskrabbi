import type { UserRole } from "./types";

// How someone's role reads on a profile.
export const ROLE_LABEL: Record<UserRole, string> = {
  client: "Posts tasks",
  tasker: "Tasker",
  both: "Posts tasks and takes on work",
};

export const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: "client", label: "I need help", description: "Post tasks and hire taskers" },
  { value: "tasker", label: "I want to work", description: "Browse and bid on tasks" },
  { value: "both", label: "Both", description: "Post tasks and take on jobs" },
];
