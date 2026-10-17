import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  BADGE_COLORS,
  BADGE_VARIANTS,
  DOT_COLORS,
  resolveBadgeColor,
  resolveDotColor,
} from "./badgeColors";

const PALETTE_NAMES = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
];

describe("resolveBadgeColor", () => {
  it.each(BADGE_VARIANTS)(
    "mengembalikan varian bawaan %s tanpa kelas tambahan",
    (variant) => {
      expect(resolveBadgeColor(variant)).toEqual({ variant, className: "" });
    },
  );

  it.each(PALETTE_NAMES)(
    "memetakan warna palet %s ke varian outline dengan kelas warnanya",
    (color) => {
      expect(resolveBadgeColor(color)).toEqual({
        variant: "outline",
        className: BADGE_COLORS[color],
      });
    },
  );

  it("memiliki kelas literal untuk seluruh warna palet", () => {
    for (const color of PALETTE_NAMES) {
      expect(BADGE_COLORS[color]).toMatch(/bg-\w+-\d+/);
      expect(BADGE_COLORS[color]).toMatch(/dark:bg-/);
    }
  });

  it.each([
    null,
    undefined,
    "",
    "unknown",
    "GRAY",
    "constructor",
    "__proto__",
    "toString",
  ])("fallback ke secondary untuk nilai tak dikenal %j", (color) => {
    expect(resolveBadgeColor(color)).toEqual({
      variant: "secondary",
      className: "",
    });
  });

  it("fallback ke secondary untuk string acak yang bukan anggota palet maupun varian", () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (value) =>
              !BADGE_VARIANTS.includes(value) &&
              !Object.hasOwn(BADGE_COLORS, value),
          ),
        (value) => {
          expect(resolveBadgeColor(value)).toEqual({
            variant: "secondary",
            className: "",
          });
        },
      ),
    );
  });
});

describe("resolveDotColor", () => {
  it.each(PALETTE_NAMES)(
    "mengembalikan kelas titik untuk warna palet %s",
    (color) => {
      expect(resolveDotColor(color)).toBe(DOT_COLORS[color]);
    },
  );

  it.each(["default", "secondary", "destructive", "outline"])(
    "mengembalikan kelas titik untuk varian %s",
    (variant) => {
      expect(resolveDotColor(variant)).toBe(DOT_COLORS[variant]);
    },
  );

  it.each([null, undefined, "", "unknown", "constructor"])(
    "fallback ke secondary untuk nilai tak dikenal %j",
    (color) => {
      expect(resolveDotColor(color)).toBe(DOT_COLORS.secondary);
    },
  );

  it("fallback ke secondary untuk string acak yang bukan kunci DOT_COLORS", () => {
    fc.assert(
      fc.property(
        fc.string().filter((value) => !Object.hasOwn(DOT_COLORS, value)),
        (value) => {
          expect(resolveDotColor(value)).toBe(DOT_COLORS.secondary);
        },
      ),
    );
  });
});
