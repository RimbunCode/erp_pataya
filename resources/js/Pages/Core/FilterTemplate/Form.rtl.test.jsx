import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, within } from "@testing-library/react";
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

const groupSelects = () =>
  within(document.querySelector('[data-field="group"]')).getAllByRole(
    "combobox",
  );

describe("FilterTemplate Form — field Group by", () => {
  beforeEach(() => {
    latestData = undefined;
    axiosGetMock.mockReset();
    axiosGetMock.mockResolvedValue({ data: { columns: COLUMNS } });
  });

  it("hanya menawarkan kolom groupable + opsi 'tidak diatur'", async () => {
    await renderForm();
    const [columnSelect] = groupSelects();
    const values = [...columnSelect.options].map((o) => o.value);
    expect(values).toEqual(["__none", "created_at", "total", "status"]);
    expect(values).not.toContain("name");
  });

  it("memilih kolom date memunculkan granularity dan menyimpan default 'month'", async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.selectOptions(groupSelects()[0], "created_at");

    expect(latestData.group).toEqual({
      column: "created_at",
      granularity: "month",
      range: null,
    });
    const selects = groupSelects();
    expect(selects).toHaveLength(2);
    expect([...selects[1].options].map((o) => o.value)).toEqual([
      "day",
      "month",
      "quarter",
      "half",
      "year",
    ]);

    await user.selectOptions(selects[1], "quarter");
    expect(latestData.group).toEqual({
      column: "created_at",
      granularity: "quarter",
      range: null,
    });
  });

  it("memilih kolom number memunculkan range dari groupRangeOptions kolom", async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.selectOptions(groupSelects()[0], "total");

    expect(latestData.group).toEqual({
      column: "total",
      granularity: null,
      range: 500,
    });
    const selects = groupSelects();
    expect([...selects[1].options].map((o) => o.value)).toEqual([
      "500",
      "5000",
    ]);

    await user.selectOptions(selects[1], "5000");
    expect(latestData.group.range).toBe(5000);
  });

  it("kolom string tidak menampilkan select tambahan", async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.selectOptions(groupSelects()[0], "status");

    expect(latestData.group).toEqual({
      column: "status",
      granularity: null,
      range: null,
    });
    expect(groupSelects()).toHaveLength(1);
  });

  it("'tidak diatur' mengosongkan group jadi null", async () => {
    const user = userEvent.setup();
    await renderForm({
      group: { column: "created_at", granularity: "year", range: null },
    });
    // Nilai awal dari server tampil apa adanya.
    expect(groupSelects()[0].value).toBe("created_at");
    expect(groupSelects()[1].value).toBe("year");

    await user.selectOptions(groupSelects()[0], "__none");

    expect(latestData.group).toBeNull();
    expect(groupSelects()).toHaveLength(1);
  });

  it("ganti kolom mereset granularity/range (tidak mewarisi kolom sebelumnya)", async () => {
    const user = userEvent.setup();
    await renderForm({
      group: { column: "created_at", granularity: "year", range: null },
    });

    await user.selectOptions(groupSelects()[0], "total");

    expect(latestData.group).toEqual({
      column: "total",
      granularity: null,
      range: 500,
    });
  });

  it("field Group by tidak dirender bila model tak punya kolom groupable", async () => {
    axiosGetMock.mockResolvedValue({
      data: { columns: COLUMNS.filter((c) => !c.groupable) },
    });
    await renderForm();

    expect(document.querySelector('[data-field="group"]')).toBeNull();
  });
});
