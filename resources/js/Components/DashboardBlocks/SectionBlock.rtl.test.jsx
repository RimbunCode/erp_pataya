import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";

// SectionBlock.jsx komposisi: BlockEditDialog GENERIK (dipakai APA
// ADANYA/real, sudah punya tanggung jawabnya sendiri -- pola sama dgn
// LinkCardBlock.rtl.test.jsx & ChartBlock.rtl.test.jsx), GroupDropZone
// (dnd-kit useDroppable, juga dipakai REAL wrapped DndContext -- pola sama
// dgn GroupDropZone footer di LinkCardBlock.rtl.test.jsx), resolveIcon
// (fungsi murni dari lucide-react, dipakai REAL). Yang di-stub: IconPicker
// (popover + react-window Grid ~1930 icon) & TiptapEditor (ProseMirror,
// berat) -- sama seperti LinkCardBlock men-stub keduanya jadi tombol
// pemicu onValueChange. DashboardCanvas di-stub jadi spy krn REKURSIF
// (DashboardCanvas -> DashboardBlock -> SectionBlock lagi) & berat (dnd-kit
// grid, banyak menu) -- di luar cakupan file ini, wiring prop-nya saja yg
// diuji. BlockDescriptionTooltip di-stub jadi spy -- logic & render
// aslinya sudah dites terpisah di BlockDescriptionTooltip.test.js.

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

