import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// BlockEditDialog dipakai lintas block (Section/Shortcut/Link Card/Quick
// List/Card/Chart -- lihat komentar di source) sebagai Dialog generik:
// draft lokal di state, Apply commit ke onSave, Cancel/close membuang
// draft. Test ini merender komponen SUNGGUHAN (bukan mock BlockEditDialog
// seperti di NumberCardBlock.rtl.test.jsx) memakai renderForm STUB
// sederhana -- fokus HANYA ke logic milik BlockEditDialog sendiri: resolusi
// draft awal (initialDraft vs block.config), reset draft saat dialog
// dibuka ulang, validate(draft) -> disable Terapkan, handleApply
// (onSave -> onApplied -> onOpenChange(false)), dan handleCancel (biasa vs
// isNew+onCancelNew, termasuk penutupan internal Radix via Escape).
import BlockEditDialog from "./BlockEditDialog";

// renderForm stub generik: 1 input teks terhubung ke draft.label. Cukup utk
// membuktikan draft/patchDraft yang dikirim BlockEditDialog ke renderForm
// benar-benar dipakai (bukan menguji form spesifik block manapun).
function renderFormStub(draft, patchDraft) {
  return (
    <input
      aria-label="label-input"
      value={draft.label ?? ""}
      onChange={(e) => patchDraft({ label: e.target.value })}
    />
  );
}

function baseProps(overrides = {}) {
  return {
    title: "Judul Dialog",
    block: { id: "block-1", config: { label: "Awal" } },
    canEdit: true,
    open: true,
    onOpenChange: vi.fn(),
    onSave: vi.fn(),
    renderForm: renderFormStub,
    ...overrides,
  };
}

