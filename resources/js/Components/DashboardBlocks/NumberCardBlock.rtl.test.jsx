import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// NumberCardBlock.jsx komposisi: NumberCardDisplay (fetch async via axios,
// i18n, dsb.) + NumberCardLinkModel (LinkModel + Form Settings/NumberCard
// penuh) + BlockEditDialog (Dialog Radix generik, sudah punya tanggung
// jawabnya sendiri). Ketiganya di-mock jadi stub minimal supaya test ini
// fokus HANYA ke logic milik NumberCardBlock sendiri: kondisi
// showEditEntityLink, wiring prop ke BlockEditDialog (title/initialDraft/
// isNew/onCancelNew), fungsi validate(draft) & onSave(draft) yang
// didefinisikan inline di file ini, dan pemetaan renderForm ->
// NumberCardLinkModel.

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const usePermissionCanMock = vi.fn();
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: usePermissionCanMock }),
}));

vi.mock("../Link", () => ({
  default: ({ children, href, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/Components/NumberCardDisplay", () => ({
  default: ({ numberCard, filters }) => (
    <div data-testid="number-card-display">
      <span data-testid="ncd-label">{numberCard.label}</span>
      <span data-testid="ncd-filters">{JSON.stringify(filters)}</span>
    </div>
  ),
}));

// Stub NumberCardLinkModel: tombol "pilih" memicu onValueChange dgn value
// palsu -- dipakai utk membuktikan renderForm(draft, patchDraft) di
// NumberCardBlock benar-benar menyambungkan onValueChange -> patchDraft.
vi.mock("@/Components/NumberCardLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <div data-testid="number-card-link-model">
      <span data-testid="nclm-value">{value?.id ?? "kosong"}</span>
      <button
        type="button"
        onClick={() => onValueChange({ id: 99, label: "Card Baru" })}
      >
        pilih
      </button>
    </div>
  ),
}));

// Stub BlockEditDialog: merekam props yang diterima (spy) dan merender
// title + hasil renderForm(initialDraft, patchDraft) + tombol simulasi utk
// memicu onSave/onCancelNew langsung dgn fungsi ASLI yang dikirim
// NumberCardBlock (bukan reimplementasi logic).
const blockEditDialogSpy = vi.fn();
vi.mock("@/Components/DashboardBlocks/BlockEditDialog", () => ({
  default: (props) => {
    blockEditDialogSpy(props);
    if (!props.open) return null;
    const errorMessage = props.validate
      ? props.validate(props.initialDraft)
      : null;
    return (
      <div data-testid="block-edit-dialog">
        <div data-testid="dialog-title">{props.title}</div>
        {props.renderForm(props.initialDraft, (patch) =>
          props.onSave({ ...props.initialDraft, ...patch }),
        )}
        {errorMessage && <div data-testid="dialog-error">{errorMessage}</div>}
        <button type="button" onClick={() => props.onCancelNew?.()}>
          batal-simulasi
        </button>
      </div>
    );
  },
}));

window.route = (name, id) => `${name}/${id}`;

import NumberCardBlock from "./NumberCardBlock";

const baseBlock = {
  id: "block-1",
  numberCard: { id: 7, label: "Total Penjualan", filters: { year: 2026 } },
};