// variant="minimal" dipakai utk Judul Section, variant tak diisi (default
// TiptapEditor sendiri) dipakai utk Deskripsi -- testid dibedakan by
// variant supaya kedua instance bisa diuji terpisah tanpa index-based
// getAllByTestId yang rapuh terhadap reorder JSX.
vi.mock("@/Components/TiptapEditor", () => ({
  default: ({ variant, value, onValueChange }) => {
    const key = variant ?? "full";
    return (
      <div data-testid={`tiptap-${key}`}>
        <span data-testid={`tiptap-${key}-value`}>
          {JSON.stringify(value ?? null)}
        </span>
        <button
          type="button"
          onClick={() =>
            onValueChange({ type: "doc", key }, `<p>${key} baru</p>`)
          }
        >
          ubah-{key}
        </button>
      </div>
    );
  },
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

const dashboardCanvasSpy = vi.fn();
vi.mock("@/Components/DashboardCanvas", () => ({
  default: (props) => {
    dashboardCanvasSpy(props);
    return (
      <div data-testid="dashboard-canvas">
        <button
          type="button"
          onClick={() => props.onChange([{ id: "child-baru" }])}
        >
          ubah-children
        </button>
      </div>
    );
  },
}));

import SectionBlock from "./SectionBlock";

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
      <SectionBlock
        canEdit={false}
        onUpdate={noop}
        onDelete={noop}
        isDragActive={false}
        activeDragType={null}
        onEjectChild={noop}
        editOpen={false}
        onEditOpenChange={noop}
        {...props}
        block={block}
      />
    </DndContext>,
  );
}

beforeEach(() => {
  blockDescriptionTooltipSpy.mockClear();
  dashboardCanvasSpy.mockClear();
});

describe("SectionBlock — header (icon, label, description)", () => {
  it("label default 'Section' & tanpa icon kalau config kosong", () => {
    const { container } = renderBlock();

    expect(screen.getByText("Section")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("merender config.label.html apa adanya via dangerouslySetInnerHTML (bukan fallback)", () => {
    renderBlock({
      block: { config: { label: { html: "<strong>Info Keuangan</strong>" } } },
    });

    const label = screen.getByText("Info Keuangan");
    expect(label.tagName).toBe("STRONG");
    expect(screen.queryByText("Section")).not.toBeInTheDocument();
  });

  it("merender icon (resolveIcon nyata) kalau config.icon di-set", () => {
    const { container } = renderBlock({
      block: { config: { icon: "RocketIcon" } },
    });

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

describe("SectionBlock — border container (penanda visual mode edit)", () => {
  it("canEdit=false: TIDAK ada border-dashed, tetap ada py-2", () => {
    const { container } = renderBlock({ canEdit: false });

    const root = container.firstChild;
    expect(root.className).not.toContain("border-dashed");
    expect(root.className).toContain("py-2");
  });

  it("canEdit=true: border-2 border-dashed px-4 tampil (menandai batas drop container)", () => {
    const { container } = renderBlock({ canEdit: true });

    const root = container.firstChild;
    expect(root.className).toContain("border-2");
    expect(root.className).toContain("border-dashed");
    expect(root.className).toContain("px-4");
  });
});

describe("SectionBlock — DashboardCanvas wiring (grid nested-lokal)", () => {
  it("widgets = block.children ?? [] (default [] kalau children tidak ada)", () => {
    renderBlock({ block: { children: undefined } });

    expect(dashboardCanvasSpy).toHaveBeenCalledWith(
      expect.objectContaining({ widgets: [] }),
    );
  });

  it("widgets diteruskan apa adanya (reference sama) kalau block.children ada", () => {
    const children = [{ id: "c1" }, { id: "c2" }];
    renderBlock({ block: { children } });

    const [[props]] = dashboardCanvasSpy.mock.calls;
    expect(props.widgets).toBe(children);
  });

  it("depth default 1 kalau prop depth tidak diisi (rekursi level pertama)", () => {
    renderBlock();

    expect(dashboardCanvasSpy).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 1 }),
    );
  });

  it("depth = prop depth + 1 kalau diisi (rekursi bersarang lebih dalam)", () => {
    renderBlock({ depth: 3 });

    expect(dashboardCanvasSpy).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 4 }),
    );
  });

  it("canEdit diteruskan apa adanya ke DashboardCanvas", () => {
    renderBlock({ canEdit: true });

    expect(dashboardCanvasSpy).toHaveBeenCalledWith(
      expect.objectContaining({ canEdit: true }),
    );
  });

  it("dndContextId pakai block.ref kalau ada", () => {
    renderBlock({ block: { ref: "section-ref-1", id: "block-1" } });

    expect(dashboardCanvasSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dndContextId: "dashboard-section-section-ref-1",
      }),
    );
  });

  it("dndContextId fallback ke block.id kalau block.ref tidak ada", () => {
    renderBlock({ block: { id: "block-77" } });

    expect(dashboardCanvasSpy).toHaveBeenCalledWith(
      expect.objectContaining({ dndContextId: "dashboard-section-block-77" }),
    );
  });

  it("onEjectBlock diteruskan persis referensi onEjectChild", () => {
    const onEjectChild = vi.fn();
    renderBlock({ onEjectChild });

    const [[props]] = dashboardCanvasSpy.mock.calls;
    expect(props.onEjectBlock).toBe(onEjectChild);
  });

  it("onChange(children baru) memicu onUpdate dgn seluruh field block lain dipertahankan, children DIGANTI total", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const block = {
      id: "block-9",
      config: { label: { html: "<p>X</p>" } },
      someOtherField: "keep-me",
      children: [{ id: "c-lama" }],
    };
    renderBlock({ onUpdate, block });

    await user.click(screen.getByRole("button", { name: "ubah-children" }));

    expect(onUpdate).toHaveBeenCalledWith({
      ...block,
      children: [{ id: "child-baru" }],
    });
  });
});

