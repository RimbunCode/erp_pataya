import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

// HeadlessUI <Transition> (dipakai UploadDialog.jsx sendiri utk toggle
// visibilitas dropzone) menyelesaikan state "enter transition selesai" lewat
// mekanisme timing internalnya sendiri (rAF/CSS transitionend fallback) yang
// TIDAK pernah benar-benar tertangkap act() di jsdom (sudah dicoba flush
// macrotask berkali-kali, tetap warning) -- masalah timing act()+HeadlessUI
// di jsdom yang sudah dikenal luas, bukan bug di UploadDialog.jsx. Test di
// sini tidak menguji animasi transisi itu sendiri, jadi stub jadi passthrough
// kondisional (render children langsung berdasar `show`, tanpa animasi).
vi.mock("@headlessui/react", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Transition: ({ show, children }) => (show ? children : null),
  };
});

const routerPost = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: { post: (...a) => routerPost(...a) },
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...a) => axiosPost(...a) },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: {
    success: (...a) => toastSuccess(...a),
    error: (...a) => toastError(...a),
  },
}));

// Library punya axios call & state pencarian sendiri -- diuji terpisah.
// Di sini cukup distub agar test UploadDialog fokus ke menu "home"
// (dropzone/file list) dan wrapper dialog itu sendiri.
vi.mock("@/Pages/Core/Components/Library/Library", () => ({
  default: React.forwardRef(function LibraryStub(
    { setMenu, checklistFile, setChecklistFile },
    _ref,
  ) {
    return (
      <div data-testid="library-stub">
        <button type="button" onClick={() => setMenu("home")}>
          back-to-home
        </button>
        <button
          type="button"
          onClick={() => {
            const next = new Set(checklistFile);
            next.add(123);
            setChecklistFile(next);
          }}
        >
          pick-library-file-123
        </button>
      </div>
    );
  }),
}));

function mockMatchMedia(matches = false) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

window.route = (name) => name;

import { Dialog } from "@/Components/ui/dialog";
import UploadDialog from "./UploadDialog";

// UploadDialog/Library membaca file via FileReader (async) saat file dipilih
// -- render() polos RTL cuma membungkus bagian SINKRON dalam act(), promise/
// callback FileReader tetap lanjut di microtask SESUDAH act() itu selesai.
// Bungkus render() ITU SENDIRI dalam `await act(async () => {})` supaya
// semua microtask stabil dulu.
async function renderDialog(props = {}) {
  const onClose = props.onClose ?? vi.fn();
  let utils;
  await act(async () => {
    utils = render(
      <Dialog open onOpenChange={() => {}}>
        <UploadDialog onClose={onClose} {...props} />
      </Dialog>,
    );
  });
  return { ...utils, onClose };
}

function makeFile(name = "photo.png", type = "image/png", content = "hello") {
  return new File([content], name, { type });
}

// Dropzone card sengaja pakai class Tailwind `**:pointer-events-none`
// (semua descendant termasuk <input type=file> ter-disable pointer-events
// secara visual; klik nyata user seharusnya lewat <label htmlFor>, area
// drag&drop tidak menangkap klik langsung ke elemen anak). Untuk KLIK
// (tombol Library, tombol hapus, dst) tetap pakai userEvent dgn
// pointerEventsCheck: 0 supaya tidak false-positive menolak elemen valid.
// Untuk file input tersembunyi itu sendiri, userEvent.upload() gagal
// meng-assign FileList meski pointerEventsCheck dimatikan (root cause tak
// terverifikasi -- kemungkinan besar terkait cara input dgn class Tailwind
// arbitrary-variant di-resolve getComputedStyle di jsdom) -- pakai
// fireEvent.change dgn Object.defineProperty(files) langsung, pola yang
// terbukti reliable untuk kasus ini.
function setupUser() {
  return userEvent.setup({ delay: null, pointerEventsCheck: 0 });
}

