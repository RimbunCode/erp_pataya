import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
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
});