describe("BlockEditDialog — gating canEdit", () => {
  it("return null (tidak merender apapun) kalau canEdit=false, walau open=true", () => {
    render(<BlockEditDialog {...baseProps({ canEdit: false })} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Judul Dialog")).not.toBeInTheDocument();
  });
});

describe("BlockEditDialog — render dasar", () => {
  it("merender title, hasil renderForm(draft), dan tombol Batal/Terapkan saat open=true", () => {
    render(<BlockEditDialog {...baseProps()} />);

    expect(
      screen.getByRole("dialog", { name: "Judul Dialog" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("label-input")).toHaveValue("Awal");
    expect(screen.getByRole("button", { name: "Batal" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Terapkan" }),
    ).toBeInTheDocument();
  });

  it("dialog tidak tampil di DOM saat open=false", () => {
    render(<BlockEditDialog {...baseProps({ open: false })} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("BlockEditDialog — resolusi draft awal (resolveInitial)", () => {
  it("pakai initialDraft kalau diberikan, bukan block.config", () => {
    render(
      <BlockEditDialog
        {...baseProps({
          initialDraft: { label: "Dari initialDraft" },
          block: { id: "b", config: { label: "Harus diabaikan" } },
        })}
      />,
    );

    expect(screen.getByLabelText("label-input")).toHaveValue(
      "Dari initialDraft",
    );
  });

  it("fallback ke block.config kalau initialDraft undefined", () => {
    render(
      <BlockEditDialog
        {...baseProps({
          initialDraft: undefined,
          block: { id: "b", config: { label: "Dari config" } },
        })}
      />,
    );

    expect(screen.getByLabelText("label-input")).toHaveValue("Dari config");
  });

  it("fallback ke {} kalau initialDraft & block.config dua-duanya tidak ada", () => {
    render(
      <BlockEditDialog
        {...baseProps({ initialDraft: undefined, block: { id: "b" } })}
      />,
    );

    expect(screen.getByLabelText("label-input")).toHaveValue("");
  });
});

describe("BlockEditDialog — reset draft saat dialog dibuka ulang", () => {
  it("perubahan draft lokal hilang & kembali ke resolveInitial() setelah dialog ditutup lalu dibuka lagi", async () => {
    const user = userEvent.setup();
    const block = { id: "b", config: { label: "V1" } };
    const { rerender } = render(<BlockEditDialog {...baseProps({ block })} />);

    await user.clear(screen.getByLabelText("label-input"));
    await user.type(screen.getByLabelText("label-input"), "Diubah user");
    expect(screen.getByLabelText("label-input")).toHaveValue("Diubah user");

    rerender(<BlockEditDialog {...baseProps({ block, open: false })} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<BlockEditDialog {...baseProps({ block, open: true })} />);

    expect(screen.getByLabelText("label-input")).toHaveValue("V1");
  });
});

describe("BlockEditDialog — patch draft (renderForm -> patchDraft -> merge)", () => {
  it("patch dari renderForm di-merge ke draft sebelumnya, bukan replace total", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <BlockEditDialog
        {...baseProps({
          initialDraft: { label: "Awal", other: "tetap" },
          onSave,
        })}
      />,
    );

    await user.clear(screen.getByLabelText("label-input"));
    await user.type(screen.getByLabelText("label-input"), "Baru");
    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onSave).toHaveBeenCalledWith({ label: "Baru", other: "tetap" });
  });
});

describe("BlockEditDialog — validate(draft)", () => {
  it("menampilkan pesan error dari validate() dan men-disable tombol Terapkan", () => {
    const validate = vi.fn(() => "Label wajib diisi.");
    render(<BlockEditDialog {...baseProps({ validate })} />);

    expect(screen.getByText("Label wajib diisi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();
  });

  it("klik Terapkan saat ada error TIDAK memanggil onSave (tombol disabled)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const validate = () => "Error selalu";
    render(<BlockEditDialog {...baseProps({ validate, onSave })} />);

    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("validate() mengembalikan null -> tidak ada pesan error, tombol Terapkan enabled", () => {
    const validate = vi.fn(() => null);
    render(<BlockEditDialog {...baseProps({ validate })} />);

    expect(document.querySelector(".text-destructive")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).not.toBeDisabled();
  });

  it("tanpa prop validate sama sekali -> tidak pernah ada error, tombol selalu enabled", () => {
    render(<BlockEditDialog {...baseProps({ validate: undefined })} />);

    expect(document.querySelector(".text-destructive")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).not.toBeDisabled();
  });

  it("validate dipanggil ulang dgn draft terbaru setiap draft berubah (live validation)", async () => {
    const user = userEvent.setup();
    const validate = (draft) => (draft.label ? null : "Label wajib diisi.");
    render(
      <BlockEditDialog
        {...baseProps({ initialDraft: { label: "" }, validate })}
      />,
    );

    expect(screen.getByText("Label wajib diisi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).toBeDisabled();

    await user.type(screen.getByLabelText("label-input"), "X");

    expect(screen.queryByText("Label wajib diisi.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terapkan" })).not.toBeDisabled();
  });
});

describe("BlockEditDialog — Terapkan (handleApply)", () => {
  it("klik Terapkan tanpa error memanggil onSave(draft) -> onApplied() -> onOpenChange(false), berurutan", async () => {
    const user = userEvent.setup();
    const callOrder = [];
    const onSave = vi.fn(() => callOrder.push("onSave"));
    const onApplied = vi.fn(() => callOrder.push("onApplied"));
    const onOpenChange = vi.fn(() => callOrder.push("onOpenChange"));

    render(
      <BlockEditDialog {...baseProps({ onSave, onApplied, onOpenChange })} />,
    );

    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onSave).toHaveBeenCalledWith({ label: "Awal" });
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(callOrder).toEqual(["onSave", "onApplied", "onOpenChange"]);
  });

  it("onApplied opsional -- klik Terapkan tanpa onApplied tidak crash, tetap panggil onSave & onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <BlockEditDialog
        {...baseProps({ onSave, onOpenChange, onApplied: undefined })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Terapkan" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("BlockEditDialog — Batal (handleCancel), bukan block baru", () => {
  it("klik Batal memanggil onOpenChange(false), TIDAK memanggil onSave", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSave = vi.fn();
    render(
      <BlockEditDialog
        {...baseProps({ onOpenChange, onSave, isNew: false })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("perubahan draft lokal TIDAK ikut ter-commit saat Batal", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<BlockEditDialog {...baseProps({ onSave })} />);

    await user.type(screen.getByLabelText("label-input"), " diubah");
    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("BlockEditDialog — Batal pada block baru (isNew + onCancelNew)", () => {
  it("klik Batal memanggil onCancelNew() dan TIDAK memanggil onOpenChange sama sekali", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onCancelNew = vi.fn();
    render(
      <BlockEditDialog
        {...baseProps({ isNew: true, onCancelNew, onOpenChange })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onCancelNew).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("isNew=true tapi onCancelNew tidak diberikan -> fallback ke onOpenChange(false) biasa", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <BlockEditDialog
        {...baseProps({ isNew: true, onCancelNew: undefined, onOpenChange })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("penutupan internal Radix (Escape) juga di-intercept jadi onCancelNew, bukan onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onCancelNew = vi.fn();
    render(
      <BlockEditDialog
        {...baseProps({ isNew: true, onCancelNew, onOpenChange })}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onCancelNew).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
