import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormTable from "./FormTable";
import { duplicateRuleItem } from "@/Pages/Settings/Modules/DefaultRulesSettings";
import { Input } from "./ui/input";

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
  it("duplicates a persisted rule with a new row key and without its database id before editing", async () => {
    const onValueChange = vi.fn();
    const savedRule = {
      id: "rule-1",
      __row_key: "rule-1",
      item_type: "goods",
    };

    function RuleTableHarness() {
      const [rules, setRules] = useState([savedRule]);

      return (
        <FormTable
          name="RuleDuplicationTest"
          keyItem="__row_key"
          columns={[{ name: "item_type", title: "Item type", show: true }]}
          value={rules}
          onValueChange={(nextRules, changedKey) => {
            onValueChange(nextRules, changedKey);
            setRules(nextRules);
          }}
          onDuplicateRow={duplicateRuleItem}
          actions={({ row, toggleDialog }) =>
            row?.id && (
              <button type="button" onClick={toggleDialog}>
                Edit {row.id}
              </button>
            )
          }
        />
      );
    }

    render(<RuleTableHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Edit rule-1" }));
    await userEvent.click(
      screen.getByRole("button", { name: "core.formtable.duplicate" }),
    );

    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    const rules = onValueChange.mock.lastCall[0];
    expect(rules).toHaveLength(2);
    expect(rules[0]).toEqual(expect.objectContaining(savedRule));
    expect(rules[1]).not.toHaveProperty("id");
    expect(rules[1].__row_key).toBeTruthy();
    expect(rules[1].__row_key).not.toBe(savedRule.__row_key);
    expect(rules[1].item_type).toBe("goods");
    expect(onValueChange.mock.lastCall[1]).toBe(rules[1].__row_key);
  });

  it("offers row actions for a completed unsaved row with default fields", async () => {
    const defaultValueRow = { priority: 0 };

    render(
      <FormTable
        name="UnsavedDefaultRule"
        keyItem="__row_key"
        columns={[
          { name: "document_type", title: "Document type", show: true },
          { name: "item_type", title: "Item type", show: true },
          { name: "is_stock_item", title: "Stock", show: true },
          { name: "item_category_id", title: "Category", show: true },
          { name: "tax_id", title: "Tax", show: true },
          { name: "priority", title: "Priority", show: true },
        ]}
        value={[
          {
            ...defaultValueRow,
            __row_key: "draft-rule",
            document_type: "purchase_order",
            item_type: "goods",
            is_stock_item: "",
            item_category_id: "",
            tax_id: "",
          },
        ]}
        defaultValueRow={defaultValueRow}
        actions={({ row, toggleDialog }) =>
          row?.__row_key === "draft-rule" && (
            <button type="button" onClick={toggleDialog}>
              Edit draft rule
            </button>
          )
        }
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Edit draft rule" }),
    );

    expect(
      screen.getByRole("button", { name: "core.formtable.duplicate" }),
    ).toBeInTheDocument();
  });

  it("preserves persisted rule ids when the parent reorders and syncs rows", async () => {
    const onValueChange = vi.fn();
    const savedRules = [
      { id: "rule-1", __row_key: "rule-1", item_type: "goods" },
      { id: "rule-2", __row_key: "rule-2", item_type: "services" },
    ];

    function RuleTableHarness() {
      const [rules, setRules] = useState(savedRules);

      return (
        <>
          <button type="button" onClick={() => setRules([...rules].reverse())}>
            Reorder rules
          </button>
          <FormTable
            name="RuleReorderTest"
            keyItem="__row_key"
            columns={[{ name: "item_type", title: "Item type", show: true }]}
            value={rules}
            onValueChange={(nextRules) => {
              onValueChange(nextRules);
              setRules(nextRules);
            }}
            onDuplicateRow={duplicateRuleItem}
          />
        </>
      );
    }

    render(<RuleTableHarness />);
    await userEvent.click(
      screen.getByRole("button", { name: "Reorder rules" }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("textbox")[0]).toHaveValue("services"),
    );
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "updated" },
    });

    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
    expect(onValueChange.mock.lastCall[0].map(({ id }) => id)).toEqual([
      "rule-2",
      "rule-1",
    ]);
  });

  it("edits only the supplied row and exposes custom actions without built-in mutation actions", async () => {
    const onValueChange = vi.fn();
    render(
      <FormTable
        name="FixedSourceItems"
        fixedRows
        columns={columns}
        value={[{ id: "source-1", quantity: "2" }]}
        onValueChange={onValueChange}
        actions={({ row, toggleDialog }) =>
          row && (
            <button type="button" onClick={toggleDialog}>
              Edit {row.id}
            </button>
          )
        }
      />,
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Edit source-1" }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "core.formtable.duplicate" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "core.form.close_and_apply" }),
    );
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

  it("navigates to a custom Input cell with Enter", () => {
    const customColumns = ["first", "second"].map((name) => ({
      name,
      title: name,
      show: true,
      cell: ({ data, attributes }) => (
        <Input
          aria-label={name}
          value={data ?? ""}
          onChange={() => {}}
          ref={attributes.ref}
          onKeyDown={attributes.onKeyDown}
          readOnly={attributes.readOnly}
        />
      ),
    }));

    render(
      <FormTable
        name="CustomKeyboardCells"
        columns={customColumns}
        value={[{ id: "line-1", first: "A", second: "B" }]}
      />,
    );

    const firstCell = screen.getAllByRole("textbox", { name: "first" })[0];
    const secondCell = screen.getAllByRole("textbox", { name: "second" })[0];

    fireEvent.keyDown(firstCell, { key: "Enter" });

    expect(secondCell).toHaveFocus();
  });

  it("keeps fixed source columns readable in a horizontally scrollable grid", () => {
    const { container } = render(
      <FormTable
        name="WideSourceItems"
        fixedRows
        columns={[
          {
            name: "item",
            title: "Item",
            width: 2,
            minWidth: 220,
            locked: true,
          },
        ]}
        value={[{ id: "source-1", item: "Part A" }]}
      />,
    );
    const grid = container.querySelector("[style*='grid-template-columns']");
    expect(grid).toHaveClass("overflow-x-auto");
    expect(grid.style.gridTemplateColumns).toContain("minmax(220px, 2fr)");
  });
});
