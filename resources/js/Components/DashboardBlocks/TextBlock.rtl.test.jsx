import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// TextBlock komposisi: div dangerouslySetInnerHTML (mode baca, HTML SUDAH
// tersanitasi backend, bukan output getHTML() mentah) + BlockEditDialog
// GENERIK (dipakai APA ADANYA/real, sudah punya tanggung jawabnya sendiri --
// pola sama dgn ChartBlock.rtl.test.jsx & LinkCardBlock.rtl.test.jsx).
// TiptapEditor asli (ProseMirror, 684 baris, di luar cakupan file ini)
// di-stub jadi tombol pemicu onValueChange(json, html), sama seperti block
// lain yang memakainya lewat form BlockEditDialog. Tidak ada usePage/
// usePermission yang disentuh TextBlock atau BlockEditDialog sehingga tidak
// perlu mock @inertiajs/react.
vi.mock("@/Components/TiptapEditor", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="tiptap-editor">
      <span data-testid="tiptap-value">{JSON.stringify(value ?? null)}</span>
      <button
        type="button"
        onClick={() => onValueChange({ type: "doc" }, "<p>Isi baru</p>")}
      >
        ubah-isi
      </button>
    </div>
  ),
}));

import TextBlock from "./TextBlock";

const noop = () => {};

function renderBlock(props = {}) {
  const block = {
    id: "block-1",
    config: {},
    ...props.block,
  };

  return render(
    <TextBlock
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

describe("TextBlock — mode baca (render HTML)", () => {
  it("merender block.config.html apa adanya via dangerouslySetInnerHTML", () => {
    const { container } = renderBlock({
      block: { config: { html: "<p><strong>Halo</strong> dunia</p>" } },
    });

    expect(screen.getByText("dunia")).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("Halo");
  });

  it("tidak crash & merender div kosong saat block.config tidak ada", () => {
    const { container } = renderBlock({ block: { config: undefined } });

    const el = container.querySelector(".tiptap");
    expect(el).toBeInTheDocument();
    expect(el).toBeEmptyDOMElement();
  });

  it("wrapper div punya class 'tiptap min-h-[2rem]'", () => {
    const { container } = renderBlock();

    const el = container.querySelector(".tiptap");
    expect(el.className).toContain("tiptap");
    expect(el.className).toContain("min-h-[2rem]");
  });

  it("canEdit=false -> BlockEditDialog tidak pernah dirender walau editOpen=true", () => {
    renderBlock({ canEdit: false, editOpen: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("TextBlock — BlockEditDialog (Edit Text)", () => {
  it("canEdit=true & editOpen=false -> dialog belum terbuka", () => {
    renderBlock({ canEdit: true, editOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("canEdit=true & editOpen=true -> dialog 'Edit Text' terbuka, TiptapEditor menerima richTextValue(draft) dari block.config (json diutamakan)", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: {
        config: { json: { type: "doc", content: [] }, html: "<p>x</p>" },
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Edit Text" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("tiptap-value")).toHaveTextContent(
      JSON.stringify({ type: "doc", content: [] }),
    );
  });

  it("richTextValue fallback ke html saat draft.json tidak ada", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: { config: { html: "<p>Cuma html</p>" } },
    });

    expect(screen.getByTestId("tiptap-value")).toHaveTextContent(
      JSON.stringify("<p>Cuma html</p>"),
    );
  });

  it("Terapkan tidak pernah disabled (BlockEditDialog dipanggil tanpa prop validate)", () => {
    renderBlock({ canEdit: true, editOpen: true, block: { config: {} } });

    expect(screen.getByRole("button", { name: "Terapkan" })).not.toBeDisabled();
  });

  it("ubah isi via TiptapEditor lalu Terapkan -> onUpdate dgn config {html, json} hasil merge & isNew:false, onEditOpenChange(false)", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const onEditOpenChange = vi.fn();
    const block = {
      id: "block-1",
      someOtherField: "keep-me",
      config: { html: "<p>Lama</p>" },
      isNew: true,
    };

    renderBlock({
      canEdit: true,
      editOpen: true,
      onUpdate,
      onEditOpenChange,
      block,
    });

    await user.click(screen.getByRole("button", { name: "ubah-isi" }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith({
      ...block,
      config: { html: "<p>Isi baru</p>", json: { type: "doc" } },
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
      block: { config: { html: "<p>x</p>" }, isNew: true },
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
      block: { config: { html: "<p>x</p>" }, isNew: false },
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onEditOpenChange).toHaveBeenCalledWith(false);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
