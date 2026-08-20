import { describe, it, expect, vi } from "vitest";

vi.mock("goey-toast", () => ({
  gooeyToast: {
    error: vi.fn(() => "error-id"),
    warning: vi.fn(() => "warning-id"),
    success: vi.fn(() => "success-id"),
    info: vi.fn(() => "info-id"),
  },
}));

import { gooeyToast } from "goey-toast";
import { toastAlert } from "./gooeyToast";

describe("toastAlert", () => {
  it("memetakan variant 'destructive' ke toast.error", () => {
    toastAlert("destructive", "Gagal");
    expect(gooeyToast.error).toHaveBeenCalledWith("Gagal", {});
  });

  it("memetakan variant 'warning'/'success'/'info' apa adanya", () => {
    toastAlert("warning", "Perhatian");
    expect(gooeyToast.warning).toHaveBeenCalledWith("Perhatian", {});

    toastAlert("success", "Berhasil");
    expect(gooeyToast.success).toHaveBeenCalledWith("Berhasil", {});

    toastAlert("info", "Info");
    expect(gooeyToast.info).toHaveBeenCalledWith("Info", {});
  });

  it("fallback ke toast.info untuk variant tidak dikenal", () => {
    toastAlert("unknown-variant", "Pesan");
    expect(gooeyToast.info).toHaveBeenCalledWith("Pesan", {});
  });

  it("meneruskan options tambahan ke fungsi toast", () => {
    toastAlert("success", "Berhasil", { duration: 3000 });
    expect(gooeyToast.success).toHaveBeenCalledWith("Berhasil", {
      duration: 3000,
    });
  });
});