describe("SectionBlock — GroupDropZone footer (drop dari luar utk masuk section)", () => {
  it("TIDAK dirender saat canEdit=false", () => {
    renderBlock({
      canEdit: false,
      isDragActive: true,
      activeDragType: "shortcut",
    });

    expect(
      screen.queryByText("Lepas di sini untuk masuk section"),
    ).not.toBeInTheDocument();
  });

  it("dirender (opacity-0/tidak aktif) saat canEdit=true tapi isDragActive=false", () => {
    renderBlock({ canEdit: true, isDragActive: false });

    const zone = screen.getByText("Lepas di sini untuk masuk section");
    expect(zone.className).toContain("opacity-0");
  });

  it("tetap opacity-0 saat isDragActive=true tapi activeDragType=null", () => {
    renderBlock({ canEdit: true, isDragActive: true, activeDragType: null });

    const zone = screen.getByText("Lepas di sini untuk masuk section");
    expect(zone.className).toContain("opacity-0");
  });

  it("tetap opacity-0 saat activeDragType='section' (section tidak boleh drop ke section sendiri)", () => {
    renderBlock({
      canEdit: true,
      isDragActive: true,
      activeDragType: "section",
    });

    const zone = screen.getByText("Lepas di sini untuk masuk section");
    expect(zone.className).toContain("opacity-0");
  });

  it("tetap opacity-0 saat activeDragType='link_card_item' (item Link Card bukan target section)", () => {
    renderBlock({
      canEdit: true,
      isDragActive: true,
      activeDragType: "link_card_item",
    });

    const zone = screen.getByText("Lepas di sini untuk masuk section");
    expect(zone.className).toContain("opacity-0");
  });

  it("aktif (tanpa opacity-0) saat isDragActive=true & activeDragType tipe block lain (mis. 'shortcut')", () => {
    renderBlock({
      canEdit: true,
      isDragActive: true,
      activeDragType: "shortcut",
    });

    const zone = screen.getByText("Lepas di sini untuk masuk section");
    expect(zone.className).not.toContain("opacity-0");
  });
});

describe("SectionBlock — BlockEditDialog (Edit Section)", () => {
  it("TIDAK pernah dirender saat canEdit=false walau editOpen=true", () => {
    renderBlock({ canEdit: false, editOpen: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tidak tampil saat canEdit=true tapi editOpen=false", () => {
    renderBlock({ canEdit: true, editOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("terbuka dgn title 'Edit Section' & draft awal dari block.config diteruskan ke TiptapEditor/IconPicker", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: {
        config: {
          label: { json: { type: "doc" }, html: "<p>Judul Lama</p>" },
          icon: "RocketIcon",
          description: { json: { type: "doc" }, html: "<p>Deskripsi</p>" },
        },
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Edit Section" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("tiptap-minimal-value")).toHaveTextContent(
      JSON.stringify({ type: "doc" }),
    );
    expect(screen.getByTestId("icon-picker-value")).toHaveTextContent(
      "RocketIcon",
    );
    expect(screen.getByTestId("tiptap-full-value")).toHaveTextContent(
      JSON.stringify({ type: "doc" }),
    );
  });

  it("label kosong (config.label tidak ada) -> error 'Judul Section wajib diisi.' & Terapkan disabled", () => {
    renderBlock({ canEdit: true, editOpen: true, block: { config: {} } });

    expect(screen.getByText("Judul Section wajib diisi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();
  });

  it("label.html cuma tag kosong tanpa teks (mis. '<p></p>') tetap dianggap kosong -> error", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: { config: { label: { html: "<p></p>" } } },
    });

    expect(screen.getByText("Judul Section wajib diisi.")).toBeInTheDocument();
  });

  it("label.html berisi teks -> TIDAK ada error, Terapkan enabled", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: { config: { label: { html: "<p>Judul Section</p>" } } },
    });

    expect(
      screen.queryByText("Judul Section wajib diisi."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).not.toBeDisabled();
  });

  it("isi Judul + pilih icon + ubah deskripsi lalu Terapkan -> onUpdate dgn config baru & isNew:false, onEditOpenChange(false)", async () => {
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

    await user.click(screen.getByRole("button", { name: "ubah-minimal" }));
    await user.click(screen.getByRole("button", { name: "pilih-icon" }));
    await user.click(screen.getByRole("button", { name: "ubah-full" }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith({
      ...block,
      config: {
        label: {
          json: { type: "doc", key: "minimal" },
          html: "<p>minimal baru</p>",
        },
        icon: "RocketIcon",
        description: {
          json: { type: "doc", key: "full" },
          html: "<p>full baru</p>",
        },
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
      block: {
        config: { label: { html: "<p>Section</p>" } },
        isNew: true,
      },
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
      block: {
        config: { label: { html: "<p>Section</p>" } },
        isNew: false,
      },
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onEditOpenChange).toHaveBeenCalledWith(false);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
