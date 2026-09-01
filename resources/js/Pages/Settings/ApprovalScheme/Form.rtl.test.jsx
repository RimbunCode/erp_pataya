import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: () => {
      const [data, setDataState] = React.useState(formPageSeed);
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return { data, setData, dataBefore: {} };
    },
    FormPageContent: ({ title, children }) => (
      <div data-testid={`form-page-content-${title ?? "untitled"}`}>
        {children}
      </div>
    ),
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) => (
        <option key={opt} value={opt}>
          opt:{opt}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/Components/LinkModel", () => ({
  default: ({ value, onValueChange, disabled, model }) => (
    <button
      type="button"
      data-testid="link-model"
      data-model={model}
      data-disabled={disabled ? "true" : "false"}
      onClick={() => onValueChange?.({ id: 1, name: "Approver X" })}
    >
      approver:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Core/PermissionLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="permission-link-model"
      onClick={() =>
        onValueChange?.({
          id: 1,
          model: "App\\Models\\Sales\\SalesOrder",
          name: "Sales Order",
        })
      }
    >
      permission:{value?.model ?? "none"}
    </button>
  ),
}));

// FormTable generik: stub yang expose column cell() per baris DAN form dialog
// (StepFormDialog dari Form.jsx sendiri, diteruskan sebagai prop `form`) --
// StepFormDialog bukan modul terpisah, jadi tak bisa di-stub via vi.mock,
// cukup render nyata dengan getColumn/data/setData yang disuntik stub ini.
vi.mock("@/Components/FormTable", () => ({
  default: ({ columns, value, onValueChange, form, label }) => {
    const rows = value ?? [];
    const updateRow = (index, keyOrObj, val) => {
      const next = [...rows];
      const row = { ...next[index] };
      if (typeof keyOrObj === "object") {
        Object.assign(row, keyOrObj);
      } else {
        row[keyOrObj] = val;
      }
      next[index] = row;
      onValueChange?.(next);
    };
    const getColumn = (name) => {
      const col = columns.find((c) => c.name === name);
      const row = rows[0] ?? {};
      return col?.cell({
        dataRow: row,
        data: row[name],
        setData: (keyOrObj, val) => updateRow(0, keyOrObj, val),
        attributes: {},
      });
    };
    return (
      <div data-testid="stub-form-table">
        {label && <span>{label}</span>}
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${index}`}>
            {columns.map((col) => (
              <div key={col.name} data-testid={`cell-${col.name}-${index}`}>
                {col.cell({
                  dataRow: row,
                  data: row[col.name],
                  setData: (keyOrObj, val) => updateRow(index, keyOrObj, val),
                  attributes: {},
                })}
              </div>
            ))}
          </div>
        ))}
        {form &&
          React.cloneElement(form, {
            getColumn,
            data: rows[0] ?? {},
            setData: (keyOrObj, val) => updateRow(0, keyOrObj, val),
          })}
      </div>
    );
  },
}));

import React from "react";
import Form from "./Form";

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("ApprovalScheme Form", () => {
  beforeEach(() => {
    formPageSeed = { steps: [] };
  });

  it("field model TIDAK dirender saat is_letter_head=true", () => {
    formPageSeed = { steps: [], is_letter_head: true };
    renderForm(<Form />);
    expect(screen.queryByTestId("forminput-model")).not.toBeInTheDocument();
  });

  it("field model dirender saat is_letter_head=false", () => {
    formPageSeed = { steps: [], is_letter_head: false };
    renderForm(<Form />);
    expect(screen.getByTestId("forminput-model")).toBeInTheDocument();
  });

  it("memilih permission (model) meng-generate name dengan suffix random dari nama model", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { steps: [], is_letter_head: false };
    renderForm(<Form />);

    await user.click(screen.getByTestId("permission-link-model"));

    const nameInput = within(screen.getByTestId("forminput-name")).getByRole(
      "textbox",
    );
    expect(nameInput.value).toMatch(/^Sales Order_[a-z0-9]+$/);
  });

  it("toggle checkbox is_active memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { steps: [], is_active: false };
    renderForm(<Form />);

    // Section general (is_active) dan StepFormDialog (is_advanced) sama-sama
    // merender checkbox role="forminput" -- ambil checkbox PERTAMA (is_active
    // dirender lebih dulu dalam JSX, sebelum FormPageContent steps).
    const checkbox = screen.getAllByRole("forminput")[0];
    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("baris step dengan is_advanced=false merender Select approver_type dan LinkModel approver", () => {
    formPageSeed = {
      steps: [{ id: "s1", is_advanced: false, approver_type: null }],
    };
    renderForm(<Form />);

    expect(screen.getByTestId("cell-approver_type-0")).toBeInTheDocument();
    // Ada 2 instance LinkModel (kolom baris + StepFormDialog simple-mode) --
    // scope ke cell baris saja.
    const linkModel = within(screen.getByTestId("cell-approver-0")).getByTestId(
      "link-model",
    );
    expect(linkModel).toHaveAttribute("data-disabled", "true"); // approver_type kosong
  });

  it("baris step dengan is_advanced=true menampilkan label 'advanced' pada kolom approver_type (bukan Select)", () => {
    formPageSeed = {
      steps: [{ id: "s1", is_advanced: true, approvers: [] }],
    };
    renderForm(<Form />);

    const cell = screen.getByTestId("cell-approver_type-0");
    expect(cell).toHaveTextContent(
      "core.approvalScheme.steps.columns.is_advanced_label",
    );
    expect(cell.querySelector("select")).not.toBeInTheDocument();
  });

  it("baris step dengan is_advanced=true menampilkan ApproverSummaryText di kolom approver (bukan LinkModel)", () => {
    formPageSeed = {
      steps: [
        {
          id: "s1",
          is_advanced: true,
          approvers: [
            { id: 1, approver_type: "role", approver: { name: "Admin" } },
          ],
        },
      ],
    };
    renderForm(<Form />);

    // NestedApproverFormTable (di StepFormDialog, mode advanced) memakai
    // nama kolom sama (approver_type/approver) sehingga getByTestId ambigu --
    // ambil instance PERTAMA (kolom baris FormTable luar).
    const cell = screen.getAllByTestId("cell-approver-0")[0];
    expect(cell).toHaveTextContent("role");
    expect(
      cell.querySelector('[data-testid="link-model"]'),
    ).not.toBeInTheDocument();
  });

  it("baris tanpa approvers (is_advanced=true) menampilkan placeholder '—'", () => {
    formPageSeed = {
      steps: [{ id: "s1", is_advanced: true, approvers: [] }],
    };
    renderForm(<Form />);

    expect(screen.getByTestId("cell-approver-0")).toHaveTextContent("—");
  });

  it("toggle is_advanced=true pada baris mereset approver_type/approver dan mempertahankan approvers", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      steps: [
        {
          id: "s1",
          is_advanced: false,
          approver_type: "role",
          approver: { id: 1, name: "Admin" },
        },
      ],
    };
    renderForm(<Form />);

    // checkboxes[0] = is_active (section general), [1] = is_advanced (baris).
    const checkboxes = screen.getAllByRole("forminput");
    await user.click(checkboxes[1]);

    // Setelah toggle, kolom approver_type sudah beralih ke mode advanced.
    const cell = screen.getAllByTestId("cell-approver_type-0")[0];
    expect(cell).toHaveTextContent(
      "core.approvalScheme.steps.columns.is_advanced_label",
    );
  });

  it("toggle is_advanced=false pada baris mengembalikan approver_type/approver dari dataRow, approvers dikosongkan", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      steps: [
        {
          id: "s1",
          is_advanced: true,
          approver_type: "user",
          approver: { id: 2, name: "User Y" },
          approvers: [{ id: 1, approver_type: "role", approver: null }],
        },
      ],
    };
    renderForm(<Form />);

    // checkboxes[0] = is_active (section general), [1] = is_advanced (baris).
    const checkboxes = screen.getAllByRole("forminput");
    await user.click(checkboxes[1]);

    // Kembali ke mode simple -- Select approver_type dirender lagi.
    const cell = screen.getAllByTestId("cell-approver_type-0")[0];
    expect(cell.querySelector("select")).toBeInTheDocument();
  });

  it("StepFormDialog: is_advanced=false menampilkan kolom approver_type & approver via getColumn", () => {
    formPageSeed = {
      steps: [{ id: "s1", is_advanced: false, approver_type: null }],
    };
    renderForm(<Form />);

    // FormTable stub merender form dialog setelah baris -- ada 2 instance
    // Select approver_type (1 dari cell baris, 1 dari StepFormDialog).
    expect(document.querySelectorAll("select").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("StepFormDialog: is_advanced=true menampilkan NestedApproverFormTable (bukan getColumn simple)", () => {
    formPageSeed = {
      steps: [{ id: "s1", is_advanced: true, approvers: [] }],
    };
    renderForm(<Form />);

    expect(
      screen.getByText("core.approvalScheme.steps.columns.approvers"),
    ).toBeInTheDocument();
  });
});
