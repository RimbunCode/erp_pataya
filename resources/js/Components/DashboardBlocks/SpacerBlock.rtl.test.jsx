import { describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

import SpacerBlock from "./SpacerBlock";
import { TooltipProvider } from "@/Components/ui/tooltip";

// SpacerBlock merender <Select> (field "Tipe"/"Ukuran"/"Style Garis") yang
// membungkus dirinya dgn <Tooltip> Radix internal, dan (khusus variant
// divider) <PositionToggle> yang juga pakai <Tooltip> Radix langsung --
// keduanya TIDAK menyediakan TooltipProvider sendiri (provider app-level ada
// di MasterLayout.jsx, tanpa itu Radix Tooltip melempar error "must be used
// within TooltipProvider"). Helper render di sini selalu membungkus
// TooltipProvider (pola sama dgn Select.rtl.test.jsx &
// BlockDescriptionTooltip.rtl.test.jsx).
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

const noop = () => {};

function renderBlock(props = {}) {
  return render(
    <SpacerBlock
      block={{ id: "block-1" }}
      canEdit={false}
      onUpdate={noop}
      onDelete={noop}
      editOpen={false}
      onEditOpenChange={noop}
      {...props}
    />,
  );
}

// Field form di dalam BlockEditDialog berbentuk <div><label>...</label>
// <Select/></div> tanpa htmlFor/id -- dicari via label lalu ambil textbox
// (Select custom combobox) di dalam wrapper div yg sama.
function getFieldTextbox(labelText) {
  const field = screen.getByText(labelText).closest("div");
  return within(field).getByRole("textbox");
}

async function chooseOption(user, labelText, optionLabel) {
  await user.click(getFieldTextbox(labelText));
  const option = await screen.findByText(optionLabel);
  await user.click(option);
}

describe("SpacerBlock — preview variant spacer (mode lihat)", () => {
  it("default config (block.config kosong) -> tinggi 24px (md), tanpa label krn canEdit=false", () => {
    const { container } = renderBlock({ block: { id: "b1" } });

    const preview = container.querySelector("div[style]");
    expect(preview).toHaveStyle({ height: "24px" });
    expect(screen.queryByText(/Spacer ·/)).not.toBeInTheDocument();
  });

  it("canEdit=true menampilkan label 'Spacer · <size>' dan border dashed pada preview", () => {
    const { container } = renderBlock({
      canEdit: true,
      block: { id: "b1", config: { size: "lg" } },
    });

    expect(screen.getByText("Spacer · lg")).toBeInTheDocument();
    const preview = container.querySelector("div[style]");
    expect(preview.className).toEqual(expect.stringContaining("border-dashed"));
  });

  it.each([
    ["xs", 8],
    ["sm", 16],
    ["md", 24],
    ["lg", 40],
    ["xl", 64],
  ])("size %s -> tinggi preview %ipx", (size, px) => {
    const { container } = renderBlock({
      block: { id: "b1", config: { size } },
    });

    const preview = container.querySelector("div[style]");
    expect(preview).toHaveStyle({ height: `${px}px` });
  });

  it("size tidak dikenal -> fallback ke tinggi md (24px)", () => {
    const { container } = renderBlock({
      block: { id: "b1", config: { size: "raksasa" } },
    });

    const preview = container.querySelector("div[style]");
    expect(preview).toHaveStyle({ height: "24px" });
  });
});

describe("SpacerBlock — preview variant divider (mode lihat)", () => {
  it("merender garis (borderTop) dan TIDAK menampilkan label 'Spacer ·' walau canEdit=true", () => {
    const { container } = renderBlock({
      canEdit: true,
      block: { id: "b1", config: { variant: "divider" } },
    });

    expect(screen.queryByText(/Spacer ·/)).not.toBeInTheDocument();
    const styledDivs = container.querySelectorAll("div[style]");
    // index 0 = box preview (tinggi), index 1 = garis divider (borderTop)
    expect(styledDivs).toHaveLength(2);
    expect(styledDivs[1]).toHaveStyle({
      borderTopWidth: "2px",
      borderTopStyle: "solid",
    });
  });

  it("lineStyle 'thick' -> borderTopWidth 4px, borderTopStyle 'solid' (CSS tak punya border-style thick)", () => {
    const { container } = renderBlock({
      block: { id: "b1", config: { variant: "divider", lineStyle: "thick" } },
    });

    const line = container.querySelectorAll("div[style]")[1];
    expect(line).toHaveStyle({
      borderTopWidth: "4px",
      borderTopStyle: "solid",
    });
  });

  it.each([["dashed"], ["dotted"]])(
    "lineStyle '%s' -> borderTopWidth default 2px, borderTopStyle sama dgn value",
    (lineStyle) => {
      const { container } = renderBlock({
        block: { id: "b1", config: { variant: "divider", lineStyle } },
      });

      const line = container.querySelectorAll("div[style]")[1];
      expect(line).toHaveStyle({
        borderTopWidth: "2px",
        borderTopStyle: lineStyle,
      });
    },
  );

  it.each([
    ["top", "items-start"],
    ["center", "items-center"],
    ["bottom", "items-end"],
  ])(
    "position '%s' -> class %s pada box preview",
    (position, expectedClass) => {
      const { container } = renderBlock({
        block: { id: "b1", config: { variant: "divider", position } },
      });

      const preview = container.querySelector("div[style]");
      expect(preview.className).toEqual(expect.stringContaining(expectedClass));
    },
  );

  it("position default (config kosong) -> items-center", () => {
    const { container } = renderBlock({
      block: { id: "b1", config: { variant: "divider" } },
    });

    const preview = container.querySelector("div[style]");
    expect(preview.className).toEqual(expect.stringContaining("items-center"));
  });
});

describe("SpacerBlock — BlockEditDialog (mode edit block)", () => {
  it("canEdit=false -> dialog tidak pernah dirender walau editOpen=true", () => {
    renderBlock({ canEdit: false, editOpen: true });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("canEdit=true, editOpen=false -> dialog belum tampil", () => {
    renderBlock({ canEdit: true, editOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("canEdit=true, editOpen=true, config kosong -> dialog terbuka dgn default Tipe=Spacer, Ukuran=Medium, tanpa field divider", () => {
    renderBlock({ canEdit: true, editOpen: true, block: { id: "b1" } });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Edit Spacer")).toBeInTheDocument();
    expect(getFieldTextbox("Tipe")).toHaveValue("Spacer (jarak kosong)");
    expect(getFieldTextbox("Ukuran")).toHaveValue("Medium (default)");
    expect(screen.queryByText("Style Garis")).not.toBeInTheDocument();
    expect(screen.queryByText("Posisi")).not.toBeInTheDocument();
  });

  it("config existing variant divider -> field Style Garis & Posisi tampil dgn value sesuai config", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: {
        id: "b1",
        config: {
          variant: "divider",
          size: "lg",
          lineStyle: "dashed",
          position: "top",
        },
      },
    });

    expect(getFieldTextbox("Tipe")).toHaveValue("Divider (garis pembatas)");
    expect(getFieldTextbox("Ukuran")).toHaveValue("Large");
    expect(getFieldTextbox("Style Garis")).toHaveValue("Putus-putus");
    expect(screen.getByRole("button", { name: "Atas" })).toHaveClass(
      "border-primary",
    );
    expect(screen.getByRole("button", { name: "Tengah" })).not.toHaveClass(
      "border-primary",
    );
  });

  it("ganti Tipe ke Divider via Select memunculkan field Style Garis & Posisi dgn default solid/Tengah", async () => {
    const user = userEvent.setup({ delay: null });
    renderBlock({ canEdit: true, editOpen: true, block: { id: "b1" } });

    expect(screen.queryByText("Style Garis")).not.toBeInTheDocument();

    await chooseOption(user, "Tipe", "Divider (garis pembatas)");

    expect(getFieldTextbox("Tipe")).toHaveValue("Divider (garis pembatas)");
    expect(getFieldTextbox("Style Garis")).toHaveValue("Solid (garis lurus)");
    expect(screen.getByRole("button", { name: "Tengah" })).toHaveClass(
      "border-primary",
    );
  });

  it("klik tombol Posisi mengubah highlight tombol aktif", async () => {
    const user = userEvent.setup({ delay: null });
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: { id: "b1", config: { variant: "divider" } },
    });

    expect(screen.getByRole("button", { name: "Tengah" })).toHaveClass(
      "border-primary",
    );

    await user.click(screen.getByRole("button", { name: "Bawah" }));

    expect(screen.getByRole("button", { name: "Bawah" })).toHaveClass(
      "border-primary",
    );
    expect(screen.getByRole("button", { name: "Tengah" })).not.toHaveClass(
      "border-primary",
    );
  });

  it("klik Terapkan tanpa perubahan mengirim ulang config existing apa adanya via onUpdate, isNew jadi false", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const onEditOpenChange = vi.fn();
    const block = {
      id: "b1",
      isNew: true,
      config: {
        variant: "divider",
        size: "sm",
        lineStyle: "dotted",
        position: "bottom",
      },
    };
    renderBlock({
      canEdit: true,
      editOpen: true,
      block,
      onUpdate,
      onEditOpenChange,
    });

    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith({
      id: "b1",
      isNew: false,
      config: {
        variant: "divider",
        size: "sm",
        lineStyle: "dotted",
        position: "bottom",
      },
    });
    expect(onEditOpenChange).toHaveBeenCalledWith(false);
  });

  it("mengubah Tipe, Ukuran, Style Garis, dan Posisi lalu Terapkan mengirim draft gabungan lewat onUpdate", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: { id: "b1" },
      onUpdate,
    });

    await chooseOption(user, "Tipe", "Divider (garis pembatas)");
    await chooseOption(user, "Ukuran", "Large");
    await chooseOption(user, "Style Garis", "Putus-putus");
    await user.click(screen.getByRole("button", { name: "Atas" }));
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onUpdate).toHaveBeenCalledWith({
      id: "b1",
      isNew: false,
      config: {
        variant: "divider",
        size: "lg",
        lineStyle: "dashed",
        position: "top",
      },
    });
  });

  it("Batal pada block baru (isNew=true) memanggil onDelete (onCancelNew), bukan onEditOpenChange", async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    const onEditOpenChange = vi.fn();
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: { id: "b1", isNew: true },
      onDelete,
      onEditOpenChange,
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEditOpenChange).not.toHaveBeenCalled();
  });

  it("Batal pada block lama (isNew bukan true) memanggil onEditOpenChange(false), bukan onDelete", async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    const onEditOpenChange = vi.fn();
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: { id: "b1" },
      onDelete,
      onEditOpenChange,
    });

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onEditOpenChange).toHaveBeenCalledWith(false);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
