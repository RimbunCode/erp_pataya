import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ChartBlock cuma dipanggil `usePage().props.canEdit` (hak akses edit
// Dashboard secara umum) -- BlockEditDialog/Dialog di bawahnya TIDAK
// menyentuh @inertiajs/react sama sekali, jadi mock ini cukup utk seluruh
// pohon komponen yang dirender.
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const permissionCanMock = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({
    can: (...args) => permissionCanMock(...args),
    canGlobal: () => true,
  }),
}));

// ChartDisplay asli memanggil axios + recharts -- di luar cakupan ChartBlock
// (murni sub-komponen display). Diganti stub yang mengekspos prop `chart`
// dan `filters` yang diterimanya sebagai teks, supaya bisa diverifikasi
// tanpa mem-mock axios/recharts.
vi.mock("@/Components/ChartDisplay", () => ({
  default: ({ chart, filters }) => (
    <div data-testid="chart-display">
      <span data-testid="chart-display-id">{chart?.id ?? ""}</span>
      <span data-testid="chart-display-filters">{JSON.stringify(filters)}</span>
    </div>
  ),
}));

// ChartLinkModel asli membungkus LinkModel + Form Chart penuh (popover,
// search, dst) -- di luar cakupan ChartBlock. Stub ini cuma menyediakan
// cara memicu onValueChange dari test, sama seperti field pilih Chart
// sungguhan akan melakukannya.
vi.mock("@/Components/ChartLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="chart-link-model">
      <span data-testid="chart-link-model-value">{value?.id ?? "kosong"}</span>
      <button
        type="button"
        onClick={() => onValueChange({ id: 99, name: "Chart Baru" })}
      >
        Pilih Chart Baru
      </button>
      <button type="button" onClick={() => onValueChange(null)}>
        Hapus Pilihan Chart
      </button>
    </div>
  ),
}));

