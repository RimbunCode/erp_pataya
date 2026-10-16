import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormTable from "./FormTable";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPageMeta: () => null,
  FormChildren: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/Hooks/useCanUpdate", () => ({ default: () => true }));
vi.mock("@/Hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("./ui/tooltip", () => ({
  Tooltip: ({ children }) => <>{children}</>,
  TooltipTrigger: ({ children }) => <>{children}</>,
  TooltipContent: () => null,
}));

const columns = [{ name: "quantity", title: "Quantity", required: true }];

describe("FormTable fixed source rows", () => {
  it("edits only the supplied row and exposes custom actions without built-in mutation actions", async () => {
    const onValueChange = vi.fn();
    render(
      <FormTable
        name="FixedSourceItems"
        fixedRows
        columns={columns}
        value={[{ id: "source-1", quantity: "2" }]}
        onValueChange={onValueChange}
        actions={({ row, toggleDialog }) => row && (
          <button type="button" onClick={toggleDialog}>
            Edit {row.id}
          </button>
        )}
      />,
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Edit source-1" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "core.formtable.duplicate" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "core.form.close_and_apply" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "3" } });
    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    expect(onValueChange.mock.lastCall[0]).toEqual([
      expect.objectContaining({ id: "source-1", quantity: "3" }),
    ]);
  });

  it("keeps the normal trailing row when fixedRows is not requested", () => {
    render(
      <FormTable
        name="NormalItems"
        columns={columns}
        value={[{ id: "line-1", quantity: "2" }]}
      />,
    );
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("keeps fixed source columns readable in a horizontally scrollable grid", () => {
    const { container } = render(
      <FormTable
        name="WideSourceItems"
        fixedRows
        columns={[{ name: "item", title: "Item", width: 2, minWidth: 220, locked: true }]}
        value={[{ id: "source-1", item: "Part A" }]}
      />,
    );
    const grid = container.querySelector("[style*='grid-template-columns']");
    expect(grid).toHaveClass("overflow-x-auto");
    expect(grid.style.gridTemplateColumns).toContain("minmax(220px, 2fr)");
  });
});
