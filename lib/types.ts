export type UserRole = "client" | "tasker" | "both";
export type TaskStatus = "open" | "assigned" | "completed" | "cancelled";
export type BidStatus = "pending" | "accepted" | "rejected" | "withdrawn";
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
  // The suburb or town, shown to everyone. The street address and exact coordinates aren't
  // part of a task as the app reads it (migration 0021): see TaskPrivateDetails.
  area_text: string;
  image_url: string | null;
  // When the client needs it done; null means flexible timing.
  scheduled_for: string | null;
  // Set when the hired tasker says the work is finished (the client then pays to complete).
  tasker_done_at: string | null;
  created_at: string;
  updated_at: string;
}

// Exact location: readable only by the task's client and the tasker they hired.
export interface TaskPrivateDetails {
  address_text: string;
  lat: number;
  lng: number;
}

// A row from the Browse search. The position is approximate (snapped to a ~500 m grid) and
// the distance is measured to that approximate point.
export type NearbyTask = Omit<Task, "tasker_done_at" | "updated_at"> & {
  distance_meters: number;
  task_lat: number;
  task_lng: number;
};

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
  // Paystack transaction reference (migration 0015; previously a Stripe PaymentIntent id).
  reference: string;
  amount: number;
  status: PaymentStatus;
  created_at: string;
}

export type NotificationKind =
  | "new_bid"
  | "bid_accepted"
  | "bid_rejected"
  | "task_paid"
  | "new_review"
  | "task_done"
  | "task_cancelled";

// Activity feed entry, written by database triggers (migration 0016).
export interface AppNotification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  task_id: string | null;
  actor_id: string | null;
  read_at: string | null;
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

export const REPORT_REASONS = [
  { value: "scam_or_fraud", label: "Scam or fraud", hint: "Asking for money outside the app, fake task" },
  { value: "harassment", label: "Harassment or abuse", hint: "Threats, insults, unwanted contact" },
  { value: "safety_concern", label: "Safety concern", hint: "Something that puts a person at risk" },
  { value: "inappropriate_content", label: "Inappropriate content", hint: "Offensive photos or language" },
  { value: "spam", label: "Spam", hint: "Advertising, repeated or irrelevant posts" },
  { value: "other", label: "Something else", hint: "Tell us what happened" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export interface BlockedUser {
  blocked_id: string;
  created_at: string;
  blocked: Pick<Profile, "id" | "full_name" | "avatar_url">;
}
