import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const routerMock = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn() }));
vi.mock("@inertiajs/react", () => ({ router: routerMock }));

import RateFormDialog, { initialRate, todayLocal } from "./RateFormDialog";

const TYPES = ["spot", "transaction", "closing", "contract", "historical"];

describe("Finances/ExchangeRates/RateFormDialog", () => {
  beforeEach(() => {
    routerMock.post.mockReset();
    routerMock.put.mockReset();
    window.route = (name, params) =>
      params === undefined ? `/${name}` : `/${name}/${params}`;
  });

  it("initialRate hanya memakai desimal polos dengan titik", () => {
    expect(initialRate("15500.00000000")).toBe("15500.00000000");
    expect(initialRate("15.500,25")).toBe("");
    expect(initialRate("1e5")).toBe("");
    expect(initialRate(null)).toBe("");
  });

  it("todayLocal berbentuk YYYY-MM-DD", () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("menambah kurs: kode mata uang huruf besar dan tipe awal dari server", async () => {
    render(<RateFormDialog rateTypes={TYPES} row={null} onClose={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("finances.exchangeRate.columns.from_currency_code"),
      " usd",
    );
    await userEvent.type(
      screen.getByLabelText("finances.exchangeRate.columns.to_currency_code"),
      "idr",
    );
    await userEvent.type(
      screen.getByLabelText("finances.exchangeRate.columns.rate"),
      "15800.5",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "finances.exchangeRate.page.save" }),
    );

    expect(routerMock.post).toHaveBeenCalledTimes(1);
    const [url, payload] = routerMock.post.mock.calls[0];
    expect(url).toBe("/exchangeRates.save");
    expect(payload).toMatchObject({
      from_currency_code: "USD",
      to_currency_code: "IDR",
      rate_type: "spot",
      rate: "15800.5",
    });
    expect(payload.rate_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(routerMock.put).not.toHaveBeenCalled();
  });

  it("koreksi: pasangan, tipe, dan tanggal terkunci; hanya rate yang dikirim", async () => {
    render(
      <RateFormDialog
        rateTypes={TYPES}
        row={{
          id: "01RATE",
          from_currency_code: "USD",
          to_currency_code: "IDR",
          rate_type: "closing",
          rate: "15000.00000000",
          rate_date: "2026-11-20",
        }}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText("finances.exchangeRate.columns.from_currency_code"),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("finances.exchangeRate.columns.rate_type"),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("finances.exchangeRate.columns.rate_date"),
    ).toHaveValue("2026-11-20");

    const rate = screen.getByLabelText("finances.exchangeRate.columns.rate");
    expect(rate).toHaveValue("15000.00000000");
    await userEvent.clear(rate);
    await userEvent.type(rate, "15100");
    await userEvent.click(
      screen.getByRole("button", { name: "finances.exchangeRate.page.save" }),
    );

    expect(routerMock.put).toHaveBeenCalledWith(
      "/exchangeRates.correct/01RATE",
      { rate: "15100" },
      expect.any(Object),
    );
    expect(routerMock.post).not.toHaveBeenCalled();
  });

  it("menampilkan galat server per kolom (mis. kurs sudah dirujuk)", async () => {
    routerMock.put.mockImplementation((_url, _payload, options) =>
      options.onError({ rate: "Kurs ini sudah dipakai transaksi" }),
    );
    render(
      <RateFormDialog
        rateTypes={TYPES}
        row={{ id: "01RATE", rate: "1", rate_date: "2026-11-20" }}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "finances.exchangeRate.page.save" }),
    );

    expect(
      await screen.findByText("Kurs ini sudah dipakai transaksi"),
    ).toBeInTheDocument();
  });

  it("menutup dialog setelah simpan berhasil dan lewat tombol batal", async () => {
    const onClose = vi.fn();
    routerMock.post.mockImplementation((_url, _payload, options) =>
      options.onSuccess(),
    );
    render(<RateFormDialog rateTypes={TYPES} row={null} onClose={onClose} />);

    await userEvent.click(
      screen.getByRole("button", { name: "finances.exchangeRate.page.save" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(
      screen.getByRole("button", { name: "finances.exchangeRate.page.cancel" }),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
