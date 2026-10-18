// A task's timing is either "flexible" or a day plus a part of the day. It's stored as a
// single timestamp (tasks.scheduled_for) at the slot's start hour, so the slot can be read
// back from the hour.
export type SlotKey = "morning" | "afternoon" | "evening";

export interface Slot {
  key: SlotKey;
  label: string;
  startHour: number;
  hours: string;
}

export const SLOTS: Slot[] = [
  { key: "morning", label: "Morning", startHour: 8, hours: "8am–12pm" },
  { key: "afternoon", label: "Afternoon", startHour: 12, hours: "12–5pm" },
  { key: "evening", label: "Evening", startHour: 17, hours: "5–8pm" },
];

export type ScheduleValue = { day: null } | { day: Date; slot: SlotKey };

export const FLEXIBLE: ScheduleValue = { day: null };

// How far ahead the picker offers days.
export const DAYS_AHEAD = 14;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function upcomingDays(from = new Date()): Date[] {
  const today = startOfDay(from);
  return Array.from({ length: DAYS_AHEAD }, (_, offset) => {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    return day;
  });
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function dayLabel(day: Date, now = new Date()): string {
  const today = startOfDay(now);
  const diff = Math.round((startOfDay(day).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return day.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export function toScheduledFor(value: ScheduleValue): string | undefined {
  if (value.day === null) return undefined;
  const slot = SLOTS.find((s) => s.key === value.slot) ?? SLOTS[0];
  const at = new Date(value.day);
  at.setHours(slot.startHour, 0, 0, 0);
  return at.toISOString();
}

function slotForHour(hour: number): Slot {
  if (hour >= 17) return SLOTS[2];
  if (hour >= 12) return SLOTS[1];
  return SLOTS[0];
}

// "Tomorrow · Morning", "Wed, 15 Oct · Evening", or "Flexible timing" when unscheduled.
export function describeSchedule(scheduledFor: string | null | undefined, now = new Date()): string {
  if (!scheduledFor) return "Flexible timing";
  const at = new Date(scheduledFor);
  const slot = slotForHour(at.getHours());
  return `${dayLabel(at, now)} · ${slot.label}`;
}

// A scheduled date that's already gone by (before today) — shown muted rather than hidden.
export function isOverdue(scheduledFor: string | null | undefined, now = new Date()): boolean {
  if (!scheduledFor) return false;
  return startOfDay(new Date(scheduledFor)).getTime() < startOfDay(now).getTime();
}
