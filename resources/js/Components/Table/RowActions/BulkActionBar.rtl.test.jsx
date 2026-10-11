import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (k, p) => (p ? `TR:${k}:${JSON.stringify(p)}` : `TR:${k}`),
  }),
}));

import { TooltipProvider } from "@/Components/ui/tooltip";
import BulkActionBar from "./BulkActionBar";

const rows = [
  { id: 1, ok: true },
  { id: 2, ok: true },
  { id: 3, ok: false },
  { id: 4, ok: true },
  { id: 5, ok: true },
];

const actions = [
  { key: "single-only", label: "SingleOnly", onAction: vi.fn() },
  { key: "all", label: "AllOk", bulk: true, onAction: vi.fn() },
  {
    key: "partial",
    label: "Partial",
    bulk: true,
    enabled: (r) => r.ok,
    onAction: vi.fn(),
  },
  {
    key: "none",
    label: "None",
    bulk: true,
    enabled: () => false,
    onAction: vi.fn(),
  },
  {
    key: "del",
    label: "Del",
    bulk: true,
    variant: "destructive",
    onAction: vi.fn(),
  },
];

const SELECTED_TEXT = 'TR:core.datatable.selected:{"count":5}';

function setup(props = {}) {
  const onRun = vi.fn();
  const onClear = vi.fn();
  render(
    <TooltipProvider>
      <BulkActionBar
        rows={rows}
        actions={actions}
        pendingKey={null}
        onRun={onRun}
        onClear={onClear}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onRun, onClear };
}

describe("BulkActionBar", () => {
  it("menampilkan jumlah terpilih", () => {
    setup();
    expect(screen.getByText(SELECTED_TEXT)).toBeInTheDocument();
  });

  it("hanya aksi bulk yang dirender", () => {
    setup();
    expect(screen.queryByText(/SingleOnly/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AllOk/ })).toBeInTheDocument();
  });

  it("label bulk_count bila semua eligible", () => {
    setup();
    expect(
      screen.getByRole("button", {
        name: 'TR:core.datatable.bulk_count:{"label":"AllOk","count":5}',
      }),
    ).toBeInTheDocument();
  });

  it("label bulk_count_partial bila sebagian eligible", () => {
    setup();
    expect(
      screen.getByRole("button", {
        name: 'TR:core.datatable.bulk_count_partial:{"label":"Partial","count":4,"total":5}',
      }),
    ).toBeInTheDocument();
  });

  it("disabled bila 0 eligible", () => {
    setup();
    expect(screen.getByRole("button", { name: /None/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /AllOk/ })).toBeEnabled();
  });

  it("semua tombol aksi disabled saat pendingKey tidak null", () => {
    setup({ pendingKey: "all" });
    expect(screen.getByRole("button", { name: /AllOk/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Partial/ })).toBeDisabled();
  });

  it("klik memanggil onRun(action, eligibleRows)", async () => {
    const user = userEvent.setup();
    const { onRun } = setup();

    await user.click(screen.getByRole("button", { name: /Partial/ }));

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0][0].key).toBe("partial");
    expect(onRun.mock.calls[0][1].map((r) => r.id)).toEqual([1, 2, 4, 5]);
  });

  it("tooltip bulk_skipped tampil saat hover bila ada baris dilewati", async () => {
    const user = userEvent.setup();
    setup();

    await user.hover(
      screen.getByRole("button", { name: /Partial/ }).closest("span"),
    );

    expect(
      (await screen.findAllByText('TR:core.datatable.bulk_skipped:{"count":1}'))
        .length,
    ).toBeGreaterThan(0);
  });

  it("aksi destruktif memakai variant destructive", () => {
    setup();
    expect(screen.getByRole("button", { name: /Del/ })).toHaveClass(
      "bg-destructive",
    );
    expect(screen.getByRole("button", { name: /AllOk/ })).not.toHaveClass(
      "bg-destructive",
    );
  });

  it("tombol clear_selection memanggil onClear", async () => {
    const user = userEvent.setup();
    const { onClear } = setup();

    await user.click(
      screen.getByRole("button", { name: "TR:core.datatable.clear_selection" }),
    );

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("render null bila tidak ada baris terpilih", () => {
    const { container } = render(
      <BulkActionBar
        rows={[]}
        actions={actions}
        pendingKey={null}
        onRun={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("variant mobile memakai posisi fixed", () => {
    setup({ variant: "mobile" });
    expect(screen.getByText(SELECTED_TEXT).closest(".fixed")).not.toBeNull();
  });

  it("variant desktop tidak fixed", () => {
    setup();
    expect(screen.getByText(SELECTED_TEXT).closest(".fixed")).toBeNull();
  });
});
