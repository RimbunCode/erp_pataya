import { describe, expect, it } from "vitest";
import { FileText, Receipt } from "lucide-react";
import resolveManualBookIcon from "./iconMap";

describe("resolveManualBookIcon", () => {
  it("mengembalikan komponen icon yang cocok dengan nama", () => {
    expect(resolveManualBookIcon("Receipt")).toBe(Receipt);
  });

  it("fallback ke FileText untuk nama yang tidak dikenal", () => {
    expect(resolveManualBookIcon("TidakAda")).toBe(FileText);
  });

  it("fallback ke FileText untuk nama kosong/null/undefined", () => {
    expect(resolveManualBookIcon("")).toBe(FileText);
    expect(resolveManualBookIcon(null)).toBe(FileText);
    expect(resolveManualBookIcon(undefined)).toBe(FileText);
  });
});
