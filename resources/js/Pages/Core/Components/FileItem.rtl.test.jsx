import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// FileItem tidak memakai i18n atau axios langsung, tapi FormCheckbox (via
// useFormPage) & tooltip radix ikut ke-render -- tidak butuh provider karena
// FileItem tidak mengoper `valueBefore`, jadi cabang Tooltip FormCheckbox
// tidak pernah aktif (lihat FormCheckbox.jsx: tooltip hanya saat `changed`).

// URL.createObjectURL tidak diimplementasikan jsdom -- FileItem memanggilnya
// untuk thumbnail file bertipe image/*.
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
});

import FileItem from "./FileItem";

function makeFile({
  name = "dokumen.pdf",
  type = "application/pdf",
  content = "isi file",
} = {}) {
  return new File([content], name, { type });
}

describe("FileItem", () => {
  it("menampilkan nama file (tanpa ekstensi) di input, ekstensi, dan ukuran", () => {
    const file = makeFile({
      name: "laporan-akhir.pdf",
      content: "x".repeat(2048),
    });
    render(
      <FileItem id="1" file={file} onRemove={vi.fn()} onUpdate={vi.fn()} />,
    );

    expect(screen.getByDisplayValue("laporan-akhir")).toBeInTheDocument();
    expect(screen.getByText(/pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
  });

  it("prop `name` override nama tampilan, bukan file.name", () => {
    const file = makeFile({ name: "original.pdf" });
    render(
      <FileItem
        id="1"
        file={file}
        name="nama-kustom.pdf"
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("nama-kustom")).toBeInTheDocument();
  });

  it("file bertipe image menampilkan <img> thumbnail, bukan ikon FileText", () => {
    const file = makeFile({ name: "foto.png", type: "image/png" });
    const { container } = render(
      <FileItem id="1" file={file} onRemove={vi.fn()} onUpdate={vi.fn()} />,
    );

    // <img alt=""> dianggap ARIA "presentation" (tanpa accessible name),
    // jadi getByRole("img") tidak cocok -- query lewat container langsung.
    expect(container.querySelector("img")).toBeInTheDocument();
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
  });

  it("file non-image tidak menampilkan <img>", () => {
    const file = makeFile({ name: "dokumen.pdf", type: "application/pdf" });
    const { container } = render(
      <FileItem id="1" file={file} onRemove={vi.fn()} onUpdate={vi.fn()} />,
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("mengubah input nama memanggil onUpdate dengan { name }", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const file = makeFile({ name: "asli.pdf" });
    render(
      <FileItem id="42" file={file} onRemove={vi.fn()} onUpdate={onUpdate} />,
    );

    const input = screen.getByDisplayValue("asli");
    await user.type(input, "X");

    expect(onUpdate).toHaveBeenCalledWith("42", { name: "asliX" });
  });

  it("toggle checkbox Public memanggil onUpdate dengan { isPublic }", async () => {
    const user = userEvent.setup({ delay: null });
    const onUpdate = vi.fn();
    const file = makeFile();
    render(
      <FileItem
        id="7"
        file={file}
        isPublic={false}
        onRemove={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    // FormCheckbox (Radix) render dengan role="forminput", bukan "checkbox".
    const checkbox = screen.getByRole("forminput");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");

    await user.click(checkbox);

    expect(onUpdate).toHaveBeenCalledWith("7", { isPublic: true });
  });

  it("checkbox Public checked=true merender data-state=checked", () => {
    const file = makeFile();
    render(
      <FileItem
        id="7"
        file={file}
        isPublic={true}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByRole("forminput")).toHaveAttribute(
      "data-state",
      "checked",
    );
  });

  it("klik tombol hapus (trash) memanggil onRemove dengan id", async () => {
    const user = userEvent.setup({ delay: null });
    const onRemove = vi.fn();
    const file = makeFile();
    render(
      <FileItem id="99" file={file} onRemove={onRemove} onUpdate={vi.fn()} />,
    );

    // Tombol hapus adalah satu-satunya <button> selain checkbox forminput.
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(onRemove).toHaveBeenCalledWith("99");
  });
});
