import { FLEXIBLE, dayLabel, describeSchedule, isOverdue, toScheduledFor, upcomingDays } from "../../lib/schedule";

// Local-time dates throughout: the schedule is about the user's own day.
const monday = new Date(2026, 10, 9, 10, 30);

describe("upcomingDays", () => {
  it("offers two weeks starting today, at midnight", () => {
    const days = upcomingDays(monday);
    expect(days).toHaveLength(14);
    expect(days[0].getDate()).toBe(9);
    expect(days[0].getHours()).toBe(0);
    expect(days[13].getDate()).toBe(22);
  });
});

describe("dayLabel", () => {
  it("names today and tomorrow", () => {
    expect(dayLabel(new Date(2026, 10, 9, 23, 0), monday)).toBe("Today");
    expect(dayLabel(new Date(2026, 10, 10, 1, 0), monday)).toBe("Tomorrow");
  });

  it("uses a date for anything else", () => {
    expect(dayLabel(new Date(2026, 10, 12), monday)).not.toMatch(/Today|Tomorrow/);
  });
});

describe("toScheduledFor", () => {
  it("is undefined for flexible timing", () => {
    expect(toScheduledFor(FLEXIBLE)).toBeUndefined();
  });

  it("stores the slot as its start hour on the chosen day", () => {
    const iso = toScheduledFor({ day: new Date(2026, 10, 12), slot: "afternoon" });
    const at = new Date(iso!);
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours()]).toEqual([2026, 10, 12, 12]);
  });
});

describe("describeSchedule", () => {
  it("says flexible when there's no date", () => {
    expect(describeSchedule(null)).toBe("Flexible timing");
    expect(describeSchedule(undefined)).toBe("Flexible timing");
  });

  it("round-trips each slot through its stored timestamp", () => {
    const day = new Date(2026, 10, 10);
    expect(describeSchedule(toScheduledFor({ day, slot: "morning" }), monday)).toBe("Tomorrow · Morning");
    expect(describeSchedule(toScheduledFor({ day, slot: "afternoon" }), monday)).toBe("Tomorrow · Afternoon");
    expect(describeSchedule(toScheduledFor({ day, slot: "evening" }), monday)).toBe("Tomorrow · Evening");
  });
});

describe("isOverdue", () => {
  it("is true only for days before today", () => {
    expect(isOverdue(new Date(2026, 10, 8, 17).toISOString(), monday)).toBe(true);
    expect(isOverdue(new Date(2026, 10, 9, 8).toISOString(), monday)).toBe(false);
    expect(isOverdue(null, monday)).toBe(false);
  });
});
