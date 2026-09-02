import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { lang: "en" } }),
}));

const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...args) => axiosGet(...args) },
}));

// NestedSelect (column picker) dan Select (operator picker) masing-masing
// punya kompleksitas sendiri (Command/Popover/cmdk, lazy-load, search) dan
// pantas ditest terpisah -- di sini di-stub jadi daftar tombol sederhana
// (pola sama seperti FilterItem di-stub di FilterTable.rtl.test.jsx) supaya
// test FilterItem fokus ke logic milik file ini sendiri: buildColumnNode/
// columnOptions, changeOperators, cascade re-validasi operator, dan pemilihan
// varian input value (UISelect/DatetimePicker/Input). Props yang diterima
// tiap stub di-capture via spy agar bisa diverifikasi presisi (options,
// disabled, fetchChildren) tanpa perlu render internal cmdk yang berat.
const nestedSelectSpy = vi.fn();
vi.mock("../NestedSelect", () => ({
  default: (props) => {
    nestedSelectSpy(props);
    return (
      <div data-testid="nested-select">
        {props.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => props.onValueChange(opt.value)}
          >
            pilih-kolom-{opt.value}
          </button>
        ))}
      </div>
    );
  },
}));

const operatorSelectSpy = vi.fn();
vi.mock("../Select", () => ({
  default: (props) => {
    operatorSelectSpy(props);
    return (
      <div
        data-testid="operator-select"
        data-disabled={String(!!props.disabled)}
      >
        {props.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => props.onValueChange(opt.value)}
          >
            pilih-operator-{opt.value}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("../DatetimePicker", () => ({
  default: (props) => (
    <input
      data-testid="datetime-picker"
      data-type={props.type}
      value={props.value ?? ""}
      onChange={(e) => props.onValueChange(e.target.value)}
    />
  ),
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import FilterItem from "./FilterItem";

const columns = [
  { name: "id", title: "ID", type: "number", primaryKey: "id" },
  {
    name: "name",
    title: "Name",
    type: "text",
    searchType: "text",
    primaryKey: "id",
  },
  { name: "secret", title: "Secret", hidden: true, primaryKey: "id" },
  { name: "legacy", title: "Legacy", searchable: false, primaryKey: "id" },
  { name: "ignored_col", title: "Ignored", ignore: true, primaryKey: "id" },
  { name: "canUpdate", title: "Can Update", primaryKey: "id" },
  {
    name: "amount",
    title: "Amount",
    type: "number",
    searchType: "number",
    primaryKey: "id",
  },
  {
    name: "status",
    title: "Status",
    searchType: ["open", "closed"],
    parse: { open: "Open", closed: "Closed" },
    primaryKey: "id",
  },
  {
    name: "is_active",
    title: "Active",
    searchType: "boolean",
    parse: { true: "Yes", false: "No" },
    primaryKey: "id",
  },
  {
    name: "created_at",
    title: "Created At",
    searchType: "date",
    primaryKey: "id",
  },
  {
    name: "priority",
    title: "Priority",
    searchType: ["low_priority", "high"],
    primaryKey: "id",
  },
  {
    name: "category",
    title: "Category",
    type: "relation",
    related: "categories",
    primaryKey: "id",
  },
];

function baseProps(overrides = {}) {
  return {
    id: "f1",
    columns,
    column: "",
    operator: "",
    value: "",
    onChanged: vi.fn(),
    removeFilter: vi.fn(),
    ...overrides,
  };
}

// Harness meniru cara FilterTable memakai FilterItem: onChanged(id, payload)
// merge ke state parent lalu di-passing ulang sbg props terkontrol -- ini
// PENTING utk test cascade (ganti kolom/operator) karena useDidMountEffect
// di FilterItem membaca props.operator TERKINI, yang hanya berubah lewat
// jalur ini (bukan lewat rerender manual dgn prop baru begitu saja).
// debug-state dump JSON state parent supaya assert hasil akhir akurat tanpa
// bergantung pada representasi visual Radix yang sulit diverifikasi.
function Harness({ initial, cols }) {
  const [filter, setFilter] = useState(initial);
  const onChanged = (_id, payload) => {
    setFilter((prev) => ({ ...prev, ...payload }));
  };
  return (
    <div>
      <pre data-testid="debug-state">{JSON.stringify(filter)}</pre>
      <FilterItem
        id={filter.id}
        columns={cols}
        column={filter.column}
        operator={filter.operator}
        value={filter.value}
        onChanged={onChanged}
        removeFilter={vi.fn()}
      />
    </div>
  );
}

function readDebugState() {
  return JSON.parse(screen.getByTestId("debug-state").textContent);
}

beforeEach(() => {
  axiosGet.mockReset();
  nestedSelectSpy.mockClear();
  operatorSelectSpy.mockClear();
});

describe("FilterItem — opsi kolom (NestedSelect)", () => {
  it("mengecualikan hidden/searchable=false/ignore/primaryKey/meta-append dari opsi kolom", () => {
    render(<FilterItem {...baseProps()} />);
    const { options } = nestedSelectSpy.mock.calls.at(-1)[0];
    expect(options.map((o) => o.value)).toEqual([
      "name",
      "amount",
      "status",
      "is_active",
      "created_at",
      "priority",
      "category",
    ]);
  });

  it("kolom relasi tanpa nested columns ditandai loadable utk lazy-fetch", () => {
    render(<FilterItem {...baseProps()} />);
    const { options } = nestedSelectSpy.mock.calls.at(-1)[0];
    const category = options.find((o) => o.value === "category");
    expect(category).toMatchObject({
      label: "Category",
      type: "relation",
      relation: "categories",
      loadable: true,
      children: [],
    });
  });
});

describe("FilterItem — daftar operator (changeOperators)", () => {
  it("kolom text -> operatorsGeneral (6 opsi)", () => {
    render(<FilterItem {...baseProps({ column: "name" })} />);
    const { options } = operatorSelectSpy.mock.calls.at(-1)[0];
    expect(options.map((o) => o.value)).toEqual([
      "eq",
      "!eq",
      "like",
      "!like",
      "in",
      "!in",
    ]);
  });

  it("kolom number -> operatorsGeneral + operatorsNumber (14 opsi)", () => {
    // BUG (lihat bugFindings): changeOperators() case "number" (FilterItem.jsx
    // ~L240) melakukan [...operatorsGeneral, ...operatorsNumber] apa adanya,
    // padahal KEDUA array itu masing-masing sudah punya entri "in"/"!in"
    // sendiri -> utk kolom number, operator "in" dan "!in" muncul GANDA di
    // hasil (14 opsi, tapi cuma 12 nama unik). React juga melempar warning
    // "Encountered two children with the same key" saat operator select
    // merender daftar ini. Test ini meng-assert PERILAKU SAAT INI (duplikat
    // ikut ter-assert), bukan perilaku yang seharusnya.
    render(<FilterItem {...baseProps({ column: "amount" })} />);
    const { options } = operatorSelectSpy.mock.calls.at(-1)[0];
    const values = options.map((o) => o.value);
    expect(values).toHaveLength(14);
    expect(values.filter((v) => v === "in")).toHaveLength(2);
    expect(values.filter((v) => v === "!in")).toHaveLength(2);
    expect(new Set(values).size).toBe(12);
    expect(values).toEqual(
      expect.arrayContaining([">", "<", ">=", "<=", "between", "!between"]),
    );
  });

  it("kolom date -> operatorsDate (8 opsi)", () => {
    render(<FilterItem {...baseProps({ column: "created_at" })} />);
    const { options } = operatorSelectSpy.mock.calls.at(-1)[0];
    expect(options.map((o) => o.value)).toEqual([
      "eq",
      "!eq",
      ">",
      "<",
      ">=",
      "<=",
      "between",
      "!between",
    ]);
  });

  it("kolom tak ditemukan di daftar columns -> operators kosong, Select disabled", () => {
    render(<FilterItem {...baseProps({ column: "doesnotexist" })} />);
    const props = operatorSelectSpy.mock.calls.at(-1)[0];
    expect(props.options).toHaveLength(0);
    expect(props.disabled).toBe(true);
  });
});

describe("FilterItem — cascade ganti kolom (Harness)", () => {
  it("ganti kolom mereset operator & value milik parent ke string kosong", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ id: "f1", column: "name", operator: "eq", value: "hello" }}
        cols={columns}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "pilih-kolom-amount" }),
    );

    await waitFor(() => {
      const state = readDebugState();
      expect(state.column).toBe("amount");
      expect(state.operator).toBe("");
      expect(state.value).toBe("");
    });
  });

  it("ganti kolom text->number memperbarui daftar opsi operator dari 6 jadi 14", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ id: "f1", column: "name", operator: "eq", value: "" }}
        cols={columns}
      />,
    );
    expect(operatorSelectSpy.mock.calls.at(-1)[0].options).toHaveLength(6);

    await user.click(
      screen.getByRole("button", { name: "pilih-kolom-amount" }),
    );

    await waitFor(() => {
      expect(operatorSelectSpy.mock.calls.at(-1)[0].options).toHaveLength(14);
    });
  });
});

