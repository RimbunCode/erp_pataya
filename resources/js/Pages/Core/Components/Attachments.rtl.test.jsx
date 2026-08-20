import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const routerDelete = vi.fn();
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  router: { delete: (...a) => routerDelete(...a) },
  // Deferred cukup dirender langsung sebagai children -- pengujian loading
  // fallback bukan concern komponen ini (itu tanggung jawab Inertia sendiri).
  Deferred: ({ children }) => children,
}));

// useFormPage bisa undefined (render di luar FormPageContext) atau berisi
// {isCreate, data, setData} -- dikontrol per-test lewat mockReturnValue.
const useFormPageMock = vi.fn();
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...a) => useFormPageMock(...a),
}));

// UploadDialog adalah komponen berat (dropzone, library, upload progress)
// dengan concern sendiri -- stub agar test Attachments fokus ke daftar
// attachment & tombol hapus, bukan mekanisme upload.
vi.mock("./UploadDialog", () => ({
  default: ({ onBuffer, onClose }) => (
    <div data-testid="stub-upload-dialog">
      <button
        type="button"
        onClick={() => {
          onBuffer?.([{ id: 99, name: "hasil-upload.pdf" }]);
        }}
      >
        simulate-upload
      </button>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

window.route = (name, id) => (id ? `${name}/${id}` : name);

import Attachments from "./Attachments";
import { TooltipProvider } from "@/Components/ui/tooltip";

const renderAttachments = () =>
  render(
    <TooltipProvider>
      <Attachments />
    </TooltipProvider>,
  );

describe("Attachments", () => {
  beforeEach(() => {
    routerDelete.mockReset();
    useFormPageMock.mockReset();
    usePageMock.mockReturnValue({ props: { attachments: [] } });
  });

  it("mode edit: menampilkan daftar attachment dari shared props", () => {
    useFormPageMock.mockReturnValue(undefined);
    usePageMock.mockReturnValue({
      props: {
        attachments: [
          { id: 1, name: "invoice.pdf" },
          { id: 2, name: "receipt.png" },
        ],
      },
    });

    renderAttachments();

    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    expect(screen.getByText("receipt.png")).toBeInTheDocument();
  });

  it("mode edit: klik tombol hapus memanggil router.delete dengan path file/{id}", async () => {
    const user = userEvent.setup({ delay: null });
    useFormPageMock.mockReturnValue(undefined);
    usePageMock.mockReturnValue({
      props: { attachments: [{ id: 5, name: "dokumen.pdf" }] },
    });

    renderAttachments();

    // Tombol hapus hanya berisi icon X tanpa accessible name -- ambil button
    // di dalam <li> baris attachment tersebut (satu-satunya button di situ).
    const row = screen.getByText("dokumen.pdf").closest("li");
    const deleteButton = row.querySelector("button");
    await user.click(deleteButton);

    expect(routerDelete).toHaveBeenCalledTimes(1);
    const [calledPath, options] = routerDelete.mock.calls[0];
    expect(calledPath).toMatch(/\/file\/5$/);
    expect(options).toEqual(
      expect.objectContaining({
        reset: ["attachments"],
        preserveScroll: true,
        preserveState: true,
        replace: true,
      }),
    );
  });

  it("mode create: menampilkan file dari buffer form (data.files), bukan shared props", () => {
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: { files: [{ id: 10, name: "draft.docx" }] },
      setData: vi.fn(),
    });
    usePageMock.mockReturnValue({
      props: { attachments: [{ id: 999, name: "harus-tidak-tampil.pdf" }] },
    });

    renderAttachments();

    expect(screen.getByText("draft.docx")).toBeInTheDocument();
    expect(
      screen.queryByText("harus-tidak-tampil.pdf"),
    ).not.toBeInTheDocument();
  });

  it("mode create: file tanpa `name` eksplisit fallback ke file.file.name", () => {
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: {
        files: [{ id: 11, file: { name: "raw-file-object.jpg" } }],
      },
      setData: vi.fn(),
    });

    renderAttachments();

    expect(screen.getByText("raw-file-object.jpg")).toBeInTheDocument();
  });

  it("mode create: hapus file memanggil setData dengan buffer terfilter, tanpa router.delete", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: {
        files: [
          { id: 1, name: "a.pdf" },
          { id: 2, name: "b.pdf" },
        ],
      },
      setData,
    });

    renderAttachments();

    const row = screen.getByText("a.pdf").closest("li");
    await user.click(row.querySelector("button"));

    expect(setData).toHaveBeenCalledWith("files", [{ id: 2, name: "b.pdf" }]);
    expect(routerDelete).not.toHaveBeenCalled();
  });

  it("mode create: upload via dialog menambahkan hasil ke buffer files lewat onBuffer", async () => {
    const user = userEvent.setup({ delay: null });
    const setData = vi.fn();
    useFormPageMock.mockReturnValue({
      isCreate: true,
      data: { files: [{ id: 1, name: "existing.pdf" }] },
      setData,
    });

    renderAttachments();

    // Buka dialog upload (trigger tombol Plus di header -- button pertama,
    // sebelum button hapus baris attachment yang sudah ada).
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);
    await user.click(screen.getByText("simulate-upload"));

    expect(setData).toHaveBeenCalledWith("files", [
      { id: 1, name: "existing.pdf" },
      { id: 99, name: "hasil-upload.pdf" },
    ]);
  });

  it("mode edit tanpa context FormPage: attachments kosong tidak melempar error", () => {
    useFormPageMock.mockReturnValue(undefined);
    usePageMock.mockReturnValue({ props: { attachments: [] } });

    renderAttachments();

    expect(screen.getByText("TR:core.form.attachments")).toBeInTheDocument();
  });
});
