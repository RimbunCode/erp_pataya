import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// t harus stabil (referensi sama tiap render) -- source EmailSendDialog.jsx
// memakai `t` sebagai dependency useEffect fetch preview. Mock naif yang
// membuat fungsi baru tiap panggil useLaravelReactI18n() akan membuat effect
// itu re-run pada SETIAP render (termasuk render akibat setLoading di
// dalamnya sendiri), membuat loading state tak pernah stabil ke false.
const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const routerPost = vi.fn();
vi.mock("@inertiajs/react", () => ({
  router: { post: (...a) => routerPost(...a) },
}));

const axiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: (...a) => axiosGet(...a) },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: {
    success: (...a) => toastSuccess(...a),
    error: (...a) => toastError(...a),
  },
}));

// TiptapEditor (ProseMirror) berat & tidak reliable di jsdom -- stub textarea
// yang memanggil onValueChange(json, html) sesuai signature aslinya.
vi.mock("@/Components/TiptapEditor", () => ({
  default: React.forwardRef(function TiptapEditorStub(
    { value, onValueChange },
    _ref,
  ) {
    return (
      <textarea
        data-testid="body-editor-stub"
        defaultValue={typeof value === "string" ? value : ""}
        onChange={(e) => onValueChange?.(null, e.target.value)}
      />
    );
  }),
}));

// react-mentions (Mention/MentionsInput) juga berat -- stub input polos yang
// tetap memanggil onChange(event, value) sesuai signature yang dipakai source.
vi.mock("@/Components/Mention", () => ({
  // `children` (elemen <Mention/> asli) HARUS didestruktur di sini supaya
  // TIDAK ikut ...props -- kalau tidak, ia ke-spread ke <input> yang
  // merupakan void element (React menolak <input> punya prop children).
  MentionsInput: ({ value, onChange, children: _children, ...props }) => (
    <input
      data-testid="subject-mentions-stub"
      value={value}
      onChange={(e) => onChange?.(e, e.target.value)}
      {...props}
    />
  ),
  Mention: () => null,
}));

// UploadDialog diuji terpisah (UploadDialog.rtl.test.jsx) -- stub agar test
// EmailSendDialog fokus ke wrapper-nya sendiri, cukup expose tombol yang
// memicu onBuffer dengan payload file baru.
vi.mock("@/Pages/Core/Components/UploadDialog", () => ({
  default: ({ onBuffer }) => (
    <button
      type="button"
      onClick={() => onBuffer([{ id: 999, name: "new-file.pdf" }])}
    >
      stub-upload-attach
    </button>
  ),
}));

window.route = (name, params) =>
  Array.isArray(params) ? `${name}/${params.join(",")}` : `${name}/${params}`;

import EmailSendDialog from "./EmailSendDialog";

const basePreview = {
  subject: "Invoice #123",
  body: "<p>Halo</p>",
  recipient: "customer@example.com",
  fromAddress: "no-reply@example.com",
  fromName: "PT Contoh",
  files: [
    { id: 1, name: "invoice.pdf", isGeneratedPdf: true },
    { id: 2, name: "attachment.docx", isGeneratedPdf: false },
  ],
  hasGeneratedPdf: true,
  canOfferPdf: false,
  resolvedFields: [{ value: "{{customer.name}}", label: "Customer Name" }],
};

// EmailSendDialog fetch preview via axios.get di useEffect saat mount TANPA
// di-await test-nya -- render() polos RTL cuma membungkus bagian SINKRON
// dalam act(), promise mock (walau resolve instan) tetap lanjut di
// microtask SESUDAH act() itu selesai. Bungkus render() ITU SENDIRI dalam
// `await act(async () => {})` supaya semua microtask stabil dulu.
async function renderDialog(props = {}) {
  let result;
  await act(async () => {
    result = render(
      <EmailSendDialog
        open={true}
        onOpenChange={vi.fn()}
        resourceNamePlural="salesOrders"
        documentId={42}
        emailTemplateId={7}
        {...props}
      />,
    );
  });
  return result;
}

beforeEach(() => {
  axiosGet.mockReset();
  routerPost.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  axiosGet.mockResolvedValue({ data: basePreview });
});

