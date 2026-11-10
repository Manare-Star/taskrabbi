import { colors, statusColors } from "../../lib/theme";

// WCAG 2.x contrast ratio between two #RRGGBB colours.
function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((start) => {
      const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_TEXT = 4.5;
const AA_UI = 3;

describe("colour contrast (WCAG AA)", () => {
  it.each([
    ["text", colors.text],
    ["textMuted", colors.textMuted],
    ["textFaint", colors.textFaint],
    ["primary (links)", colors.primary],
    ["danger (errors)", colors.danger],
  ])("%s is readable on every surface it's used on", (_name, color) => {
    for (const surface of [colors.background, colors.surface, colors.surfaceAlt]) {
      expect(contrast(color, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("white text is readable on the filled buttons, toasts and badges", () => {
    for (const fill of [colors.primary, colors.danger, colors.ink]) {
      expect(contrast(colors.white, fill)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("every status pill's text is readable on its own background", () => {
    for (const [status, { bg, fg }] of Object.entries(statusColors)) {
      expect({ status, readable: contrast(fg, bg) >= AA_TEXT }).toEqual({ status, readable: true });
    }
  });

  it("notice text is readable on its tint", () => {
    expect(contrast(colors.primaryDark, colors.successLight)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.warning, colors.warningLight)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.danger, colors.dangerLight)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.text, colors.primaryLight)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("placeholders meet the 3:1 minimum for non-essential text", () => {
    expect(contrast(colors.placeholder, colors.background)).toBeGreaterThanOrEqual(AA_UI);
  });
});
