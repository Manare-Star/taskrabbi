import { formatDistance, formatMoney, timeAgo } from "../../lib/format";

describe("formatMoney", () => {
  it("groups thousands with spaces and drops cents by default", () => {
    expect(formatMoney(0)).toBe("R 0");
    expect(formatMoney(450)).toBe("R 450");
    expect(formatMoney(1250)).toBe("R 1 250");
    expect(formatMoney(1234567)).toBe("R 1 234 567");
  });

  it("rounds to whole Rand unless cents are asked for", () => {
    expect(formatMoney(99.5)).toBe("R 100");
    expect(formatMoney(99.5, { cents: true })).toBe("R 99.50");
    expect(formatMoney(1250, { cents: true })).toBe("R 1 250.00");
  });

  it("puts the minus sign before the currency symbol", () => {
    expect(formatMoney(-75)).toBe("-R 75");
  });

  it("reads amounts that arrive from the database as strings", () => {
    expect(formatMoney("350.00" as unknown as number)).toBe("R 350");
  });
});

describe("formatDistance", () => {
  it("doesn't pretend to precision for approximate positions", () => {
    expect(formatDistance(0)).toBe("Nearby");
    expect(formatDistance(99)).toBe("Nearby");
  });

  it("rounds short distances to 100 m", () => {
    expect(formatDistance(149)).toBe("100 m");
    expect(formatDistance(450)).toBe("500 m");
  });

  it("shows one decimal under 10 km and none above", () => {
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(9949)).toBe("9.9 km");
    expect(formatDistance(14600)).toBe("15 km");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

  it("steps from now through minutes, hours and days", () => {
    expect(timeAgo(ago(5), now)).toBe("now");
    expect(timeAgo(ago(5 * 60), now)).toBe("5m");
    expect(timeAgo(ago(2 * 3600), now)).toBe("2h");
    expect(timeAgo(ago(3 * 86400), now)).toBe("3d");
  });

  it("treats a timestamp slightly in the future (clock skew) as now", () => {
    expect(timeAgo(ago(-30), now)).toBe("now");
  });

  it("switches to a date after a week", () => {
    expect(timeAgo(ago(8 * 86400), now)).not.toMatch(/^\d+d$/);
  });
});
