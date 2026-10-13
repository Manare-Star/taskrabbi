export type UserRole = "client" | "tasker" | "both";
export type TaskStatus = "open" | "assigned" | "completed" | "cancelled";
export type BidStatus = "pending" | "accepted" | "rejected";
export type PaymentStatus = "pending" | "succeeded" | "failed";

export const TASK_CATEGORIES = [
  "Furniture Assembly",
  "Moving Help",
  "Cleaning",
  "Handyman",
  "Delivery",
  "Yard Work",
  "Mounting & Installation",
  "Other",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  bio: string | null;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface Task {
  id: string;
  client_id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  status: TaskStatus;
  address_text: string;
  image_url: string | null;
  // When the client needs it done (migration 0014); null/absent means flexible timing.
  scheduled_for?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NearbyTask extends Task {
  distance_meters: number;
  // Returned by nearby_open_tasks from migration 0012 onward; absent on older databases.
  task_lat?: number | null;
  task_lng?: number | null;
}

export interface Bid {
  id: string;
  task_id: string;
  tasker_id: string;
  amount: number;
  message: string | null;
  status: BidStatus;
  created_at: string;
}

export interface BidWithTasker extends Bid {
  tasker: Pick<Profile, "id" | "full_name" | "avatar_url" | "rating_avg" | "rating_count">;
}

export interface ChatThread {
  id: string;
  task_id: string;
  client_id: string;
  tasker_id: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface Payment {
  id: string;
  task_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  status: PaymentStatus;
  created_at: string;
}

export interface Rating {
  id: string;
  task_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}
