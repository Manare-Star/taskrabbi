import { getErrorMessage, isEmailNotConfirmed, isNetworkError } from "../../lib/errors";

const FALLBACK = "Something went wrong. Please try again.";

describe("getErrorMessage", () => {
  it("passes through messages written for users by our own database functions", () => {
    const error = { message: "You have a job in progress. Finish or cancel it before deleting your account." };
    expect(getErrorMessage(error)).toBe(error.message);
  });

  it("reads plain objects, Error instances and strings alike", () => {
    expect(getErrorMessage({ message: "This bid is no longer available." })).toBe("This bid is no longer available.");
    expect(getErrorMessage(new Error("This bid is no longer available."))).toBe("This bid is no longer available.");
    expect(getErrorMessage("This bid is no longer available.")).toBe("This bid is no longer available.");
  });

  it("falls back when there's nothing usable", () => {
    expect(getErrorMessage(null)).toBe(FALLBACK);
    expect(getErrorMessage({ message: "" }, "Try later.")).toBe("Try later.");
    expect(getErrorMessage({ code: 500 })).toBe(FALLBACK);
  });

  it.each([
    ["Network request failed", /No internet connection/],
    ["TypeError: Failed to fetch", /No internet connection/],
    ["Invalid login credentials", /don't match/],
    ["Email not confirmed", /Confirm your email/],
    ["User already registered", /already exists/],
    ["Token has expired or is invalid", /wrong or has expired/],
    ["For security purposes, you can only request this after 42 seconds.", /wait a moment/],
    ["JWT expired", /session expired/],
    ["new row violates row-level security policy for table bids", /permission/],
    ["permission denied for table tasks", /permission/],
    ["task is not open for bidding", /no longer open/],
    ["Edge Function returned a non-2xx status code", /server couldn't complete/],
  ])("translates %p", (raw, expected) => {
    expect(getErrorMessage({ message: raw })).toMatch(expected);
  });

  it("translates constraint violations by the constraint's name", () => {
    expect(getErrorMessage({ message: "duplicate key value violates unique constraint bids_task_id_tasker_id_key" })).toBe(
      "You've already bid on this task."
    );
    expect(getErrorMessage({ message: "new row for relation tasks violates check constraint tasks_title_length" })).toMatch(
      /between 3 and 120/
    );
    expect(getErrorMessage({ message: "violates check constraint tasks_budget_max" })).toMatch(/R 1 000 000/);
  });

  it("never shows raw database output", () => {
    expect(getErrorMessage({ message: "null value in column area_text violates not-null constraint" })).toBe(FALLBACK);
    expect(getErrorMessage({ message: "column tasks.area_text does not exist" })).toBe(FALLBACK);
  });
});

describe("error classifiers", () => {
  it("recognise a dropped connection", () => {
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
    expect(isNetworkError({ message: "Invalid login credentials" })).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });

  it("recognise an unconfirmed email", () => {
    expect(isEmailNotConfirmed({ message: "Email not confirmed" })).toBe(true);
    expect(isEmailNotConfirmed({ message: "Invalid login credentials" })).toBe(false);
  });
});