describe("FilterItem — cascade ganti operator (Harness)", () => {
  it("ganti operator dalam grup options sama (status eq->!eq) mempertahankan value", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ id: "f1", column: "status", operator: "eq", value: "open" }}
        cols={columns}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "pilih-operator-!eq" }),
    );

    await waitFor(() => {
      const state = readDebugState();
      expect(state.operator).toBe("!eq");
      expect(state.value).toBe("open");
    });
  });

  it("ganti operator ke grup options beda (status eq->like) mereset value", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{ id: "f1", column: "status", operator: "eq", value: "open" }}
        cols={columns}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "pilih-operator-like" }),
    );

    await waitFor(() => {
      const state = readDebugState();
      expect(state.operator).toBe("like");
      expect(state.value).toBe("");
    });
  });
});

describe("FilterItem — varian input value", () => {
  it("default (operator tanpa options/searchType date) merender Input teks; mengetik memicu onChanged(value)", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(
      <FilterItem
        {...baseProps({ column: "name", operator: "eq", onChanged })}
      />,
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "text");
    expect(input).not.toBeDisabled();

    await user.type(input, "z");

    expect(onChanged).toHaveBeenLastCalledWith("f1", { value: "z" });
  });

  it("operator searchType number merender Input type number", () => {
    render(
      <FilterItem
        {...baseProps({ column: "amount", operator: ">", value: "5" })}
      />,
    );
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveValue(5);
  });

  it("operator dgn options {title,value} (boolean+parse) merender label title, mengirim value asli saat dipilih", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(
      <FilterItem
        {...baseProps({ column: "is_active", operator: "eq", onChanged })}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Yes" }));

    expect(onChanged).toHaveBeenCalledWith("f1", { value: "true" });
  });

  it("operator dgn options array tanpa parse merender string apa adanya (format tampilan saja), mengirim value asli saat dipilih", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(
      <FilterItem
        {...baseProps({ column: "priority", operator: "eq", onChanged })}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(
      screen.getByRole("option", { name: "low priority" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "low priority" }));

    expect(onChanged).toHaveBeenCalledWith("f1", { value: "low_priority" });
  });

  it("operator searchType date merender DatetimePicker type date, meneruskan onValueChange", () => {
    const onChanged = vi.fn();
    render(
      <FilterItem
        {...baseProps({ column: "created_at", operator: "eq", onChanged })}
      />,
    );
    const picker = screen.getByTestId("datetime-picker");
    expect(picker).toHaveAttribute("data-type", "date");

    fireEvent.change(picker, { target: { value: "2026-01-01" } });

    expect(onChanged).toHaveBeenCalledWith("f1", { value: "2026-01-01" });
  });

  it("operator between pada kolom date merender DatetimePicker type daterange", () => {
    render(
      <FilterItem
        {...baseProps({ column: "created_at", operator: "between" })}
      />,
    );
    expect(screen.getByTestId("datetime-picker")).toHaveAttribute(
      "data-type",
      "daterange",
    );
  });

  it("operator dengan description menampilkan teks translasi description", () => {
    render(<FilterItem {...baseProps({ column: "name", operator: "like" })} />);
    expect(
      screen.getByText("TR:core.datatable.filter.operator.like.description"),
    ).toBeInTheDocument();
  });

  it("operator tanpa description tidak menampilkan paragraf description", () => {
    render(<FilterItem {...baseProps({ column: "name", operator: "eq" })} />);
    expect(
      screen.queryByText(
        /TR:core\.datatable\.filter\.operator\..*\.description/,
      ),
    ).not.toBeInTheDocument();
  });
});

