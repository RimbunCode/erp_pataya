import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ConsistencyWarning from "./ConsistencyWarning";

vi.mock("axios", () => ({
  default: { post: vi.fn() },
}));

const baseProps = {
  reportName: "Mutasi Stock",
  kpiRows: 3,
  tableRows: 5,
  filter: {},
};

describe("ConsistencyWarning", () => {
  beforeEach(() => {
    window.route = (name) => name;
  });

  it("selalu menampilkan tombol laporkan masalah untuk semua pengguna", () => {
    render(<ConsistencyWarning {...baseProps} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Laporkan masalah ini" }),
    ).toBeInTheDocument();
  });

  it("menyembunyikan tombol hitung ulang untuk pengguna tanpa izin administratif", () => {
    render(
      <ConsistencyWarning
        {...baseProps}
        canRecount={false}
        onRecount={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Hitung ulang akurat" }),
    ).not.toBeInTheDocument();
  });

  it("menampilkan tombol hitung ulang untuk pengguna berizin dan memanggil onRecount", async () => {
    const onRecount = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ConsistencyWarning {...baseProps} canRecount onRecount={onRecount} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Hitung ulang akurat" }),
    );

    expect(onRecount).toHaveBeenCalledTimes(1);
  });

  it("menampilkan pesan gagal bila hitung ulang melempar error", async () => {
    const onRecount = vi.fn().mockRejectedValue(new Error("gagal"));
    const user = userEvent.setup();
    render(
      <ConsistencyWarning {...baseProps} canRecount onRecount={onRecount} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Hitung ulang akurat" }),
    );

    expect(
      await screen.findByText("Gagal menghitung ulang. Coba lagi."),
    ).toBeInTheDocument();
  });
});
