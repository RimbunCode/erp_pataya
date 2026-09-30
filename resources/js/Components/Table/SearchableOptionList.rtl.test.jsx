import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SearchableOptionList, {
  searchableOptionFilter,
} from "./SearchableOptionList";
import { Command } from "@/Components/ui/command";

const options = [
  { value: "code", label: "Code" },
  { value: "name", label: "Name" },
  { value: "created_at", label: "Created At" },
];

function renderList(props = {}) {
  return render(
    <Command filter={searchableOptionFilter}>
      <SearchableOptionList
        options={options}
        value={null}
        onValueChange={vi.fn()}
        searchPlaceholder="Cari kolom..."
        emptyMessage="Tidak ditemukan"
        {...props}
      />
    </Command>,
  );
}

describe("SearchableOptionList", () => {
  it("merender semua option di awal", () => {
    renderList();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Created At")).toBeInTheDocument();
  });

  it("ketik search memfilter daftar ke yang cocok saja", async () => {
    const user = userEvent.setup();
    renderList();

    await user.type(screen.getByPlaceholderText("Cari kolom..."), "cod");

    // Query via role="option" (bukan getByText) krn label yg cocok kepecah
    // jadi beberapa text node oleh <mark> -- accessible name tetap gabungan
    // utuhnya ("Code"), berbeda dari getByText yg butuh 1 text node persis.
    expect(screen.getByRole("option", { name: "Code" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Name" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Created At" }),
    ).not.toBeInTheDocument();
  });

  it("substring yang cocok dibungkus <mark>", async () => {
    const user = userEvent.setup();
    const { container } = renderList();

    await user.type(screen.getByPlaceholderText("Cari kolom..."), "cod");

    const mark = container.querySelector("mark");
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveTextContent("Cod");
  });

  it("klik option memanggil onValueChange dengan value yang benar", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderList({ onValueChange });

    await user.click(screen.getByText("Name"));

    expect(onValueChange).toHaveBeenCalledWith("name");
  });

  it("option yang sedang value aktif menampilkan ikon check", () => {
    const { _container } = renderList({ value: "name" });

    const nameItem = screen.getByText("Name").closest('[cmdk-item=""]');
    expect(nameItem.querySelector("svg")).toBeInTheDocument();

    const codeItem = screen.getByText("Code").closest('[cmdk-item=""]');
    expect(codeItem.querySelector("svg")).not.toBeInTheDocument();
  });

  it("search tanpa hasil menampilkan emptyMessage", async () => {
    const user = userEvent.setup();
    renderList();

    await user.type(
      screen.getByPlaceholderText("Cari kolom..."),
      "kolom_tidak_ada",
    );

    expect(screen.getByText("Tidak ditemukan")).toBeInTheDocument();
    expect(screen.queryByText("Code")).not.toBeInTheDocument();
  });
});
