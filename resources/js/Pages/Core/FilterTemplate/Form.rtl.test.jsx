import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";

// t = identitas supaya label/opsi bisa diassert lewat key i18n-nya.
const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// Kolom model dari endpoint `model.columns` -- campuran groupable (date,
// number, string) dan non-groupable, supaya penyaringan `groupable` teruji.
const COLUMNS = [
  {
    name: "created_at",
    titleTrans: "col.created_at",
    type: "date",
    groupable: true,
    sortable: true,
  },
  {
    name: "total",
    titleTrans: "col.total",
    type: "currency",
    groupable: true,
    groupRangeOptions: [500, 5000],
  },
  { name: "status", titleTrans: "col.status", type: "string", groupable: true },
  { name: "name", titleTrans: "col.name", type: "string", groupable: false },
];
const axiosGetMock = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: (...a) => axiosGetMock(...a),
    post: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

vi.stubGlobal("route", (name) => name);

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { auth: { user: { id: 1 } } } }),
}));

// FormPage: useFormPage dari Context nyata + useState (setData harus reaktif
// & mendukung bentuk (key, value) maupun updater function, sama spt aslinya).
const FormPageTestContext = React.createContext(null);
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => React.useContext(FormPageTestContext),
  FormPageContent: ({ title, children }) => (
    <div>
      {title != null && <div role="heading">{title}</div>}
      {children}
    </div>
  ),
}));