function renderBlock(props = {}) {
  return render(
    <NumberCardBlock
      block={baseBlock}
      canEdit={false}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
      editOpen={false}
      onEditOpenChange={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  blockEditDialogSpy.mockClear();
  usePermissionCanMock.mockReset();
  usePermissionCanMock.mockReturnValue(true);
  usePageMock.mockReturnValue({ props: { canEdit: true } });
});

describe("NumberCardBlock — render angka", () => {
  it("merender NumberCardDisplay dgn numberCard & filters block saat numberCard tersedia", () => {
    renderBlock();

    expect(screen.getByTestId("number-card-display")).toBeInTheDocument();
    expect(screen.getByTestId("ncd-label")).toHaveTextContent(
      "Total Penjualan",
    );
    expect(screen.getByTestId("ncd-filters")).toHaveTextContent(
      JSON.stringify({ year: 2026 }),
    );
  });

  it("filters default ke {} kalau block.numberCard.filters tidak ada", () => {
    renderBlock({
      block: { id: "block-2", numberCard: { id: 8, label: "Tanpa Filter" } },
    });

    expect(screen.getByTestId("ncd-filters")).toHaveTextContent("{}");
  });

  it("menampilkan placeholder & TIDAK merender NumberCardDisplay kalau numberCard belum dipilih", () => {
    renderBlock({ block: { id: "block-3", numberCard: null } });

    expect(
      screen.getByText("Belum ada Number Card dipilih"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("number-card-display")).not.toBeInTheDocument();
  });
});

describe("NumberCardBlock — link shortcut edit entity (hover)", () => {
  it("muncul kalau mode edit block nonaktif, punya akses Dashboard, permission write, dan numberCard ber-id", () => {
    renderBlock({ canEdit: false });

    const link = screen.getByTitle("Edit Number Card");
    expect(link).toHaveAttribute("href", "numberCards.show/7");
  });

  it("TIDAK muncul saat mode edit block SEDANG AKTIF (canEdit=true), walau kondisi lain terpenuhi", () => {
    renderBlock({ canEdit: true });

    expect(screen.queryByTitle("Edit Number Card")).not.toBeInTheDocument();
  });

  it("TIDAK muncul kalau user tidak punya hak akses edit Dashboard (page prop canEdit=false)", () => {
    usePageMock.mockReturnValue({ props: { canEdit: false } });
    renderBlock({ canEdit: false });

    expect(screen.queryByTitle("Edit Number Card")).not.toBeInTheDocument();
  });

  it("TIDAK muncul kalau permission write ke NumberCard ditolak", () => {
    usePermissionCanMock.mockReturnValue(false);
    renderBlock({ canEdit: false });

    expect(screen.queryByTitle("Edit Number Card")).not.toBeInTheDocument();
    expect(usePermissionCanMock).toHaveBeenCalledWith("write");
  });

  it("TIDAK muncul kalau numberCard tidak punya id", () => {
    renderBlock({
      canEdit: false,
      block: { id: "block-4", numberCard: { label: "Belum tersimpan" } },
    });

    expect(screen.queryByTitle("Edit Number Card")).not.toBeInTheDocument();
  });
});

describe("NumberCardBlock — BlockEditDialog wiring", () => {
  it("TIDAK merender BlockEditDialog sama sekali saat mode edit block nonaktif", () => {
    renderBlock({ canEdit: false });

    expect(blockEditDialogSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("block-edit-dialog")).not.toBeInTheDocument();
  });

  it("mengirim title, block, canEdit, initialDraft, isNew, dan onCancelNew=onDelete yang benar", () => {
    const onDelete = vi.fn();
    renderBlock({
      canEdit: true,
      editOpen: true,
      onDelete,
      block: { ...baseBlock, isNew: true },
    });

    expect(blockEditDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Edit Number Card",
        block: expect.objectContaining({ id: "block-1", isNew: true }),
        canEdit: true,
        initialDraft: { numberCard: baseBlock.numberCard },
        isNew: true,
        open: true,
      }),
    );

    const [[props]] = blockEditDialogSpy.mock.calls;
    expect(props.onCancelNew).toBe(onDelete);
  });

  it("editOpen meneruskan open=false ke BlockEditDialog sehingga dialog tidak tampil", () => {
    renderBlock({ canEdit: true, editOpen: false });

    expect(screen.queryByTestId("block-edit-dialog")).not.toBeInTheDocument();
    expect(blockEditDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({ open: false }),
    );
  });
});

describe("NumberCardBlock — validate(draft)", () => {
  it("mengembalikan pesan error kalau draft.numberCard belum punya id", () => {
    renderBlock({
      canEdit: true,
      editOpen: true,
      block: { id: "block-5", numberCard: null, isNew: true },
    });

    expect(screen.getByTestId("dialog-error")).toHaveTextContent(
      "Number Card wajib dipilih.",
    );
  });

  it("tidak ada error kalau draft.numberCard sudah punya id", () => {
    renderBlock({ canEdit: true, editOpen: true });

    expect(screen.queryByTestId("dialog-error")).not.toBeInTheDocument();
  });
});

describe("NumberCardBlock — onSave(draft) & renderForm", () => {
  it("renderForm meneruskan value numberCard saat ini ke NumberCardLinkModel", () => {
    renderBlock({ canEdit: true, editOpen: true });

    expect(screen.getByTestId("nclm-value")).toHaveTextContent("7");
  });

  it("memilih Number Card baru via NumberCardLinkModel memicu onUpdate dgn numberCard baru & isNew=false", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    renderBlock({
      canEdit: true,
      editOpen: true,
      onUpdate,
      block: { ...baseBlock, isNew: true },
    });

    await user.click(screen.getByRole("button", { name: "pilih" }));

    expect(onUpdate).toHaveBeenCalledWith({
      id: "block-1",
      numberCard: { id: 99, label: "Card Baru" },
      isNew: false,
    });
  });

  it("onSave({}) (draft.numberCard undefined) tetap panggil onUpdate dgn numberCard lama block", () => {
    const onUpdate = vi.fn();
    renderBlock({ canEdit: true, editOpen: true, onUpdate });

    const [[props]] = blockEditDialogSpy.mock.calls;
    props.onSave({});

    expect(onUpdate).toHaveBeenCalledWith({
      id: "block-1",
      numberCard: baseBlock.numberCard,
      isNew: false,
    });
  });
});

describe("NumberCardBlock — onCancelNew", () => {
  it("tombol batal pada block baru memanggil onDelete (bukan sekadar tutup dialog)", async () => {
    const user = userEvent.setup({ delay: null });
    const onDelete = vi.fn();
    renderBlock({
      canEdit: true,
      editOpen: true,
      onDelete,
      block: { ...baseBlock, isNew: true },
    });

    await user.click(screen.getByRole("button", { name: "batal-simulasi" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
