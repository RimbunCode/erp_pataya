import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Show.jsx (Services/WorkOrders) compose <FormPage><Form/></FormPage> dengan
// controls({form}) render-prop. Logic UNIK yang jadi fokus:
// - canRequest: total required_quantity item stock (is_stock_item) > 0
// - controls: return null kalau !(submitted_at && isValidStatus(status))
// - tombol start/complete work: toggle label & level (start<->complate)
//   berdasar started_at, submitted (put) ke workOrders.update
// - dropdown Actions: disembunyikan total kalau additional_data.order ada;
//   link create_pr (gated canRequest); link create_so/create_io (pilih
//   berdasar for_internal), keduanya bawa ref workOrder/{id}
//
// FormPage di-stub sebagai wrapper: merender meta isCreate/disabled +
// controls({form: mockForm}) + children. isValidStatus/calculateArray TIDAK
// di-mock -- fungsi murni dari lib/utils, dipakai asli.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

vi.mock("./Form", () => ({
  default: () => <div data-testid="form-stub" />,
}));

vi.mock("@/Components/Link", () => ({
  default: ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockForm = { put: vi.fn() };
vi.mock("@/Pages/Core/FormPage", () => ({
  FormPage: ({ isCreate, disabled, controls, children }) => (
    <div data-testid="stub-form-page">
      <div data-testid="form-page-meta">
        {JSON.stringify({ isCreate: !!isCreate, disabled: !!disabled })}
      </div>
      <div data-testid="form-page-controls">
        {typeof controls === "function" ? controls({ form: mockForm }) : controls}
      </div>
      <div data-testid="form-page-children">{children}</div>
    </div>
  ),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

import Show from "./Show";

describe("Show (Services/WorkOrders)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender Form (black-box) di dalam FormPage", () => {
    render(<Show workOrder={{ id: 1, status: "open", submitted_at: null }} />);

    expect(screen.getByTestId("form-stub")).toBeInTheDocument();
  });

  // BUG PRODUKSI (belum diperbaiki, sudah dilaporkan terpisah): baris 23
  // Show.jsx pakai `workOrder.items?.filter(...)` -- optional chaining hanya
  // di `.items`, TIDAK di `workOrder` itu sendiri. WorkOrderController@create
  // me-render Show TANPA prop workOrder (jadi undefined di halaman "buat
  // Work Order baru"), sehingga useMemo canRequest throw TypeError saat
  // render pertama. Test ini mendokumentasikan crash tsb secara eksplisit
  // sampai bug diperbaiki -- JANGAN dihapus/dilonggarkan, ganti jadi assert
  // sukses begitu baris 23 diperbaiki jadi `workOrder?.items?.filter(...)`.
  it("BUG: workOrder null (create mode) crash saat render karena canRequest useMemo akses workOrder.items tanpa optional chaining", () => {
    expect(() => render(<Show workOrder={null} />)).toThrow(
      "Cannot read properties of null (reading 'items')",
    );
  });

  it("disabled mengikuti submitted_at saat workOrder ada", () => {
    render(
      <Show
        workOrder={{ id: 1, status: "open", submitted_at: "2026-08-01" }}
      />,
    );

    expect(screen.getByTestId("form-page-meta")).toHaveTextContent(
      JSON.stringify({ isCreate: false, disabled: true }),
    );
  });

  describe("controls: gating submitted_at + isValidStatus", () => {
    it("belum submitted: controls kosong (null)", () => {
      render(
        <Show workOrder={{ id: 1, status: "open", submitted_at: null }} />,
      );

      expect(screen.getByTestId("form-page-controls")).toBeEmptyDOMElement();
    });

    it("submitted tapi status draft (bukan valid status): controls kosong", () => {
      render(
        <Show
          workOrder={{ id: 1, status: "draft", submitted_at: "2026-08-01" }}
        />,
      );

      expect(screen.getByTestId("form-page-controls")).toBeEmptyDOMElement();
    });

    it("submitted & status valid (open): controls muncul", () => {
      render(
        <Show
          workOrder={{ id: 1, status: "open", submitted_at: "2026-08-01" }}
        />,
      );

      expect(
        screen.getByTestId("form-page-controls"),
      ).not.toBeEmptyDOMElement();
    });
  });

  describe("tombol start/complete work", () => {
    it("belum started_at: tombol berlabel start_work", () => {
      render(
        <Show
          workOrder={{
            id: 1,
            status: "open",
            submitted_at: "2026-08-01",
            started_at: null,
            completed_at: null,
          }}
        />,
      );

      expect(
        screen.getByText("service.workOrder.actions.start_work"),
      ).toBeInTheDocument();
    });

    it("sudah started_at: tombol berlabel complate_work", () => {
      render(
        <Show
          workOrder={{
            id: 1,
            status: "open",
            submitted_at: "2026-08-01",
            started_at: "2026-08-02",
            completed_at: null,
          }}
        />,
      );

      expect(
        screen.getByText("service.workOrder.actions.complate_work"),
      ).toBeInTheDocument();
    });

    it("sudah completed_at: tombol start/complete tidak dirender", () => {
      render(
        <Show
          workOrder={{
            id: 1,
            status: "open",
            submitted_at: "2026-08-01",
            started_at: "2026-08-02",
            completed_at: "2026-08-03",
          }}
        />,
      );

      expect(
        screen.queryByText("service.workOrder.actions.complate_work"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("service.workOrder.actions.start_work"),
      ).not.toBeInTheDocument();
    });

    it("klik tombol start_work memanggil form.put ke workOrders.update dengan level=start", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show
          workOrder={{
            id: 5,
            status: "open",
            submitted_at: "2026-08-01",
            started_at: null,
            completed_at: null,
          }}
        />,
      );

      await user.click(
        screen.getByText("service.workOrder.actions.start_work"),
      );

      expect(mockForm.put).toHaveBeenCalledWith(
        `workOrders.update/${JSON.stringify({ workOrder: 5, level: "start" })}`,
      );
    });

    it("klik tombol complate_work memanggil form.put dengan level=complate", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show
          workOrder={{
            id: 5,
            status: "open",
            submitted_at: "2026-08-01",
            started_at: "2026-08-02",
            completed_at: null,
          }}
        />,
      );

      await user.click(
        screen.getByText("service.workOrder.actions.complate_work"),
      );

      expect(mockForm.put).toHaveBeenCalledWith(
        `workOrders.update/${JSON.stringify({ workOrder: 5, level: "complate" })}`,
      );
    });
  });

  describe("dropdown Actions", () => {
    it("additional_data.order ada: dropdown Actions tidak dirender", () => {
      render(
        <Show
          workOrder={{
            id: 1,
            status: "open",
            submitted_at: "2026-08-01",
            additional_data: { order: { id: 1 } },
          }}
        />,
      );

      expect(
        screen.queryByText("core.form.actions"),
      ).not.toBeInTheDocument();
    });

    it("tanpa item stock (canRequest false): link create_pr tidak muncul", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show
          workOrder={{
            id: 1,
            status: "open",
            submitted_at: "2026-08-01",
            items: [{ item: { is_stock_item: false }, required_quantity: 5 }],
          }}
        />,
      );

      await user.click(screen.getByText("core.form.actions"));

      expect(
        screen.queryByText("service.workOrder.actions.create_pr"),
      ).not.toBeInTheDocument();
    });

    it("ada item stock dengan required_quantity > 0: link create_pr muncul dengan href ref workOrder/{id}", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show
          workOrder={{
            id: 7,
            status: "open",
            submitted_at: "2026-08-01",
            items: [
              { item: { is_stock_item: true }, required_quantity: 5 },
            ],
          }}
        />,
      );

      await user.click(screen.getByText("core.form.actions"));

      const link = screen.getByText(
        "service.workOrder.actions.create_pr",
      ).closest("a");
      expect(link).toHaveAttribute(
        "href",
        `purchaseRequests.create/${JSON.stringify({ ref: "workOrder/7" })}`,
      );
    });

    it("for_internal false: link target salesOrders.create dengan label create_so", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show
          workOrder={{
            id: 3,
            status: "open",
            submitted_at: "2026-08-01",
            for_internal: false,
          }}
        />,
      );

      await user.click(screen.getByText("core.form.actions"));

      const link = screen.getByText(
        "service.workOrder.actions.create_so",
      ).closest("a");
      expect(link).toHaveAttribute(
        "href",
        `salesOrders.create/${JSON.stringify({ ref: "workOrder/3" })}`,
      );
    });

    it("for_internal true: link target internalOrders.create dengan label create_io", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <Show
          workOrder={{
            id: 3,
            status: "open",
            submitted_at: "2026-08-01",
            for_internal: true,
          }}
        />,
      );

      await user.click(screen.getByText("core.form.actions"));

      const link = screen.getByText(
        "service.workOrder.actions.create_io",
      ).closest("a");
      expect(link).toHaveAttribute(
        "href",
        `internalOrders.create/${JSON.stringify({ ref: "workOrder/3" })}`,
      );
    });
  });
});
