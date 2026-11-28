import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { post: vi.fn(), put: vi.fn() },
}));

const dataTable2Props = vi.fn();
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    dataTable2Props(props);
    return <div data-testid="stub-datatable2">{props.beforeTable ?? null}</div>;
  },
}));

import Index from "./Index";

const setProps = (props) =>
  usePageMock.mockReturnValue({
    props: {
      canWrite: false,
      canImport: false,
      rateTypes: ["transaction", "closing"],
      importMaxMb: 5,
      importColumns: ["from_currency_code"],
      ...props,
    },
  });

const lastProps = () => dataTable2Props.mock.calls.at(-1)[0];

describe("Finances/ExchangeRates/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
    window.route = (name) => `/${name}`;
  });

  it("daftar hanya baca: tanpa tombol, tanpa hapus, tanpa pilih banyak", () => {
    setProps({});
    render(<Index />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(lastProps().hideDeleteAction).toBe(true);
    expect(lastProps().selectable).toBe(false);
    expect(lastProps().rowActions).toEqual([]);
  });

  it("tombol tambah hanya dengan izin write, tombol impor hanya dengan izin import", () => {
    setProps({ canWrite: true });
    const { unmount } = render(<Index />);
    expect(
      screen.getByRole("button", { name: "finances.exchangeRate.page.add" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "finances.exchangeRate.page.import",
      }),
    ).not.toBeInTheDocument();
    unmount();

    setProps({ canImport: true });
    render(<Index />);
    expect(
      screen.getByRole("button", {
        name: "finances.exchangeRate.page.import",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "finances.exchangeRate.page.add" }),
    ).not.toBeInTheDocument();
  });

  it("tombol tambah membuka dialog kurs baru", async () => {
    setProps({ canWrite: true });
    render(<Index />);

    await userEvent.click(
      screen.getByRole("button", { name: "finances.exchangeRate.page.add" }),
    );

    expect(
      screen.getByRole("dialog", { name: "finances.exchangeRate.page.add" }),
    ).toBeInTheDocument();
  });

  it("tombol impor membuka dialog impor", async () => {
    setProps({ canImport: true });
    render(<Index />);

    await userEvent.click(
      screen.getByRole("button", {
        name: "finances.exchangeRate.page.import",
      }),
    );

    expect(
      screen.getByRole("dialog", {
        name: "finances.exchangeRate.page.import_title",
      }),
    ).toBeInTheDocument();
  });

  it("aksi koreksi hanya untuk kurs yang belum dirujuk dan membuka dialog koreksi", async () => {
    setProps({ canWrite: true });
    render(<Index />);

    const [action] = lastProps().rowActions;
    expect(action.key).toBe("correct");
    expect(action.enabled({ canDelete: true })).toBe(true);
    expect(action.enabled({ canDelete: false })).toBe(false);

    const { act } = await import("@testing-library/react");
    act(() =>
      action.onAction([
        {
          id: "01RATE",
          from_currency_code: "USD",
          to_currency_code: "IDR",
          rate_type: "transaction",
          rate: "15000.00000000",
          rate_date: "2026-11-20",
        },
      ]),
    );

    expect(
      await screen.findByRole("dialog", {
        name: "finances.exchangeRate.page.correct",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("finances.exchangeRate.columns.rate"),
    ).toHaveValue("15000.00000000");
  });

  it("aksi hapus hanya dengan izin delete, hanya kurs belum dirujuk, dengan konfirmasi dan memanggil DELETE", async () => {
    const { router } = await import("@inertiajs/react");
    router.delete = vi.fn((_url, options) => options.onSuccess?.());
    setProps({ canDelete: true });
    render(<Index />);

    const actions = lastProps().rowActions;
    expect(actions.map((a) => a.key)).toEqual(["remove"]);
    const [remove] = actions;
    expect(remove.variant).toBe("destructive");
    expect(remove.confirm.title).toBe(
      "finances.exchangeRate.page.delete_title",
    );
    expect(remove.enabled({ canDelete: true })).toBe(true);
    expect(remove.enabled({ canDelete: false })).toBe(false);

    const reload = vi.fn();
    remove.onAction([{ id: "01RATE" }], { reload });

    expect(router.delete).toHaveBeenCalledWith(
      "/exchangeRates.remove",
      expect.objectContaining({ preserveScroll: true }),
    );
    expect(reload).toHaveBeenCalled();
  });

  it("tanpa izin write tidak ada aksi koreksi", () => {
    setProps({ canImport: true });
    render(<Index />);

    expect(lastProps().rowActions).toEqual([]);
  });
});
