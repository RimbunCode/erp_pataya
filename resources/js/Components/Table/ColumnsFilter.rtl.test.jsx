import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { currentLocaleMock } = vi.hoisted(() => ({
  currentLocaleMock: vi.fn(),
}));
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key) => `TR:${key}`,
    currentLocale: currentLocaleMock,
  }),
}));

import ColumnsFilter from "./ColumnsFilter";
import { Dialog } from "../ui/dialog";

const renderWithDialog = (ui) => render(<Dialog open>{ui}</Dialog>);

const columns = [
  { name: "name", title: "Name", show: true, type: "string" },
  { name: "status", title: "Status", show: false, type: "formStatus" },
  { name: "id", title: "ID", show: true, type: "number", primaryKey: "id" },
  { name: "related", title: "Related", show: true, type: "relations" },
  { name: "hidden_col", title: "Hidden", show: true, hidden: true },
];

describe("ColumnsFilter", () => {
  it("render checkbox untuk setiap kolom yang tidak dikecualikan", () => {
    renderWithDialog(
      <ColumnsFilter
        columns={columns}
        onApply={vi.fn()}
        onReset={vi.fn()}
        open
      />,
    );

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
  });

  it("mengecualikan kolom bertipe relations/mixed/json", () => {
    renderWithDialog(
      <ColumnsFilter
        columns={columns}
        onApply={vi.fn()}
        onReset={vi.fn()}
        open
      />,
    );

    expect(screen.queryByLabelText("Related")).not.toBeInTheDocument();
  });

  it("mengecualikan kolom primaryKey dan hidden", () => {
    renderWithDialog(
      <ColumnsFilter
        columns={columns}
        onApply={vi.fn()}
        onReset={vi.fn()}
        open
      />,
    );

    expect(screen.queryByLabelText("ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hidden")).not.toBeInTheDocument();
  });

  it("checkbox mencerminkan state show masing-masing kolom", () => {
    renderWithDialog(
      <ColumnsFilter
        columns={columns}
        onApply={vi.fn()}
        onReset={vi.fn()}
        open
      />,
    );

    // Checkbox pakai role="forminput" kustom (bukan role="checkbox" default
    // Radix), jadi jest-dom .toBeChecked() tidak berlaku -- cek via data-state.
    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(screen.getByLabelText("Status")).toHaveAttribute(
      "data-state",
      "unchecked",
    );
  });

  it("klik Apply memanggil onApply dengan state kolom terkini", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = vi.fn();
    renderWithDialog(
      <ColumnsFilter
        columns={columns}
        onApply={onApply}
        onReset={vi.fn()}
        open
      />,
    );

    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByText("TR:core.datatable.columns.apply"));

    expect(onApply).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "status", show: true }),
      ]),
    );
  });

  it("klik Reset memanggil onReset", async () => {
    const user = userEvent.setup({ delay: null });
    const onReset = vi.fn();
    renderWithDialog(
      <ColumnsFilter
        columns={columns}
        onApply={vi.fn()}
        onReset={onReset}
        open
      />,
    );

    await user.click(screen.getByText("TR:core.datatable.columns.reset"));
    expect(onReset).toHaveBeenCalled();
  });

  // Task 7 (spec linkmodel-advanced-search) — kolom locked: selalu tercentang,
  // tidak bisa di-toggle. Dipakai Advance Search Dialog utk kolom sumber
  // templateLink. Pola sama exclusion primaryKey yang sudah ada di file ini.
  const lockedColumns = [
    { name: "code", title: "Code", show: true, type: "string", locked: true },
    { name: "name", title: "Name", show: false, type: "string" },
  ];

  it("kolom locked -- checkbox disabled dan selalu tercentang walau show=false", () => {
    renderWithDialog(
      <ColumnsFilter
        columns={lockedColumns}
        onApply={vi.fn()}
        onReset={vi.fn()}
        open
      />,
    );

    const codeCheckbox = screen.getByLabelText("Code");
    expect(codeCheckbox).toHaveAttribute("data-state", "checked");
    expect(codeCheckbox).toBeDisabled();
  });

  it("kolom locked -- klik tidak mengubah apapun, onApply tetap kirim show:true", async () => {
    const user = userEvent.setup({ delay: null });
    const onApply = vi.fn();
    renderWithDialog(
      <ColumnsFilter
        columns={lockedColumns}
        onApply={onApply}
        onReset={vi.fn()}
        open
      />,
    );

    // Guard `disabled` mencegah interaksi -- click tidak throw & tidak berefek.
    await user.click(screen.getByLabelText("Code"));
    await user.click(screen.getByText("TR:core.datatable.columns.apply"));

    expect(onApply).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "code", show: true, locked: true }),
      ]),
    );
  });

  it("kolom non-locked di sebelahnya tetap togglable seperti biasa", async () => {
    const user = userEvent.setup({ delay: null });
    renderWithDialog(
      <ColumnsFilter
        columns={lockedColumns}
        onApply={vi.fn()}
        onReset={vi.fn()}
        open
      />,
    );

    const nameCheckbox = screen.getByLabelText("Name");
    expect(nameCheckbox).not.toBeDisabled();
    await user.click(nameCheckbox);
    expect(nameCheckbox).toHaveAttribute("data-state", "checked");
  });

  const searchPlaceholder =
    "TR:core.datatable.filter.column.search.placeholder";

  describe("pencarian kolom", () => {
    it("ketik search memfilter grid ke kolom yang cocok saja", async () => {
      const user = userEvent.setup({ delay: null });
      renderWithDialog(
        <ColumnsFilter
          columns={columns}
          onApply={vi.fn()}
          onReset={vi.fn()}
          open
        />,
      );

      await user.type(screen.getByPlaceholderText(searchPlaceholder), "nam");

      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    });

    it("substring yang cocok di-highlight <mark>", async () => {
      const user = userEvent.setup({ delay: null });
      renderWithDialog(
        <ColumnsFilter
          columns={columns}
          onApply={vi.fn()}
          onReset={vi.fn()}
          open
        />,
      );

      await user.type(screen.getByPlaceholderText(searchPlaceholder), "nam");

      // DialogContent dirender via Radix Portal (di luar `container` hasil
      // render()) -- cari lewat document.body, bukan container.querySelector.
      const mark = document.body.querySelector("mark");
      expect(mark).toBeInTheDocument();
      expect(mark).toHaveTextContent("Nam");
    });

    it("search tanpa hasil menampilkan pesan not_found", async () => {
      const user = userEvent.setup({ delay: null });
      renderWithDialog(
        <ColumnsFilter
          columns={columns}
          onApply={vi.fn()}
          onReset={vi.fn()}
          open
        />,
      );

      await user.type(
        screen.getByPlaceholderText(searchPlaceholder),
        "zzz_tidak_ada",
      );

      expect(
        screen.getByText("TR:core.datatable.filter.column.not_found"),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    });

    it("dialog dibuka ulang (open false->true) mereset search", async () => {
      const user = userEvent.setup({ delay: null });
      const { rerender } = render(
        <Dialog open>
          <ColumnsFilter
            columns={columns}
            onApply={vi.fn()}
            onReset={vi.fn()}
            open={false}
          />
        </Dialog>,
      );

      await user.type(screen.getByPlaceholderText(searchPlaceholder), "nam");
      expect(screen.getByPlaceholderText(searchPlaceholder)).toHaveValue("nam");

      rerender(
        <Dialog open>
          <ColumnsFilter
            columns={columns}
            onApply={vi.fn()}
            onReset={vi.fn()}
            open={true}
          />
        </Dialog>,
      );

      expect(screen.getByPlaceholderText(searchPlaceholder)).toHaveValue("");
    });
  });

  describe("pengurutan kolom", () => {
    afterEach(() => currentLocaleMock.mockReset());

    const unordered = [
      { name: "zeta", title: "Zeta", show: true, type: "string" },
      { name: "alpha", title: "Alpha", show: true, type: "string" },
      { name: "mid", title: "Mid", show: true, type: "string" },
    ];
    const renderedOrder = () =>
      screen.getAllByRole("forminput").map((el) => el.id);

    it("checkbox diurut abjad berdasarkan label, bukan urutan array columns", () => {
      renderWithDialog(
        <ColumnsFilter
          columns={unordered}
          onApply={vi.fn()}
          onReset={vi.fn()}
          open
        />,
      );

      expect(renderedOrder()).toEqual(["alpha", "mid", "zeta"]);
    });

    it("urut berdasarkan label HASIL terjemahan (titleTrans -> t()), bukan nama field", () => {
      // t() mock menghasilkan "TR:<key>" -- urutan label "TR:a.first" <
      // "TR:z.last" berlawanan dgn urutan nama field (b_field < a_field).
      renderWithDialog(
        <ColumnsFilter
          columns={[
            {
              name: "a_field",
              titleTrans: "z.last",
              show: true,
              type: "string",
            },
            {
              name: "b_field",
              titleTrans: "a.first",
              show: true,
              type: "string",
            },
          ]}
          onApply={vi.fn()}
          onReset={vi.fn()}
          open
        />,
      );

      expect(renderedOrder()).toEqual(["b_field", "a_field"]);
    });

    it("onApply tetap mengirim kolom dalam urutan ASLI (urutan tampilan tak mengubah urutan kolom tabel)", async () => {
      const user = userEvent.setup({ delay: null });
      const onApply = vi.fn();
      renderWithDialog(
        <ColumnsFilter
          columns={unordered}
          onApply={onApply}
          onReset={vi.fn()}
          open
        />,
      );

      await user.click(screen.getByText("TR:core.datatable.columns.apply"));

      expect(onApply.mock.calls[0][0].map((c) => c.name)).toEqual([
        "zeta",
        "alpha",
        "mid",
      ]);
    });

    it("mengikuti locale bahasa aktif (currentLocale) -- 'ä' setelah 'z' di sv", () => {
      currentLocaleMock.mockReturnValue("sv");
      renderWithDialog(
        <ColumnsFilter
          columns={[
            { name: "z", title: "z", show: true, type: "string" },
            { name: "ae", title: "ä", show: true, type: "string" },
            { name: "a", title: "a", show: true, type: "string" },
          ]}
          onApply={vi.fn()}
          onReset={vi.fn()}
          open
        />,
      );

      expect(renderedOrder()).toEqual(["a", "z", "ae"]);
    });
  });
});