// Komponen input generik -- bukan tanggung jawab test ini (lihat pola
// PrintTemplate/Form.rtl.test.jsx). FormInput dibungkus data-field=<name>
// supaya Select bisa dicari lewat `within()`, bukan urutan DOM yang rapuh.
vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-field={name}>
      {label && <label>{label}</label>}
      {children}
    </div>
  ),
}));
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options }) => (
    <select value={value ?? ""} onChange={(e) => onValueChange(e.target.value)}>
      {(options ?? []).map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/Components/LinkModel", () => ({ default: () => <div /> }));
vi.mock("../PermissionLinkModel", () => ({ default: () => <div /> }));
vi.mock("@/Components/ui/input", () => ({ Input: () => <input /> }));
vi.mock("@/Components/ui/button", () => ({
  Button: ({ children, ...p }) => <button {...p}>{children}</button>,
}));
vi.mock("@/Components/Table/Filter/FilterBuilder", () => ({
  FilterBuilderBody: () => <div data-testid="builder" />,
}));
vi.mock("@/Hooks/useNestedFilters", () => ({
  default: () => ({ setFromInitial: vi.fn() }),
  NestedFiltersProvider: ({ children }) => <>{children}</>,
}));

import Form from "./Form";

function Harness({ initialData }) {
  const [data, setData] = useState(initialData);
  const handleSetData = (keyOrUpdater, value) =>
    setData((prev) =>
      typeof keyOrUpdater === "function"
        ? keyOrUpdater(prev)
        : { ...prev, [keyOrUpdater]: value },
    );
  // Ekspos state terkini utk assertion payload.
  latestData = data;
  return (
    <FormPageTestContext.Provider value={{ data, setData: handleSetData }}>
      <Form />
    </FormPageTestContext.Provider>
  );
}
let latestData;

async function renderForm(initialData = {}) {
  await act(async () => {
    render(
      <Harness
        initialData={{
          model: "App\\Models\\Sales\\SalesOrder",
          ...initialData,
        }}
      />,
    );
  });
}

const groupField = () => within(document.querySelector('[data-field="group"]'));
// Baris editor = role="checkbox" ber-aria-label = label kolom (t = identitas).
const groupRows = () =>
  groupField()
    .getAllByRole("checkbox")
    .map((row) => ({
      label: row.getAttribute("aria-label"),
      checked: row.getAttribute("aria-checked"),
    }));

describe("FilterTemplate Form — field Group by (GroupLevelsEditor)", () => {
  beforeEach(() => {
    latestData = undefined;
    axiosGetMock.mockReset();
    axiosGetMock.mockResolvedValue({ data: { columns: COLUMNS } });
  });

  it("hanya menawarkan kolom groupable sbg checkbox (tanpa opsi 'tidak diatur')", async () => {
    await renderForm();

    expect(
      groupRows()
        .map((row) => row.label)
        .sort(),
    ).toEqual(["col.created_at", "col.status", "col.total"]);
    expect(groupRows().every((row) => row.checked === "false")).toBe(true);
  });

  it("mencentang kolom date menyimpan default granularity 'month' dan menampilkan Select granularity", async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.click(
      groupField().getByRole("checkbox", { name: "col.created_at" }),
    );

    expect(latestData.group).toEqual([
      { column: "created_at", granularity: "month", range: null },
    ]);
    const trigger = groupField().getByRole("combobox", {
      name: "core.datatable.group_levels.granularity",
    });
    await user.click(trigger);
    await user.click(
      await screen.findByRole("option", {
        name: "core.datatable.granularity.quarter",
      }),
    );

    expect(latestData.group).toEqual([
      { column: "created_at", granularity: "quarter", range: null },
    ]);
  });

  it("mencentang kolom number menyimpan opsi range PERTAMA dari groupRangeOptions kolom itu", async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.click(groupField().getByRole("checkbox", { name: "col.total" }));

    expect(latestData.group).toEqual([
      { column: "total", granularity: null, range: 500 },
    ]);
    await user.click(
      groupField().getByRole("combobox", {
        name: "core.datatable.group_range",
      }),
    );
    expect(await screen.findAllByRole("option")).toHaveLength(2);
    await user.click(screen.getByRole("option", { name: "5000" }));

    expect(latestData.group[0].range).toBe(5000);
  });

  it("beberapa kolom = grup BERTINGKAT: urutan centang = urutan nesting", async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.click(
      groupField().getByRole("checkbox", { name: "col.status" }),
    );
    await user.click(
      groupField().getByRole("checkbox", { name: "col.created_at" }),
    );

    expect(latestData.group.map((level) => level.column)).toEqual([
      "status",
      "created_at",
    ]);
    // Aktif di atas (berurutan), non-aktif di bawah.
    expect(groupRows().map((row) => row.label)).toEqual([
      "col.status",
      "col.created_at",
      "col.total",
    ]);
  });

  it("nilai awal dari server (list bertingkat) tampil aktif di atas dgn urutan yang sama", async () => {
    await renderForm({
      group: [
        { column: "status", granularity: null, range: null },
        { column: "created_at", granularity: "year", range: null },
      ],
    });

    expect(groupRows()).toEqual([
      { label: "col.status", checked: "true" },
      { label: "col.created_at", checked: "true" },
      { label: "col.total", checked: "false" },
    ]);
    expect(
      groupField().getByRole("combobox", {
        name: "core.datatable.group_levels.granularity",
      }),
    ).toHaveTextContent("core.datatable.granularity.year");
  });

  it("objek lama {column,...} (1 level) tetap dibaca sbg satu level aktif", async () => {
    await renderForm({
      group: { column: "created_at", granularity: "year", range: null },
    });

    expect(groupRows()[0]).toEqual({
      label: "col.created_at",
      checked: "true",
    });
  });

  it("menghapus centang terakhir mengosongkan group jadi null (tak mengatur)", async () => {
    const user = userEvent.setup();
    await renderForm({
      group: [{ column: "status", granularity: null, range: null }],
    });

    await user.click(
      groupField().getByRole("checkbox", { name: "col.status" }),
    );

    expect(latestData.group).toBeNull();
  });

  it("field Group by tidak dirender bila model tak punya kolom groupable", async () => {
    axiosGetMock.mockResolvedValue({
      data: { columns: COLUMNS.filter((c) => !c.groupable) },
    });
    await renderForm();

    expect(document.querySelector('[data-field="group"]')).toBeNull();
  });
});