// "../Link" (custom wrapper Inertia Link) menarik useIsDirtyForm/
// useAlertDraftForm dan @inertiajs/core router -- di luar cakupan ChartBlock,
// yang cuma peduli href/title/className yang diteruskan ke situ. Path mock
// relatif terhadap file test ini (co-located di folder yang sama dengan
// ChartBlock.jsx) sehingga resolve ke modul yang SAMA dgn yang diimpor
// ChartBlock ("../Link" -> Components/Link.jsx).
vi.mock("../Link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

window.route = (name, id) => (id !== undefined ? `${name}/${id}` : name);

import ChartBlock from "./ChartBlock";

const noop = () => {};

describe("ChartBlock", () => {
  beforeEach(() => {
    usePageMock.mockReset();
    permissionCanMock.mockReset();
    usePageMock.mockReturnValue({ props: { canEdit: false } });
    permissionCanMock.mockReturnValue(false);
  });

  describe("tampilan display", () => {
    it("menampilkan placeholder saat block.chart belum ada, ChartDisplay tidak dirender", () => {
      render(
        <ChartBlock
          block={{ chart: null }}
          canEdit={false}
          onUpdate={noop}
          onDelete={noop}
          editOpen={false}
          onEditOpenChange={noop}
        />,
      );

      expect(screen.getByText("Belum ada Chart dipilih")).toBeInTheDocument();
      expect(screen.queryByTestId("chart-display")).not.toBeInTheDocument();
    });

    it("merender ChartDisplay dgn chart terpilih, filters default {} saat block.chart.filters tidak diset", () => {
      const block = { chart: { id: 5, name: "Chart A" } };

      render(
        <ChartBlock
          block={block}
          canEdit={false}
          onUpdate={noop}
          onDelete={noop}
          editOpen={false}
          onEditOpenChange={noop}
        />,
      );

      expect(
        screen.queryByText("Belum ada Chart dipilih"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("chart-display-id")).toHaveTextContent("5");
      expect(screen.getByTestId("chart-display-filters")).toHaveTextContent(
        "{}",
      );
    });

    it("meneruskan block.chart.filters apa adanya ke ChartDisplay kalau sudah diset", () => {
      const block = {
        chart: { id: 5, name: "Chart A", filters: { branch_id: 2 } },
      };

      render(
        <ChartBlock
          block={block}
          canEdit={false}
          onUpdate={noop}
          onDelete={noop}
          editOpen={false}
          onEditOpenChange={noop}
        />,
      );

      expect(screen.getByTestId("chart-display-filters")).toHaveTextContent(
        JSON.stringify({ branch_id: 2 }),
      );
    });
  });

  describe("jalan pintas link 'Edit Chart' (di luar mode edit block)", () => {
    it.each([
      {
        desc: "mode edit block sedang aktif (canEdit=true) -> link tidak muncul walau syarat lain lengkap",
        blockCanEdit: true,
        canEditPermission: true,
        can: true,
        chartId: 5,
        expected: false,
      },
      {
        desc: "hak akses edit Dashboard (page prop canEdit) false -> link tidak muncul",
        blockCanEdit: false,
        canEditPermission: false,
        can: true,
        chartId: 5,
        expected: false,
      },
      {
        desc: "permission write ke Chart false -> link tidak muncul",
        blockCanEdit: false,
        canEditPermission: true,
        can: false,
        chartId: 5,
        expected: false,
      },
      {
        desc: "belum ada Chart terpilih (id kosong) -> link tidak muncul",
        blockCanEdit: false,
        canEditPermission: true,
        can: true,
        chartId: undefined,
        expected: false,
      },
      {
        desc: "semua syarat terpenuhi -> link muncul dgn href charts.show/<id>",
        blockCanEdit: false,
        canEditPermission: true,
        can: true,
        chartId: 5,
        expected: true,
      },
    ])(
      "$desc",
      ({ blockCanEdit, canEditPermission, can, chartId, expected }) => {
        usePageMock.mockReturnValue({ props: { canEdit: canEditPermission } });
        permissionCanMock.mockReturnValue(can);
        const block = {
          chart: chartId ? { id: chartId, name: "Chart A" } : null,
        };

        render(
          <ChartBlock
            block={block}
            canEdit={blockCanEdit}
            onUpdate={noop}
            onDelete={noop}
            editOpen={false}
            onEditOpenChange={noop}
          />,
        );

        const link = screen.queryByTitle("Edit Chart");
        if (expected) {
          expect(link).toBeInTheDocument();
          expect(link).toHaveAttribute("href", `charts.show/${chartId}`);
        } else {
          expect(link).not.toBeInTheDocument();
        }
      },
    );
  });

  describe("BlockEditDialog (mode edit block aktif)", () => {
    it("canEdit=false -> BlockEditDialog tidak pernah dirender, walau editOpen=true", () => {
      render(
        <ChartBlock
          block={{ chart: { id: 1, name: "Chart A" } }}
          canEdit={false}
          onUpdate={noop}
          onDelete={noop}
          editOpen
          onEditOpenChange={noop}
        />,
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("canEdit=true & editOpen=true -> dialog terbuka dgn judul 'Edit Chart' dan draft awal = block.chart", () => {
      render(
        <ChartBlock
          block={{ chart: { id: 1, name: "Chart A" } }}
          canEdit
          onUpdate={noop}
          onDelete={noop}
          editOpen
          onEditOpenChange={noop}
        />,
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText("Edit Chart")).toBeInTheDocument();
      expect(screen.getByTestId("chart-link-model-value")).toHaveTextContent(
        "1",
      );
      expect(
        screen.getByRole("button", { name: "Terapkan" }),
      ).not.toBeDisabled();
    });

    it("draft tanpa Chart terpilih -> pesan validasi muncul dan tombol Terapkan disabled", async () => {
      const user = userEvent.setup();
      render(
        <ChartBlock
          block={{ chart: { id: 1, name: "Chart A" } }}
          canEdit
          onUpdate={noop}
          onDelete={noop}
          editOpen
          onEditOpenChange={noop}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "Hapus Pilihan Chart" }),
      );

      expect(screen.getByText("Chart wajib dipilih.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();
    });

    it("klik Terapkan dgn draft valid memanggil onUpdate dgn chart baru + isNew:false, properti block lain tetap dipertahankan, lalu dialog ditutup", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      const onEditOpenChange = vi.fn();
      const block = {
        id: "blk-1",
        someOtherField: "keep-me",
        chart: { id: 1, name: "Chart A" },
        isNew: true,
      };

      render(
        <ChartBlock
          block={block}
          canEdit
          onUpdate={onUpdate}
          onDelete={noop}
          editOpen
          onEditOpenChange={onEditOpenChange}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "Pilih Chart Baru" }),
      );
      await user.click(screen.getByRole("button", { name: "Terapkan" }));

      expect(onUpdate).toHaveBeenCalledWith({
        ...block,
        chart: { id: 99, name: "Chart Baru" },
        isNew: false,
      });
      expect(onEditOpenChange).toHaveBeenCalledWith(false);
    });

    it("Batal saat block baru (isNew=true) memanggil onDelete (onCancelNew), BUKAN onEditOpenChange", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const onEditOpenChange = vi.fn();

      render(
        <ChartBlock
          block={{ chart: null, isNew: true }}
          canEdit
          onUpdate={noop}
          onDelete={onDelete}
          editOpen
          onEditOpenChange={onEditOpenChange}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Batal" }));

      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onEditOpenChange).not.toHaveBeenCalled();
    });

    it("Batal saat block BUKAN baru (isNew=false) memanggil onEditOpenChange(false), BUKAN onDelete", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const onEditOpenChange = vi.fn();

      render(
        <ChartBlock
          block={{ chart: { id: 1, name: "Chart A" }, isNew: false }}
          canEdit
          onUpdate={noop}
          onDelete={onDelete}
          editOpen
          onEditOpenChange={onEditOpenChange}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Batal" }));

      expect(onEditOpenChange).toHaveBeenCalledWith(false);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