function uploadFile(input, file) {
  Object.defineProperty(input, "files", { value: [file], writable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  mockMatchMedia(false);
  axiosPost.mockReset();
  routerPost.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UploadDialog", () => {
  it("merender dropzone home dengan tombol My Device dan Library", async () => {
    await renderDialog();
    expect(screen.getByText("My Device")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach" })).toBeDisabled();
  });

  it("memilih file lewat input file menambahkannya ke daftar dan mengaktifkan tombol Attach", async () => {
    await renderDialog();

    const input = document.querySelector('input[type="file"]');
    uploadFile(input, makeFile());

    expect(screen.getByDisplayValue("photo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach" })).not.toBeDisabled();
  });

  it("menghapus file dari daftar mengembalikan tombol Attach ke disabled", async () => {
    const user = setupUser();
    await renderDialog();

    const input = document.querySelector('input[type="file"]');
    uploadFile(input, makeFile());
    expect(screen.getByRole("button", { name: "Attach" })).not.toBeDisabled();

    // FileItem punya satu tombol icon-only (Trash2) tanpa accessible name teks.
    const buttons = screen.getAllByRole("button");
    const removeButton = buttons.find((b) =>
      b.querySelector("svg.lucide-trash2"),
    );
    await user.click(removeButton);

    expect(screen.queryByDisplayValue("photo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach" })).toBeDisabled();
  });

  it("beralih ke menu Library menyembunyikan dropzone dan menampilkan Library stub", async () => {
    const user = setupUser();
    await renderDialog();

    await user.click(screen.getByText("Library"));

    expect(screen.getByTestId("library-stub")).toBeInTheDocument();
    expect(screen.queryByText("My Device")).not.toBeInTheDocument();
  });

  it("mode onBuffer: klik Attach mengunggah via axios.post ke files.store lalu memanggil onBuffer & onClose", async () => {
    const user = setupUser();
    const onBuffer = vi.fn();
    const onClose = vi.fn();
    axiosPost.mockResolvedValue({
      data: [{ id: 1, name: "photo.png" }],
    });
    await renderDialog({ onBuffer, onClose });

    const input = document.querySelector('input[type="file"]');
    uploadFile(input, makeFile());
    await user.click(screen.getByRole("button", { name: "Attach" }));

    expect(axiosPost).toHaveBeenCalledWith(
      "files.store",
      expect.any(FormData),
      expect.objectContaining({
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
    await vi.waitFor(() =>
      expect(onBuffer).toHaveBeenCalledWith([{ id: 1, name: "photo.png" }]),
    );
    expect(toastSuccess).toHaveBeenCalledWith("TR:core.form.upload_success");
    expect(onClose).toHaveBeenCalled();
  });

  it("mode onBuffer: upload gagal menampilkan toast error dan tidak menutup dialog", async () => {
    const user = setupUser();
    const onBuffer = vi.fn();
    const onClose = vi.fn();
    axiosPost.mockRejectedValue(new Error("network error"));
    await renderDialog({ onBuffer, onClose });

    const input = document.querySelector('input[type="file"]');
    uploadFile(input, makeFile());
    await user.click(screen.getByRole("button", { name: "Attach" }));

    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("TR:core.form.upload_failed"),
    );
    expect(onBuffer).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("mode default (tanpa onBuffer): klik Attach memanggil router.post ke path .../file", async () => {
    const user = setupUser();
    const onClose = vi.fn();
    delete window.location;
    window.location = new URL("https://example.test/todos/9?tab=files");
    routerPost.mockImplementation((_url, _data, opts) => opts.onSuccess?.());
    await renderDialog({ onClose });

    const input = document.querySelector('input[type="file"]');
    uploadFile(input, makeFile());
    await user.click(screen.getByRole("button", { name: "Attach" }));

    expect(routerPost).toHaveBeenCalledWith(
      "/todos/9/file?tab=files",
      expect.any(FormData),
      expect.objectContaining({ forceFormData: true, reset: ["attachments"] }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  // BUG PRODUKSI (dilaporkan, tidak diperbaiki di sini): jalur "My Device"
  // (<input type="file"> onChange, UploadDialog.jsx sekitar baris 296-311)
  // menambahkan SEMUA file terpilih ke state `files` tanpa validasi
  // `imageOnly` sama sekali -- filter satu-satunya adalah atribut HTML
  // `accept={imageOnly ? "image/*" : "*"}`, yang cuma hint UI utk file
  // picker native browser (tidak dipaksakan oleh kode, dan trivial dilewati
  // lewat drag-drop atau upload terprogram). Validasi imageOnly yang benar
  // hanya ada di addFile() (baris 46) yang DIPAKAI HANYA oleh onDrop
  // (drag-drop) -- dan bahkan di situ pun logic-nya TERBALIK: kondisi
  // `if (imageOnly && checkFileType("image/*", file.type)) return;`
  // menolak file yang MEMANG image, bukan yang bukan-image.
  it("imageOnly=true (BUG: tidak divalidasi) tetap menerima file non-image lewat input picker", async () => {
    await renderDialog({ imageOnly: true });

    const input = document.querySelector('input[type="file"]');
    uploadFile(input, makeFile("doc.pdf", "application/pdf"));

    // Seharusnya ditolak (imageOnly=true), tapi jalur onChange input file
    // tidak melakukan validasi apa pun -- file non-image tetap masuk daftar.
    expect(screen.getByDisplayValue("doc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach" })).not.toBeDisabled();
  });

  it("memilih file dari Library mengaktifkan Attach berdasar checklistFile, bukan files[]", async () => {
    const user = setupUser();
    await renderDialog();

    await user.click(screen.getByText("Library"));
    expect(screen.getByRole("button", { name: "Attach" })).toBeDisabled();

    await user.click(screen.getByText("pick-library-file-123"));
    expect(screen.getByRole("button", { name: "Attach" })).not.toBeDisabled();
  });

  it("single=true menyembunyikan tombol Browse tambahan di footer", async () => {
    await renderDialog({ single: true });

    const input = document.querySelector('input[type="file"]');
    uploadFile(input, makeFile());

    expect(screen.queryByText("Browse")).not.toBeInTheDocument();
  });
});
