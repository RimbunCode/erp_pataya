// Test kontrak useColumnValueInput (task 6.5): `onCommit` dipanggil dgn patch +
// meta yang benar utk tiap jalur (leaf baru, edit leaf, pilihan tunggal yang
// langsung ter-apply), keyboard value-mode, dan opsi `commitOnEscape`
// (spec datatable2-column-search-row, Requirement 6.1-6.3, 4.3, 4.4, 10.2).
// Perilaku detail per tipe sudah dijaga SearchBar.rtl.test.jsx; di sini hanya
// kontrak hook yang dipakai Sel Filter.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: (key, params) =>
      params ? `TR:${key}:${JSON.stringify(params)}` : `TR:${key}`,
  }),
}));

vi.mock("axios", () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
}));

window.route = (name) => name;

import useColumnValueInput from "./useColumnValueInput";

const qty = { name: "qty", title: "Jumlah", type: "number" };
const name = { name: "name", title: "Nama", type: "string" };
const active = { name: "active", title: "Aktif", type: "boolean" };

function Harness({ expose, commitOnEscape, ...cbs }) {
  const inputRef = useRef(null);
  const value = useColumnValueInput({
    inputRef,
    commitOnEscape,
    ...cbs,
  });
  expose.current = value;
  return (
    <div>
      <input
        ref={inputRef}
        aria-label="input"
        value={value.inputValue}
        onChange={value.handleChange}
        onKeyDown={value.handleKeyDown}
      />
      <span data-testid="mode">{value.mode}</span>
      <span data-testid="error">{value.valueError ?? ""}</span>
    </div>
  );
}

const setup = (props = {}) => {
  const expose = { current: null };
  const onCommit = vi.fn(() => ({ root: { k: "and", c: {} } }));
  const onRequestOpen = vi.fn();
  const onRequestClose = vi.fn();
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <Harness
        expose={expose}
        onCommit={onCommit}
        onRequestOpen={onRequestOpen}
        onRequestClose={onRequestClose}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { expose, onCommit, onRequestOpen, onRequestClose };
};

const enter = (expose, column, opts) =>
  act(() => {
    expose.current.enterValueMode(column, opts);
  });

describe("useColumnValueInput — kontrak onCommit", () => {
  it("enterValueMode: mode value aktif dan host diminta membuka dropdown", () => {
    const { expose, onRequestOpen } = setup();
    expect(screen.getByTestId("mode").textContent).toBe("key");
    enter(expose, qty);
    expect(screen.getByTestId("mode").textContent).toBe("value");
    expect(onRequestOpen).toHaveBeenCalled();
  });

  it("number bersimbol (>=5) + Enter -> patch langsung, leaf baru, tanpa apply, lalu tutup", async () => {
    const user = userEvent.setup();
    const { expose, onCommit, onRequestClose } = setup();
    enter(expose, qty);
    await user.type(screen.getByLabelText("input"), ">=5{Enter}");
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      { k: "qty", o: ">=", v: 5 },
      { editId: null, apply: false },
    );
    expect(onRequestClose).toHaveBeenCalled();
    expect(screen.getByTestId("mode").textContent).toBe("key");
  });

  it("text polos: Enter pertama jadi chip, Enter kedua (kosong) commit matches", async () => {
    const user = userEvent.setup();
    const { expose, onCommit } = setup();
    enter(expose, name);
    const input = screen.getByLabelText("input");
    await user.type(input, "abc{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(expose.current.visibleValueChips.map((c) => c.label)).toEqual([
      "abc",
    ]);
    await user.type(input, "{Enter}");
    expect(onCommit).toHaveBeenCalledWith(
      { k: "name", o: "matches", v: "abc" },
      { editId: null, apply: false },
    );
  });

  it("edit leaf: editId diteruskan ke onCommit", async () => {
    const user = userEvent.setup();
    const { expose, onCommit } = setup();
    enter(expose, qty, { editId: "L1", initialText: ">=5" });
    await user.type(screen.getByLabelText("input"), "{Enter}");
    expect(onCommit).toHaveBeenCalledWith(
      { k: "qty", o: ">=", v: 5 },
      { editId: "L1", apply: false },
    );
  });

  it("pilihan 'Diisi' (set) -> patch set dan apply langsung", () => {
    const { expose, onCommit } = setup();
    enter(expose, name);
    act(() => {
      expose.current.pickSetOperator("set", { apply: true });
    });
    expect(onCommit).toHaveBeenCalledWith(
      { k: "name", o: "set", v: undefined },
      { editId: null, apply: true },
    );
  });

  it("boolean: pickBooleanValue -> leaf = tanpa apply (leaf tunggal), keluar sesi", () => {
    const { expose, onCommit } = setup();
    enter(expose, active);
    act(() => {
      expose.current.pickBooleanValue(true);
    });
    expect(onCommit).toHaveBeenCalledWith(
      { k: "active", o: "=", v: true },
      { editId: null, apply: false },
    );
    expect(screen.getByTestId("mode").textContent).toBe("key");
  });

  it("boolean negasi (!) -> operator !=", async () => {
    const user = userEvent.setup();
    const { expose, onCommit } = setup();
    enter(expose, active);
    await user.type(screen.getByLabelText("input"), "!");
    act(() => {
      expose.current.pickBooleanValue(false);
    });
    expect(onCommit).toHaveBeenCalledWith(
      { k: "active", o: "!=", v: false },
      { editId: null, apply: false },
    );
  });
});

