import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ShortcutBlock komposisi: getDeskColorStyle/resolveIcon (fungsi murni dari
// @/lib/deskIcons, dipakai APA ADANYA/real -- satu sumber kebenaran styling
// sama persis dgn grid /desks, lihat komentar di source), BlockEditDialog
// GENERIK (real, sudah punya tanggung jawabnya sendiri -- pola sama dgn
// LinkCardBlock.rtl.test.jsx), ColorInput (real -- controlled plain input
// tanpa portal/popover, sudah punya test detail sendiri di
// ColorInput.rtl.test.jsx, di sini cukup verifikasi wiring-nya lewat native
// color picker spt ColorInput.rtl.test.jsx sendiri lakukan). Dua komponen
// berat di luar cakupan file ini: IconPicker (popover + react-window Grid
// ~1930 icon) & LinkPicker (Select menu_item vs input url) -- di-stub jadi
// tombol pemicu onValueChange, sama seperti LinkCardBlock.rtl.test.jsx.
// resolveShortcutHref (fungsi murni) sudah diuji terpisah di
// ShortcutBlock.test.js.

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

vi.mock("@/Components/IconPicker", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="icon-picker">
      <span data-testid="icon-picker-value">{value ?? "kosong"}</span>
      <button type="button" onClick={() => onValueChange("RocketIcon")}>
        pilih-icon
      </button>
    </div>
  ),
}));

vi.mock("@/Components/LinkPicker", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="link-picker">
      <span data-testid="link-picker-value">{value?.link_to || "kosong"}</span>
      <button
        type="button"
        onClick={() =>
          onValueChange({ link_type: "url", link_to: "/tujuan-baru" })
        }
      >
        pilih-link
      </button>
    </div>
  ),
}));

import ShortcutBlock from "./ShortcutBlock";

const noop = () => {};

function renderBlock(props = {}) {
  const block = {
    id: "block-1",
    config: {},
    ...props.block,
  };

  return render(
    <ShortcutBlock
      canEdit={false}
      onUpdate={noop}
      onDelete={noop}
      editOpen={false}
      onEditOpenChange={noop}
      {...props}
      block={block}
    />,
  );
}

// Wrapper (anchor di mode baca berhref, div di sisanya) selalu punya
// kombinasi class ini -- dipakai utk menemukan elemen & tag-nya tanpa
// bergantung pada role (role "link" hanya ada kalau Wrapper memang <a>).
function getWrapper(container) {
  return container.querySelector(".rounded-lg.p-3.text-center");
}

function getIconBox(container) {
  return container.querySelector("span.rounded-2xl");
}

beforeEach(() => {
  usePageMock.mockReset();
  usePageMock.mockReturnValue({ props: { allMenuItems: [] } });
});