describe("EmailSendDialog", () => {
  it("tidak fetch preview saat open=false", async () => {
    await renderDialog({ open: false });
    expect(axiosGet).not.toHaveBeenCalled();
  });

  it("fetch preview via axios.get saat open=true dengan route yang benar", async () => {
    await renderDialog();
    expect(axiosGet).toHaveBeenCalledWith("salesOrders.email.preview/42,7");
    expect(await screen.findByText("customer@example.com")).toBeTruthy();
  });

  it("menampilkan loading state sebelum preview selesai dimuat", async () => {
    let resolvePreview;
    axiosGet.mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    await renderDialog();

    expect(screen.getByText("TR:core.form.loading")).toBeInTheDocument();

    resolvePreview({ data: basePreview });
    await screen.findByDisplayValue("Invoice #123");
  });

  it("mengisi form dari hasil preview (from name, to, subject)", async () => {
    await renderDialog();

    expect(await screen.findByDisplayValue("PT Contoh")).toBeInTheDocument();
    expect(screen.getByText("customer@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Invoice #123")).toBeInTheDocument();
  });

  it("preview gagal dimuat menampilkan toast error dan fallback ke state kosong", async () => {
    axiosGet.mockRejectedValue(new Error("network error"));
    await renderDialog();

    await vi.waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("TR:core.errors.fetch_failed"),
    );
    // fromAddress kosong (EMPTY_PREVIEW) -- form tetap render tanpa crash.
    expect(
      await screen.findByPlaceholderText(
        "TR:core.emailTemplate.send.fromNamePlaceholder",
      ),
    ).toBeInTheDocument();
  });

  it("checkbox file PDF existing sudah tercentang otomatis (preselected)", async () => {
    await renderDialog();
    await screen.findByDisplayValue("Invoice #123");

    const pdfCheckbox = screen.getByRole("forminput", { name: /invoice.pdf/ });
    expect(pdfCheckbox).toHaveAttribute("data-state", "checked");

    const nonPdfCheckbox = screen.getByRole("forminput", {
      name: /attachment.docx/,
    });
    expect(nonPdfCheckbox).toHaveAttribute("data-state", "unchecked");
  });

  it("toggle checkbox attachment existing mengubah selectedFileIds", async () => {
    const user = userEvent.setup({ delay: null });
    await renderDialog();
    await screen.findByDisplayValue("Invoice #123");

    const nonPdfCheckbox = screen.getByRole("forminput", {
      name: /attachment.docx/,
    });
    expect(nonPdfCheckbox).toHaveAttribute("data-state", "unchecked");

    await user.click(nonPdfCheckbox);
    expect(nonPdfCheckbox).toHaveAttribute("data-state", "checked");
  });

  it("checkbox 'sertakan PDF' hanya muncul saat belum ada PDF & canOfferPdf true", async () => {
    axiosGet.mockResolvedValue({
      data: {
        ...basePreview,
        hasGeneratedPdf: false,
        canOfferPdf: true,
        files: [],
      },
    });
    await renderDialog();
    await screen.findByDisplayValue("Invoice #123");

    expect(
      screen.getByText("TR:core.emailTemplate.send.includePdf"),
    ).toBeInTheDocument();
  });

  it("upload file baru via UploadDialog menambah ke daftar attachment baru dan terselect", async () => {
    const user = userEvent.setup({ delay: null });
    await renderDialog();
    await screen.findByDisplayValue("Invoice #123");

    await user.click(screen.getByText("stub-upload-attach"));

    expect(screen.getByText("new-file.pdf")).toBeInTheDocument();
    const newFileCheckbox = screen.getByRole("forminput", {
      name: /new-file.pdf/,
    });
    expect(newFileCheckbox).toHaveAttribute("data-state", "checked");
  });

  it("tombol kirim disabled saat 'to' kosong", async () => {
    axiosGet.mockResolvedValue({ data: { ...basePreview, recipient: null } });
    await renderDialog();
    await screen.findByDisplayValue("Invoice #123");

    expect(
      screen.getByRole("button", { name: "TR:core.emailTemplate.send.button" }),
    ).toBeDisabled();
  });

  it("submit kirim memanggil router.post dengan payload yang benar dan menutup dialog", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenChange = vi.fn();
    routerPost.mockImplementation((_url, _data, opts) => opts.onSuccess?.());
    await renderDialog({ onOpenChange });
    await screen.findByDisplayValue("Invoice #123");

    await user.click(
      screen.getByRole("button", { name: "TR:core.emailTemplate.send.button" }),
    );

    expect(routerPost).toHaveBeenCalledWith(
      "salesOrders.email.send/42",
      expect.objectContaining({
        to: "customer@example.com",
        from_name: "PT Contoh",
        subject: "Invoice #123",
      }),
      expect.objectContaining({ preserveScroll: true }),
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      "TR:core.emailTemplate.send.queued",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submit gagal menampilkan toast error dan tidak menutup dialog", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenChange = vi.fn();
    routerPost.mockImplementation((_url, _data, opts) => opts.onError?.());
    await renderDialog({ onOpenChange });
    await screen.findByDisplayValue("Invoice #123");

    await user.click(
      screen.getByRole("button", { name: "TR:core.emailTemplate.send.button" }),
    );

    expect(toastError).toHaveBeenCalledWith("TR:core.errors.fetch_failed");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("klik tombol batal memanggil onOpenChange(false)", async () => {
    const user = userEvent.setup({ delay: null });
    const onOpenChange = vi.fn();
    await renderDialog({ onOpenChange });
    await screen.findByDisplayValue("Invoice #123");

    await user.click(
      screen.getByRole("button", { name: "TR:core.form.cancel" }),
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