describe("useColumnValueInput — validasi & keyboard", () => {
  it("number bukan angka + Enter -> pesan number_invalid dan tidak commit", async () => {
    const user = userEvent.setup();
    const { expose, onCommit } = setup();
    enter(expose, qty);
    await user.type(screen.getByLabelText("input"), "abc{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId("error").textContent).toContain(
      "core.datatable.search.number_invalid",
    );
  });

  it("Backspace pada input kosong keluar dari mode value tanpa commit", async () => {
    const user = userEvent.setup();
    const { expose, onCommit } = setup();
    enter(expose, name);
    await user.click(screen.getByLabelText("input"));
    await user.keyboard("{Backspace}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId("mode").textContent).toBe("key");
  });

  it("Escape dengan commitOnEscape=true meng-commit chip nilai", async () => {
    const user = userEvent.setup();
    const { expose, onCommit } = setup({ commitOnEscape: true });
    enter(expose, name);
    const input = screen.getByLabelText("input");
    await user.type(input, "abc|");
    await user.keyboard("{Escape}");
    expect(onCommit).toHaveBeenCalledWith(
      { k: "name", o: "matches", v: "abc" },
      { editId: null, apply: false },
    );
    expect(screen.getByTestId("mode").textContent).toBe("key");
  });

  it("Escape dengan commitOnEscape=false membuang sesi tanpa commit (Sel Filter)", async () => {
    const user = userEvent.setup();
    const { expose, onCommit } = setup({ commitOnEscape: false });
    enter(expose, name);
    const input = screen.getByLabelText("input");
    await user.type(input, "abc|");
    await user.keyboard("{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId("mode").textContent).toBe("key");
    expect(expose.current.inputValue).toBe("");
  });

  it("mengetik meminta host membuka dropdown", async () => {
    const user = userEvent.setup();
    const { expose, onRequestOpen } = setup();
    enter(expose, name);
    onRequestOpen.mockClear();
    await user.type(screen.getByLabelText("input"), "a");
    expect(onRequestOpen).toHaveBeenCalled();
  });

  it("valueVisibleKeys: text/number hanya 'Diisi'/'Tidak diisi'", () => {
    const { expose } = setup();
    enter(expose, name);
    expect(expose.current.valueVisibleKeys).toEqual(["__set__", "__not_set__"]);
  });
});
