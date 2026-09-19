import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import Header from "./Header";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// Header pakai useSortable (dnd-kit, butuh DndContext+SortableContext parent)
// dan DialogTrigger (butuh Dialog parent) -- keduanya wajib dibungkus agar
// tidak crash. Dirender di dalam <table><thead><tr> agar valid sbg <th>.
const renderHeader = (props) =>
  render(
    <Dialog>
      <DndContext>
        <SortableContext items={[props.id ?? "col_a"]}>
          <table>
            <thead>
              <tr>
                <Header id="col_a" name="col_a" {...props} />
              </tr>
            </thead>
          </table>
        </SortableContext>
      </DndContext>
    </Dialog>,
  );

// Trigger dropdown menu ("..." EllipsisVertical) punya aria-haspopup="menu",
// berbeda dari drag-handle button (aria-roledescription="sortable") -- query
// spesifik ini, bukan by index, agar tidak salah target antar test.
const getMenuTrigger = () =>
  screen.getByRole("button", { name: "", expanded: false });

// Meniru Table2.jsx: <Dialog open/onOpenChange> terkontrol di ANCESTOR Header,
// DialogContent (ColumnsFilter di app asli) jadi saudara tabel di dalam Dialog
// yang sama. renderHeader di atas pakai <Dialog> tanpa DialogContent sehingga
// tak bisa membuktikan dialog benar2 terbuka.
function HeaderWithColumnsDialog(props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DndContext>
        <SortableContext items={["col_a"]}>
          <table>
            <thead>
              <tr>
                <Header id="col_a" name="col_a" {...props} />
              </tr>
            </thead>
          </table>
        </SortableContext>
      </DndContext>
      <DialogContent>
        <DialogTitle>Kolom</DialogTitle>
        <DialogDescription className="sr-only">Kolom</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

describe("Header", () => {
  it("render title langsung jika diberikan", () => {
    renderHeader({ title: "Nama Kolom" });
    expect(screen.getByText("Nama Kolom")).toBeInTheDocument();
  });

  it("render title via terjemahan titleTrans jika title tidak diberikan", () => {
    renderHeader({ titleTrans: "core.columns.name" });
    expect(screen.getByText("TR:core.columns.name")).toBeInTheDocument();
  });

  it("title dirender sebagai button (clickable) saat sortable=true", () => {
    renderHeader({ title: "Nama", sortable: true, setSort: vi.fn() });
    const button = screen.getByRole("button", { name: "Nama" });
    expect(button).toBeInTheDocument();
  });

  it("klik title memanggil setSort dengan nama kolom saat sortable", async () => {
    const user = userEvent.setup({ delay: null });
    const setSort = vi.fn();
    renderHeader({ title: "Nama", name: "col_a", sortable: true, setSort });

    await user.click(screen.getByRole("button", { name: "Nama" }));
    expect(setSort).toHaveBeenCalledWith("col_a");
  });

  it("title TIDAK clickable saat sortable=false", () => {
    renderHeader({ title: "Nama", sortable: false });
    expect(
      screen.queryByRole("button", { name: "Nama" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Nama")).toBeInTheDocument();
  });

  it("dropdown menu menampilkan opsi sort asc/desc/reset saat sortable", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader({
      title: "Nama",
      sortable: true,
      setSort: vi.fn(),
      resetSorting: vi.fn(),
    });

    await user.click(getMenuTrigger());

    expect(
      screen.getByText("TR:core.datatable.sorting.sort_ascending"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("TR:core.datatable.sorting.sort_descending"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("TR:core.datatable.sorting.reset_sorting"),
    ).toBeInTheDocument();
  });

  it("dropdown menu TIDAK menampilkan opsi sort saat sortable=false", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader({ title: "Nama", sortable: false });

    await user.click(getMenuTrigger());

    expect(
      screen.queryByText("TR:core.datatable.sorting.sort_ascending"),
    ).not.toBeInTheDocument();
  });

  it("klik opsi sort ascending memanggil setSort dengan arah 'asc'", async () => {
    const user = userEvent.setup({ delay: null });
    const setSort = vi.fn();
    renderHeader({ title: "Nama", name: "col_a", sortable: true, setSort });

    await user.click(getMenuTrigger());
    await user.click(
      screen.getByText("TR:core.datatable.sorting.sort_ascending"),
    );

    expect(setSort).toHaveBeenCalledWith("col_a", "asc");
  });

  it("opsi 'columns trigger' selalu tersedia di dropdown", async () => {
    const user = userEvent.setup({ delay: null });
    renderHeader({ title: "Nama", sortable: false });

    await user.click(getMenuTrigger());
    expect(
      screen.getByText("TR:core.datatable.columns.trigger"),
    ).toBeInTheDocument();
  });

  it("klik 'columns trigger' BENAR2 membuka dialog kolom", async () => {
    const user = userEvent.setup({ delay: null });
    render(<HeaderWithColumnsDialog title="Nama" sortable={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(getMenuTrigger());
    await user.click(screen.getByText("TR:core.datatable.columns.trigger"));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
