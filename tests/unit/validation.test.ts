import {
  isValid, parseMoney, validateCode, validateEmail, validateLength, validateMoney, validateName, validatePassword,
} from "../../lib/validation";

describe("validateEmail", () => {
  it.each(["thandi@example.com", "  thandi@example.co.za  ", "a.b+c@sub.domain.org"])("accepts %s", (email) => {
    expect(validateEmail(email)).toBeNull();
  });

  it.each(["", "   ", "thandi", "thandi@", "@example.com", "thandi@example", "thandi @example.com"])("rejects %p", (email) => {
    expect(validateEmail(email)).toEqual(expect.any(String));
  });
});

describe("validatePassword", () => {
  it("accepts eight or more characters with a letter and a number", () => {
    expect(validatePassword("sunshine7")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(validatePassword("abc123")).toMatch(/at least 8/);
  });

  it("rejects passwords that are all letters or all digits", () => {
    expect(validatePassword("sunshineday")).toMatch(/letter and one number/);
    expect(validatePassword("1234567890")).toMatch(/letter and one number/);
  });

  it("asks for a password when empty", () => {
    expect(validatePassword("")).toBe("Enter a password.");
  });
});

describe("validateName", () => {
  it("needs at least two characters and at most eighty", () => {
    expect(validateName("Jo")).toBeNull();
    expect(validateName(" J ")).toEqual(expect.any(String));
    expect(validateName("x".repeat(81))).toMatch(/under 80/);
  });
});

describe("validateLength", () => {
  it("counts the trimmed text", () => {
    expect(validateLength("  ab  ", { min: 3, max: 10, label: "the title" })).toMatch(/at least 3/);
    expect(validateLength("abc", { min: 3, max: 10, label: "the title" })).toBeNull();
  });

  it("says how long the text is when it's over the limit", () => {
    expect(validateLength("x".repeat(12), { max: 10, label: "the title" })).toBe(
      "The title can be at most 10 characters (currently 12)."
    );
  });

  it("asks for required text plainly", () => {
    expect(validateLength("", { min: 1, max: 10, label: "a description" })).toBe("Enter a description.");
  });
});

describe("parseMoney", () => {
  it.each([
    ["450", 450],
    ["450.5", 450.5],
    ["450.50", 450.5],
    ["1 250", 1250],
    ["1 250", 1250],
    ["1,250", 1250],
    ["1,250.75", 1250.75],
    ["12,345,678.90", 12345678.9],
    ["99,50", 99.5],
    ["R 450", 450],
    ["r450", 450],
    ["  450  ", 450],
  ])("reads %p as %p", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "0", "0.00", "-5", "4.567", "1,25,0", "12..5", "1e3", "R"])("rejects %p", (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe("validateMoney", () => {
  it("accepts a sensible amount", () => {
    expect(validateMoney("450")).toBeNull();
  });

  it("names what's missing", () => {
    expect(validateMoney("", "your budget")).toBe("Enter your budget.");
  });

  it("rejects amounts over the limit", () => {
    expect(validateMoney("1000000")).toBeNull();
    expect(validateMoney("1000001")).toMatch(/limit/);
  });

  it("explains the format when it can't be read", () => {
    expect(validateMoney("four hundred")).toMatch(/like 450/);
  });
});

describe("validateCode", () => {
  it("accepts six to ten digits", () => {
    expect(validateCode("123456")).toBeNull();
    expect(validateCode(" 12345678 ")).toBeNull();
  });

  it("rejects anything else", () => {
    expect(validateCode("")).toEqual(expect.any(String));
    expect(validateCode("12345")).toEqual(expect.any(String));
    expect(validateCode("12a456")).toEqual(expect.any(String));
  });
});

describe("isValid", () => {
  it("is true only when no field has an error", () => {
    expect(isValid({ a: null, b: undefined })).toBe(true);
    expect(isValid({ a: null, b: "Required" })).toBe(false);
  });
});