describe("ShortcutBlock — mode baca (canEdit=false)", () => {
  it("label fallback 'Shortcut' & tanpa icon svg saat config kosong; Wrapper berupa <div> (tanpa href)", () => {
    const { container } = renderBlock();

    expect(screen.getByText("Shortcut")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
    expect(getWrapper(container).tagName).toBe("DIV");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("menampilkan config.label & icon (resolveIcon nyata) kalau config.icon di-set", () => {
    const { container } = renderBlock({
      block: { config: { label: "Ke Approval", icon: "RocketIcon" } },
    });

    expect(screen.getByText("Ke Approval")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("icon tidak dikenal (bukan lucide/custom) -> resolveIcon null, tidak crash & tanpa svg", () => {
    const { container } = renderBlock({
      block: { config: { icon: "IconTidakAda" } },
    });

    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("link_type 'url' -> Wrapper jadi <a href> ke link_to apa adanya, dgn class cursor-pointer & hover:bg-muted", () => {
    renderBlock({
      block: {
        config: {
          label: "Situs Eksternal",
          link_type: "url",
          link_to: "https://contoh.test",
        },
      },
    });

    const link = screen.getByRole("link", { name: /Situs Eksternal/ });
    expect(link).toHaveAttribute("href", "https://contoh.test");
    expect(link.className).toContain("cursor-pointer");
    expect(link.className).toContain("hover:bg-muted");
  });

  it("link_type 'menu_item' -> Wrapper jadi <a href> hasil resolve dari allMenuItems yang id-nya cocok", () => {
    usePageMock.mockReturnValue({
      props: {
        allMenuItems: [{ id: 5, url: "/menu/lima", label: "Menu Lima" }],
      },
    });
    renderBlock({
      block: {
        config: { label: "Ke Menu Lima", link_type: "menu_item", link_to: 5 },
      },
    });

    expect(screen.getByRole("link", { name: /Ke Menu Lima/ })).toHaveAttribute(
      "href",
      "/menu/lima",
    );
  });

  it("href tidak bisa di-resolve (menu_item tanpa match) -> Wrapper tetap <div>, TIDAK ada cursor-pointer/hover:bg-muted", () => {
    const { container } = renderBlock({
      block: {
        config: { label: "Buntu", link_type: "menu_item", link_to: 999 },
      },
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const wrapper = getWrapper(container);
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).not.toContain("cursor-pointer");
    expect(wrapper.className).not.toContain("hover:bg-muted");
  });

  it("warna latar & icon kosong -> icon box pakai fallback token tema (bg-muted, text-foreground) tanpa inline style", () => {
    const { container } = renderBlock();
    const iconBox = getIconBox(container);

    expect(iconBox.className).toContain("bg-muted");
    expect(iconBox.className).toContain("text-foreground");
    expect(iconBox.style.backgroundColor).toBe("");
    expect(iconBox.style.color).toBe("");
  });

  it("warna latar & icon di-set -> icon box pakai style literal & TIDAK pakai fallback token tema", () => {
    const { container } = renderBlock({
      block: {
        config: {
          background_color: "#112233",
          foreground_color: "#ffffff",
        },
      },
    });
    const iconBox = getIconBox(container);

    expect(iconBox.style.backgroundColor).toBe("rgb(17, 34, 51)");
    expect(iconBox.style.color).toBe("rgb(255, 255, 255)");
    expect(iconBox.className).not.toContain("bg-muted");
    expect(iconBox.className).not.toContain("text-foreground");
  });

  it("hanya warna latar di-set -> channel warna icon tetap fallback text-foreground (independen per-channel)", () => {
    const { container } = renderBlock({
      block: { config: { background_color: "#112233" } },
    });
    const iconBox = getIconBox(container);

    expect(iconBox.style.backgroundColor).toBe("rgb(17, 34, 51)");
    expect(iconBox.className).not.toContain("bg-muted");
    expect(iconBox.className).toContain("text-foreground");
  });

  it("TIDAK merender BlockEditDialog walau editOpen=true", () => {
    renderBlock({ editOpen: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ShortcutBlock — mode edit (canEdit=true)", () => {
  it("href SELALU null di mode edit -> Wrapper tetap <div> walau config link lengkap & valid", () => {
    const { container } = renderBlock({
      canEdit: true,
      block: {
        config: {
          label: "Ke Menu Lima",
          link_type: "url",
          link_to: "https://contoh.test",
        },
      },
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const wrapper = getWrapper(container);
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).not.toContain("cursor-pointer");
  });

  it("label & icon tetap dirender sama seperti mode baca", () => {
    const { container } = renderBlock({
      canEdit: true,
      block: { config: { label: "Ke Approval", icon: "RocketIcon" } },
    });

    expect(screen.getByText("Ke Approval")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("editOpen=false -> BlockEditDialog belum dirender di DOM", () => {
    renderBlock({ canEdit: true, editOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("editOpen=true -> dialog 'Edit Shortcut' terbuka, form terisi draft dari block.config saat ini", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: {
        config: {
          label: "Item Lama",
          icon: "RocketIcon",
          link_type: "url",
          link_to: "/lama",
          background_color: "#112233",
          foreground_color: "#ffffff",
        },
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Edit Shortcut" }),
    ).toBeInTheDocument();

    const [labelInput, bgInput, fgInput] = screen.getAllByRole("textbox");
    expect(labelInput).toHaveValue("Item Lama");
    expect(bgInput).toHaveValue("#112233");
    expect(fgInput).toHaveValue("#ffffff");
    expect(screen.getByTestId("icon-picker-value")).toHaveTextContent(
      "RocketIcon",
    );
    expect(screen.getByTestId("link-picker-value")).toHaveTextContent("/lama");
  });

  it("label kosong -> error 'Label wajib diisi.' & tombol Terapkan disabled", async () => {
    const user = userEvent.setup({ delay: null });
    renderBlock({ canEdit: true, editOpen: true, block: { config: {} } });

    expect(screen.getByText("Label wajib diisi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();

    await user.type(screen.getAllByRole("textbox")[0], "Shortcut Baru");

    expect(screen.queryByText("Label wajib diisi.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).not.toBeDisabled();
  });

  it("mengisi semua field (label, icon, link, 2 warna) lalu Terapkan -> onUpdate dgn config lengkap & isNew:false, dialog ditutup", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const onEditOpenChange = vi.fn();
    const block = {
      id: "block-1",
      config: {},
      isNew: true,
    };

    renderBlock({
      canEdit: true,
      editOpen: true,
      onUpdate,
      onEditOpenChange,
      block,
    });

    await user.type(screen.getAllByRole("textbox")[0], "Shortcut Baru");
    await user.click(screen.getByRole("button", { name: "pilih-icon" }));
    await user.click(screen.getByRole("button", { name: "pilih-link" }));

    const [bgPicker, fgPicker] = screen.getAllByLabelText("Pick color");
    fireEvent.change(bgPicker, { target: { value: "#112233" } });
    fireEvent.change(fgPicker, { target: { value: "#ffffff" } });

    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      ...block,
      config: {
        label: "Shortcut Baru",
        icon: "RocketIcon",
        link_type: "url",
        link_to: "/tujuan-baru",
        background_color: "#112233",
        foreground_color: "#ffffff",
      },
      isNew: false,
    });
    expect(onEditOpenChange).toHaveBeenCalledWith(false);
  });

  it("Batal saat block baru (isNew:true) memanggil onDelete (onCancelNew), BUKAN onEditOpenChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    const onEditOpenChange = vi.fn();

    renderBlock({
      canEdit: true,
      editOpen: true,
      onDelete,
      onEditOpenChange,
      block: { config: { label: "Shortcut" }, isNew: true },
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEditOpenChange).not.toHaveBeenCalled();
  });

  it("Batal saat block BUKAN baru (isNew:false) memanggil onEditOpenChange(false), BUKAN onDelete", async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    const onEditOpenChange = vi.fn();

    renderBlock({
      canEdit: true,
      editOpen: true,
      onDelete,
      onEditOpenChange,
      block: { config: { label: "Shortcut" }, isNew: false },
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onEditOpenChange).toHaveBeenCalledWith(false);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("canEdit=false -> BlockEditDialog tidak pernah dirender walau editOpen=true (regresi thd sinkronisasi 2 kondisi canEdit di source)", () => {
    renderBlock({ canEdit: false, editOpen: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
