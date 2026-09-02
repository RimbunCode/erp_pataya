import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";

// LinkCardBlock komposisi: dnd-kit (SortableContext/useSortable, butuh
// DndContext parent -- lihat Table/Header.rtl.test.jsx utk pola serupa),
// BlockEditDialog GENERIK (dipakai APA ADANYA/real, sudah punya tanggung
// jawabnya sendiri -- pola sama dgn ChartBlock.rtl.test.jsx), serta 3
// picker berat yang di luar cakupan file ini: IconPicker (popover +
// react-window Grid ~1930 icon), TiptapEditor (ProseMirror, 684 baris),
// dan LinkPicker (Select menu_item vs input url). Ketiganya di-stub jadi
// tombol pemicu onValueChange, sama seperti NumberCardBlock.rtl.test.jsx
// men-stub NumberCardLinkModel/ChartLinkModel. BlockDescriptionTooltip
// juga di-stub jadi spy -- logic & render aslinya sudah dites terpisah di
// BlockDescriptionTooltip.test.js.

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

vi.mock("@/Components/TiptapEditor", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="tiptap-editor">
      <span data-testid="tiptap-value">{JSON.stringify(value ?? null)}</span>
      <button
        type="button"
        onClick={() => onValueChange({ type: "doc" }, "<p>Deskripsi baru</p>")}
      >
        ubah-deskripsi
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

const blockDescriptionTooltipSpy = vi.fn();
vi.mock("@/Components/DashboardBlocks/BlockDescriptionTooltip", () => ({
  default: (props) => {
    blockDescriptionTooltipSpy(props);
    return props.description ? (
      <span data-testid="description-tooltip" />
    ) : null;
  },
}));

import LinkCardBlock from "./LinkCardBlock";

const noop = () => {};

function renderBlock(props = {}) {
  const block = {
    id: "block-1",
    config: {},
    children: [],
    ...props.block,
  };

  return render(
    <DndContext>
      <LinkCardBlock
        canEdit={false}
        onUpdate={noop}
        onDelete={noop}
        isDragActive={false}
        activeDragType={null}
        editOpen={false}
        onEditOpenChange={noop}
        {...props}
        block={block}
      />
    </DndContext>,
  );
}

// Buttons drag-handle/edit/delete di LinkCardItemRow sama-sama tidak punya
// accessible name (tanpa aria-label/teks) sehingga tidak bisa dibedakan via
// getByRole name -- dibedakan lewat kombinasi class Tailwind yang memang
// unik per tombol di source (cursor-grab utk handle, size-6+hover:bg-accent
// utk pencil [drag handle size-5], hover:text-destructive utk hapus).
function getRowButtons(container) {
  return {
    grip: container.querySelector('button[class*="cursor-grab"]'),
    edit: container.querySelector(
      'button[class*="size-6"][class*="hover:bg-accent"]',
    ),
    del: container.querySelector('button[class*="hover:text-destructive"]'),
  };
}

beforeEach(() => {
  usePageMock.mockReset();
  usePageMock.mockReturnValue({ props: { allMenuItems: [] } });
  blockDescriptionTooltipSpy.mockClear();
});

describe("LinkCardBlock — header (label, icon, description)", () => {
  it("menampilkan label default 'Link Card' & tanpa icon kalau config kosong", () => {
    const { container } = renderBlock();

    expect(screen.getByText("Link Card")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("menampilkan config.label & icon (resolveIcon nyata) kalau config.icon di-set", () => {
    const { container } = renderBlock({
      block: { config: { label: "Menu Favorit", icon: "RocketIcon" } },
    });

    expect(screen.getByText("Menu Favorit")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("meneruskan config.description apa adanya ke BlockDescriptionTooltip", () => {
    const description = { json: { type: "doc" }, html: "<p>Halo</p>" };
    renderBlock({ block: { config: { description } } });

    expect(blockDescriptionTooltipSpy).toHaveBeenCalledWith(
      expect.objectContaining({ description }),
    );
    expect(screen.getByTestId("description-tooltip")).toBeInTheDocument();
  });
});

describe("LinkCardBlock — mode baca (canEdit=false)", () => {
  it("merender item sbg <a> dgn href resolved dari menu_item yang cocok", () => {
    usePageMock.mockReturnValue({
      props: {
        allMenuItems: [{ id: 5, url: "/menu/lima", label: "Menu Lima" }],
      },
    });
    renderBlock({
      canEdit: false,
      block: {
        children: [
          {
            id: "item-1",
            config: {
              label: "Ke Menu Lima",
              link_type: "menu_item",
              link_to: 5,
            },
          },
        ],
      },
    });

    const link = screen.getByRole("link", { name: /Ke Menu Lima/ });
    expect(link).toHaveAttribute("href", "/menu/lima");
  });

  it("merender item sbg <a> dgn href = link_to apa adanya utk link_type url", () => {
    renderBlock({
      canEdit: false,
      block: {
        children: [
          {
            id: "item-1",
            config: {
              label: "Situs Eksternal",
              link_type: "url",
              link_to: "https://contoh.test",
            },
          },
        ],
      },
    });

    expect(
      screen.getByRole("link", { name: /Situs Eksternal/ }),
    ).toHaveAttribute("href", "https://contoh.test");
  });

  it("merender item sbg <span> (bukan link) & label fallback 'Item' saat href tidak bisa di-resolve", () => {
    renderBlock({
      canEdit: false,
      block: {
        children: [{ id: "item-1", config: {} }],
      },
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Item")).toBeInTheDocument();
  });

  it("TIDAK merender tombol Tambah Item, drag handle, atau BlockEditDialog block-level", () => {
    renderBlock({
      canEdit: false,
      editOpen: true,
      block: {
        children: [{ id: "item-1", config: { label: "Item A" } }],
      },
    });

    expect(
      screen.queryByRole("button", { name: /Tambah Item/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("LinkCardBlock — mode edit: tombol Tambah Item", () => {
  it("klik 'Tambah Item' memanggil onUpdate dgn child baru (link_card_item, config {}, width 12, isNew true) & mempertahankan children lama", () => {
    const onUpdate = vi.fn();
    const existingChild = { id: "item-1", config: { label: "Sudah Ada" } };
    renderBlock({
      canEdit: true,
      onUpdate,
      block: { id: "block-9", children: [existingChild] },
    });

    userEvent.setup({ delay: null });
    screen.getByRole("button", { name: /Tambah Item/i }).click();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [arg] = onUpdate.mock.calls[0];
    expect(arg.id).toBe("block-9");
    expect(arg.children).toHaveLength(2);
    expect(arg.children[0]).toBe(existingChild);
    expect(arg.children[1]).toEqual({
      ref: expect.stringMatching(/^link-item-\d+$/),
      type: "link_card_item",
      config: {},
      width: 12,
      isNew: true,
    });
  });

  it("dua klik berturut-turut menghasilkan ref lokal yang berbeda (counter tidak pernah re-use)", () => {
    const onUpdate = vi.fn();
    renderBlock({ canEdit: true, onUpdate });

    const button = screen.getByRole("button", { name: /Tambah Item/i });
    button.click();
    button.click();

    const ref1 = onUpdate.mock.calls[0][0].children[0].ref;
    const ref2 = onUpdate.mock.calls[1][0].children[0].ref;
    expect(ref1).not.toBe(ref2);
  });
});

describe("LinkCardBlock — mode edit: GroupDropZone footer", () => {
  it("opacity-0 (tidak aktif) saat isDragActive=false", () => {
    renderBlock({ canEdit: true, isDragActive: false });

    const zone = screen.getByText("Lepas di sini");
    expect(zone.className).toContain("opacity-0");
  });

  it("opacity-0 (tidak aktif) saat isDragActive=true tapi activeDragType BUKAN link_card_item", () => {
    renderBlock({
      canEdit: true,
      isDragActive: true,
      activeDragType: "shortcut",
    });

    const zone = screen.getByText("Lepas di sini");
    expect(zone.className).toContain("opacity-0");
  });

  it("aktif (tanpa opacity-0) saat isDragActive=true & activeDragType='link_card_item'", () => {
    renderBlock({
      canEdit: true,
      isDragActive: true,
      activeDragType: "link_card_item",
    });

    const zone = screen.getByText("Lepas di sini");
    expect(zone.className).not.toContain("opacity-0");
  });
});

describe("LinkCardBlock — LinkCardItemRow: edit item", () => {
  it("klik pencil membuka dialog 'Edit Item' berisi Input label & LinkPicker terisi draft saat ini", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = renderBlock({
      canEdit: true,
      block: {
        children: [
          {
            id: "item-1",
            config: { label: "Item Lama", link_type: "url", link_to: "/lama" },
          },
        ],
      },
    });

    const { edit } = getRowButtons(container);
    await user.click(edit);

    expect(
      screen.getByRole("dialog", { name: "Edit Item" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Label")).toHaveValue("Item Lama");
    expect(screen.getByTestId("link-picker-value")).toHaveTextContent("/lama");
  });

  it("item baru (isNew: true) langsung membuka dialog tanpa perlu klik pencil", () => {
    renderBlock({
      canEdit: true,
      block: {
        children: [{ ref: "link-item-baru", config: {}, isNew: true }],
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Edit Item" }),
    ).toBeInTheDocument();
  });

  it("label kosong -> error 'Label wajib diisi.' & tombol Terapkan disabled", async () => {
    const user = userEvent.setup({ delay: null });
    renderBlock({
      canEdit: true,
      block: {
        children: [{ ref: "link-item-baru", config: {}, isNew: true }],
      },
    });

    expect(screen.getByText("Label wajib diisi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Label"), "Item Baru");

    expect(screen.queryByText("Label wajib diisi.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).not.toBeDisabled();
  });

  it("mengisi label + pilih link lalu Terapkan -> onUpdate dipanggil dgn item terupdate (isNew:false), item lain tetap", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const otherChild = { id: "item-lain", config: { label: "Item Lain" } };
    renderBlock({
      canEdit: true,
      onUpdate,
      block: {
        children: [
          otherChild,
          { ref: "link-item-baru", config: {}, isNew: true },
        ],
      },
    });

    await user.type(screen.getByPlaceholderText("Label"), "Item Baru");
    await user.click(screen.getByRole("button", { name: "pilih-link" }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [arg] = onUpdate.mock.calls[0];
    expect(arg.children[0]).toBe(otherChild);
    expect(arg.children[1]).toEqual({
      ref: "link-item-baru",
      config: {
        label: "Item Baru",
        link_type: "url",
        link_to: "/tujuan-baru",
      },
      isNew: false,
    });
  });

  it("klik tombol hapus (X) memanggil onUpdate dgn item tsb terhapus dari children", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const target = { id: "item-hapus", config: { label: "Akan Dihapus" } };
    const keep = { id: "item-simpan", config: { label: "Disimpan" } };
    const { container } = renderBlock({
      canEdit: true,
      onUpdate,
      block: { children: [target, keep] },
    });

    const rows = container.querySelectorAll(
      'button[class*="hover:text-destructive"]',
    );
    // 2 item -> 2 tombol hapus, target ada di baris pertama (urutan children).
    await user.click(rows[0]);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [arg] = onUpdate.mock.calls[0];
    expect(arg.children).toEqual([keep]);
  });

  it("Batal pada item baru (isNew:true) memanggil onUpdate yang MENGHAPUS item itu (onCancelNew = onDelete)", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    renderBlock({
      canEdit: true,
      onUpdate,
      block: {
        children: [{ ref: "link-item-baru", config: {}, isNew: true }],
      },
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].children).toEqual([]);
  });

  it("Batal pada item lama (isNew:false) HANYA menutup dialog, TIDAK memanggil onUpdate", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const { container } = renderBlock({
      canEdit: true,
      onUpdate,
      block: {
        children: [
          { id: "item-1", config: { label: "Item Lama" }, isNew: false },
        ],
      },
    });

    const { edit } = getRowButtons(container);
    await user.click(edit);
    expect(
      screen.getByRole("dialog", { name: "Edit Item" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("LinkCardBlock — BlockEditDialog block-level (Edit Link Card)", () => {
  it("canEdit=true & editOpen=true -> dialog terbuka, draft awal dari block.config diteruskan ke Input/IconPicker/TiptapEditor", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: {
        config: {
          label: "Grup Favorit",
          icon: "RocketIcon",
          description: { json: { type: "doc" }, html: "<p>x</p>" },
        },
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Edit Link Card" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Judul grup")).toHaveValue(
      "Grup Favorit",
    );
    expect(screen.getByTestId("icon-picker-value")).toHaveTextContent(
      "RocketIcon",
    );
    expect(screen.getByTestId("tiptap-value")).toHaveTextContent(
      JSON.stringify({ type: "doc" }),
    );
  });

  it("canEdit=false -> BlockEditDialog block-level tidak pernah dirender walau editOpen=true", () => {
    renderBlock({ canEdit: false, editOpen: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Judul grup kosong -> error 'Judul grup wajib diisi.' & Terapkan disabled", () => {
    renderBlock({ canEdit: true, editOpen: true, block: { config: {} } });

    expect(screen.getByText("Judul grup wajib diisi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();
  });

  it("isi Judul grup + pilih icon + ubah deskripsi lalu Terapkan -> onUpdate dgn config baru & isNew:false, onEditOpenChange(false)", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const onEditOpenChange = vi.fn();
    const block = {
      id: "block-1",
      someOtherField: "keep-me",
      config: {},
      children: [],
      isNew: true,
    };

    renderBlock({
      canEdit: true,
      editOpen: true,
      onUpdate,
      onEditOpenChange,
      block,
    });

    await user.type(screen.getByPlaceholderText("Judul grup"), "Grup Baru");
    await user.click(screen.getByRole("button", { name: "pilih-icon" }));
    await user.click(screen.getByRole("button", { name: "ubah-deskripsi" }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith({
      ...block,
      config: {
        label: "Grup Baru",
        icon: "RocketIcon",
        description: { json: { type: "doc" }, html: "<p>Deskripsi baru</p>" },
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
      block: { config: { label: "Grup" }, isNew: true },
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
      block: { config: { label: "Grup" }, isNew: false },
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onEditOpenChange).toHaveBeenCalledWith(false);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
