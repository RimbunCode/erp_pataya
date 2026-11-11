import { useEffect } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const postMock = vi.fn();
const setDataMock = vi.fn();
let formErrors = {};
vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { preferences: {} } }),
  useForm: (initial) => ({
    data: initial,
    setData: setDataMock,
    post: postMock,
    errors: formErrors,
    processing: false,
  }),
}));

vi.mock("./Form", () => ({
  default: ({ lines, totals, minorUnit }) => (
    <div data-testid="form-stub">
      {JSON.stringify({ lines: lines?.length, totals, minorUnit })}
    </div>
  ),
}));

const mountSpy = vi.fn();
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({
    isCreate,
    disabled,
    deleteable,
    sidebarContent,
    bottombarContent,
    controls,
    children,
  }) => {
    useEffect(() => {
      mountSpy();
    }, []);

    return (
      <div data-testid="stub-form-page">
        <div data-testid="form-page-meta">
          {JSON.stringify({
            isCreate: !!isCreate,
            disabled: !!disabled,
            deleteable: !!deleteable,
            sidebarContent: !!sidebarContent,
            bottombarContent: !!bottombarContent,
          })}
        </div>
        <div data-testid="form-page-controls">
          {typeof controls === "function" ? controls() : controls}
        </div>
        {children}
      </div>
    );
  },
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${params}` : name;

import Show from "./Show";

const journal = { id: "j1", code: "JV-0001/26" };
const totals = { debit: "100.00", credit: "100.00", balanced: true };

describe("Show (Finances/Journals)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formErrors = {};
  });

  it("FormPage read-only dan meneruskan lines/totals/minorUnit ke Form", () => {
    render(
      <Show
        journal={journal}
        lines={[{ id: "l1" }]}
        totals={totals}
        minorUnit={2}
      />,
    );

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({
        isCreate: false,
        disabled: true,
        deleteable: false,
        sidebarContent: false,
        bottombarContent: false,
      }),
    );
    expect(screen.getByTestId("form-stub")).toHaveTextContent('"lines":1');
    expect(screen.getByTestId("form-stub")).toHaveTextContent('"minorUnit":2');
  });

  it("berpindah ke jurnal lain me-remount FormPage agar state form tidak basi", () => {
    const { rerender } = render(
      <Show journal={journal} lines={[]} totals={totals} minorUnit={2} />,
    );
    expect(mountSpy).toHaveBeenCalledTimes(1);

    rerender(
      <Show
        journal={{ id: "j2", code: "JV-0002/26" }}
        lines={[]}
        totals={totals}
        minorUnit={2}
      />,
    );

    expect(mountSpy).toHaveBeenCalledTimes(2);
  });

  it("tanpa izin/keadaan yang memungkinkan (canReverse false): tidak ada tombol Balik", () => {
    render(<Show journal={journal} lines={[]} totals={totals} minorUnit={2} />);

    expect(
      screen.queryByRole("button", {
        name: "finances.journal.actions.reverse",
      }),
    ).toBeNull();
  });

  it("canReverse true: tombol Balik membuka dialog dengan tanggal dan alasan", async () => {
    const user = userEvent.setup();
    render(
      <Show
        journal={journal}
        lines={[]}
        totals={totals}
        minorUnit={2}
        canReverse
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "finances.journal.actions.reverse" }),
    );

    expect(
      await screen.findByText("finances.journal.reverse.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("finances.journal.reverse.date"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("finances.journal.reverse.reason"),
    ).toBeInTheDocument();
  });

  it("kirim dialog memanggil POST journals.reverse untuk jurnal ini", async () => {
    const user = userEvent.setup();
    render(
      <Show
        journal={journal}
        lines={[]}
        totals={totals}
        minorUnit={2}
        canReverse
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "finances.journal.actions.reverse" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "finances.journal.reverse.submit",
      }),
    );

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock.mock.calls[0][0]).toBe("journals.reverse/j1");
  });

  it("menampilkan kesalahan server pada tanggal dan pada aksi balik", async () => {
    formErrors = {
      date: "Periode fiskal 2026-11 sudah ditutup",
      reverse: "Jurnal sudah dibalik",
    };
    const user = userEvent.setup();
    render(
      <Show
        journal={journal}
        lines={[]}
        totals={totals}
        minorUnit={2}
        canReverse
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "finances.journal.actions.reverse" }),
    );

    expect(
      await screen.findByText("Periode fiskal 2026-11 sudah ditutup"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Jurnal sudah dibalik");
  });

  it("membatalkan dialog tidak mengirim apa pun", async () => {
    const user = userEvent.setup();
    render(
      <Show
        journal={journal}
        lines={[]}
        totals={totals}
        minorUnit={2}
        canReverse
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "finances.journal.actions.reverse" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "finances.journal.reverse.cancel",
      }),
    );

    expect(postMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("finances.journal.reverse.title")).toBeNull(),
    );
  });
});