describe("FilterItem — hapus baris", () => {
  it("klik tombol hapus (X) memanggil removeFilter(id)", async () => {
    const user = userEvent.setup();
    const removeFilter = vi.fn();
    const { container } = render(
      <FilterItem {...baseProps({ id: "f7", removeFilter })} />,
    );
    const removeButton = container
      .querySelector("svg.lucide-x")
      .closest("button");

    await user.click(removeButton);

    expect(removeFilter).toHaveBeenCalledWith("f7");
  });
});

describe("FilterItem — fetchRelationColumns (lazy-load kolom relasi)", () => {
  it("sukses: axios.get ke model.columns dgn model relasi, hasil di-map via buildColumnNode", async () => {
    axiosGet.mockResolvedValueOnce({
      data: { columns: [{ name: "title", title: "Title", type: "text" }] },
    });
    render(<FilterItem {...baseProps()} />);
    const { options, fetchChildren } = nestedSelectSpy.mock.calls.at(-1)[0];
    const categoryNode = options.find((o) => o.value === "category");

    const children = await fetchChildren(categoryNode);

    expect(axiosGet).toHaveBeenCalledWith(
      'model.columns/{"model":"categories"}',
    );
    expect(children).toEqual([
      {
        label: "Title",
        value: "category.title",
        type: "text",
        relation: undefined,
        children: [],
        loadable: false,
      },
    ]);
  });

  it("gagal (axios reject): mengembalikan [] dan mencatat error, tidak throw", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    axiosGet.mockRejectedValueOnce(new Error("network down"));
    render(<FilterItem {...baseProps()} />);
    const { options, fetchChildren } = nestedSelectSpy.mock.calls.at(-1)[0];
    const categoryNode = options.find((o) => o.value === "category");

    const children = await fetchChildren(categoryNode);

    expect(children).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
