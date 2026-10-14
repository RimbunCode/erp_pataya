import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";

// Blok teks Quotation (AC5.2, AC5.4) + Rich Text TipTap & Simpan sebagai Template Baru:
// tambah, hapus, urutkan, salin dari template, pilih template per blok, edit inline,
// dan simpan hasil editan sebagai template baru.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
const inertiaFormMocks = vi.hoisted(() => ({
  clearErrors: vi.fn(),
  post: vi.fn(),
}));
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
  useForm: (initialData) => {
    const [data, setData] = React.useState(initialData);
    return {
      data,
      setData: (key, value) => {
        if (typeof key === "string") {
          setData((previous) => ({ ...previous, [key]: value }));
          return;
        }

        setData(key);
      },
      post: (url, options) => inertiaFormMocks.post(url, options, data),
      processing: false,
      errors: {},
      clearErrors: inertiaFormMocks.clearErrors,
      reset: () => setData(initialData),
    };
  },
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: {
    success: (...args) => toastSuccessMock(...args),
    error: (...args) => toastErrorMock(...args),
  },
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

function extractTextFromValue(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && Array.isArray(val.content)) {
    return val.content
      .map((node) => extractTextFromValue(node))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof val === "object" && typeof val.text === "string") {
    return val.text;
  }
  return "";
}

vi.mock("@/Components/TiptapEditor", () => ({
  default: ({ value, onValueChange, onBlur, readOnly, disabled }) => {
    const textValue = extractTextFromValue(value);
    return (
      <textarea
        data-testid="tiptap-editor"
        value={textValue}
        readOnly={Boolean(readOnly || disabled)}
        onBlur={(e) => onBlur?.(e)}
        onChange={(e) => {
          const nextText = e.target.value;
          const nextJson = {
            type: "doc",
            content: nextText
              ? [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: nextText }],
                  },
                ]
              : [{ type: "paragraph" }],
          };
          onValueChange?.(nextJson, nextText);
        }}
      />
    );
  },
}));

import QuotationSections, {
  copyTemplatesToSections,
  templatesForType,
} from "./QuotationSections";

const templates = [
  {
    id: "t-rental-top",
    name: "Term of Payment - Sewa",
    quotation_type: "rental",
    title: "Term of Payment",
    content: "1. Regularly monthly payment.",
    content_json: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "1. Regularly monthly payment." }],
        },
      ],
    },
    order: 2,
  },
  {
    id: "t-rental-note",
    name: "Note - Sewa",
    quotation_type: "rental",
    title: "Note",
    content: "- Rental time minimum for 1 (one) month",
    order: 1,
  },
  {
    id: "t-unit",
    name: "Terms & Conditions - Unit Baru",
    quotation_type: "new_unit",
    title: "Terms & Conditions",
    content: "1. Terms of payment",
    order: 1,
  },
  {
    id: "t-all",
    name: "Penutup",
    quotation_type: null,
    title: "Penutup",
    content: "Demikian penawaran ini.",
    order: 9,
  },
];

// Wrapper stateful supaya tambah/hapus/urut betul-betul merender ulang.
function Harness({ initial = [], type = "rental", readOnly = false, spy }) {
  const [sections, setSections] = useState(initial);
  return (
    <QuotationSections
      type={type}
      value={sections}
      readOnly={readOnly}
      onValueChange={(next) => {
        spy?.(next);
        setSections(next);
      }}
    />
  );
}

const titles = () =>
  screen
    .getAllByTestId("quotation-section")
    .map((section) => within(section).getAllByRole("textbox")[0].value);

describe("templatesForType / copyTemplatesToSections", () => {
  it("templatesForType memilih template jenis itu dan template umum, urut `order`", () => {
    const result = templatesForType(templates, "rental");

    expect(result.map((tpl) => tpl.title)).toEqual([
      "Note",
      "Term of Payment",
      "Penutup",
    ]);
  });

  it("templatesForType tanpa template mengembalikan array kosong", () => {
    expect(templatesForType(undefined, "rental")).toEqual([]);
    expect(
      templatesForType(templates, "spare_part").map((t) => t.title),
    ).toEqual(["Penutup"]);
  });

  it("copyTemplatesToSections menyalin judul, isi, dan content_json tanpa membawa id template", () => {
    const result = copyTemplatesToSections([], [templates[1], templates[0]]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      title: "Note",
      content: "- Rental time minimum for 1 (one) month",
      order: 0,
    });
    expect(result[1]).toMatchObject({
      title: "Term of Payment",
      content: "1. Regularly monthly payment.",
      content_json: templates[0].content_json,
      order: 1,
    });
    expect(result[0].id).toBeTruthy();
    expect(result[0].id).not.toBe("t-rental-note");
  });

  it("copyTemplatesToSections tidak menggandakan judul yang sudah ada", () => {
    const existing = [{ id: "x", title: "Note", content: "diubah user" }];

    const result = copyTemplatesToSections(existing, [
      templates[1],
      templates[0],
    ]);

    expect(result.map((section) => section.title)).toEqual([
      "Note",
      "Term of Payment",
    ]);
    expect(result[0].content).toBe("diubah user");
  });
});

describe("CRM QuotationSections", () => {
  beforeEach(() => {
    usePageMock.mockReturnValue({ props: { sectionTemplates: templates } });
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    inertiaFormMocks.clearErrors.mockReset();
    inertiaFormMocks.post.mockReset();
    window.route = (name) => name;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.route;
  });

  it("menampilkan blok yang ada dengan judul dan isi", () => {
    render(
      <Harness
        initial={[
          { id: "a", title: "Note", content: "isi note", order: 0 },
          { id: "b", title: "Owner", content: "isi owner", order: 1 },
        ]}
      />,
    );

    expect(screen.getAllByTestId("quotation-section")).toHaveLength(2);
    expect(screen.getByDisplayValue("isi note")).toBeInTheDocument();
    expect(screen.getByDisplayValue("isi owner")).toBeInTheDocument();
  });

  it("Tambah Blok menambah blok kosong di akhir dengan order berurutan", async () => {
    const spy = vi.fn();
    render(
      <Harness
        spy={spy}
        initial={[{ id: "a", title: "Note", content: "x", order: 0 }]}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /crm\.quotation\.add_section/ }),
    );

    expect(screen.getAllByTestId("quotation-section")).toHaveLength(2);
    const next = spy.mock.calls.at(-1)[0];
    expect(next.map((section) => section.order)).toEqual([0, 1]);
    expect(next[1]).toMatchObject({ title: "", content: "" });
  });

  it("mengedit judul dan isi memperbarui blok yang bersangkutan beserta content_json", async () => {
    const spy = vi.fn();
    render(
      <Harness
        spy={spy}
        initial={[
          { id: "a", title: "Note", content: "isi a", order: 0 },
          { id: "b", title: "Owner", content: "isi b", order: 1 },
        ]}
      />,
    );

    const editor = screen.getByDisplayValue("isi b");
    await userEvent.type(editor, "!");

    const next = spy.mock.calls.at(-1)[0];
    expect(next[0].content).toBe("isi a");
    expect(next[1].content).toBe("isi b!");
    expect(next[1].content_json).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "isi b!" }],
        },
      ],
    });
  });

  it("isi multi-baris dipertahankan apa adanya", () => {
    render(
      <Harness
        initial={[
          { id: "a", title: "Terms", content: "1. satu\n2. dua", order: 0 },
        ]}
      />,
    );

    const editor = screen.getByDisplayValue((value) =>
      value.includes("1. satu"),
    );
    expect(editor.value).toBe("1. satu\n2. dua");
  });

  it("menghapus blok membuang blok itu dan menomori ulang order", async () => {
    const spy = vi.fn();
    render(
      <Harness
        spy={spy}
        initial={[
          { id: "a", title: "A", content: "a", order: 0 },
          { id: "b", title: "B", content: "b", order: 1 },
          { id: "c", title: "C", content: "c", order: 2 },
        ]}
      />,
    );

    const second = screen.getAllByTestId("quotation-section")[1];
    await userEvent.click(
      within(second).getByRole("button", {
        name: "crm.quotation.remove_section",
      }),
    );

    expect(titles()).toEqual(["A", "C"]);
    const next = spy.mock.calls.at(-1)[0];
    expect(next.map((section) => [section.id, section.order])).toEqual([
      ["a", 0],
      ["c", 1],
    ]);
  });

  it("menaikkan dan menurunkan blok menukar urutan", async () => {
    render(
      <Harness
        initial={[
          { id: "a", title: "A", content: "a", order: 0 },
          { id: "b", title: "B", content: "b", order: 1 },
          { id: "c", title: "C", content: "c", order: 2 },
        ]}
      />,
    );

    const third = screen.getAllByTestId("quotation-section")[2];
    await userEvent.click(
      within(third).getByRole("button", {
        name: "crm.quotation.move_section_up",
      }),
    );
    expect(titles()).toEqual(["A", "C", "B"]);

    const first = screen.getAllByTestId("quotation-section")[0];
    await userEvent.click(
      within(first).getByRole("button", {
        name: "crm.quotation.move_section_down",
      }),
    );
    expect(titles()).toEqual(["C", "A", "B"]);
  });

  it("blok pertama tidak bisa dinaikkan dan blok terakhir tidak bisa diturunkan", () => {
    render(
      <Harness
        initial={[
          { id: "a", title: "A", content: "a", order: 0 },
          { id: "b", title: "B", content: "b", order: 1 },
        ]}
      />,
    );

    const [first, last] = screen.getAllByTestId("quotation-section");
    expect(
      within(first).getByRole("button", {
        name: "crm.quotation.move_section_up",
      }),
    ).toBeDisabled();
    expect(
      within(last).getByRole("button", {
        name: "crm.quotation.move_section_down",
      }),
    ).toBeDisabled();
  });

  describe("Ambil dari template & pilih template per blok (AC4.1–AC4.3)", () => {
    it("menyalin template sesuai jenis terpilih, urut `order`", async () => {
      render(<Harness type="rental" />);

      await userEvent.click(
        screen.getByRole("button", {
          name: /crm\.quotation\.load_section_templates/,
        }),
      );

      expect(titles()).toEqual(["Note", "Term of Payment", "Penutup"]);
      expect(
        screen.getByDisplayValue("1. Regularly monthly payment."),
      ).toBeInTheDocument();
    });

    it("tidak memuat template jenis lain", async () => {
      render(<Harness type="new_unit" />);

      await userEvent.click(
        screen.getByRole("button", {
          name: /crm\.quotation\.load_section_templates/,
        }),
      );

      expect(titles()).toEqual(["Terms & Conditions", "Penutup"]);
    });

    it("hasil salinan dapat diedit tanpa mengubah master template", async () => {
      const snapshot = JSON.parse(JSON.stringify(templates));
      render(<Harness type="new_unit" />);

      await userEvent.click(
        screen.getByRole("button", {
          name: /crm\.quotation\.load_section_templates/,
        }),
      );
      const editor = screen.getByDisplayValue("1. Terms of payment");
      await userEvent.type(editor, " DIUBAH");

      expect(
        screen.getByDisplayValue("1. Terms of payment DIUBAH"),
      ).toBeInTheDocument();
      expect(templates).toEqual(snapshot);
    });

    it("menekan tombol dua kali tidak menggandakan blok", async () => {
      render(<Harness type="rental" />);
      const button = screen.getByRole("button", {
        name: /crm\.quotation\.load_section_templates/,
      });

      await userEvent.click(button);
      await userEvent.click(button);

      expect(titles()).toEqual(["Note", "Term of Payment", "Penutup"]);
    });

    it("tombol ber-disable bila tidak ada template", () => {
      usePageMock.mockReturnValue({ props: { sectionTemplates: [] } });
      render(<Harness type="rental" />);

      expect(
        screen.getByRole("button", {
          name: /crm\.quotation\.load_section_templates/,
        }),
      ).toBeDisabled();
    });

    it("memilih template dari dropdown pada blok menyalin title, content, dan content_json", async () => {
      const spy = vi.fn();
      render(
        <Harness
          type="rental"
          spy={spy}
          initial={[{ id: "sec-1", title: "", content: "", order: 0 }]}
        />,
      );

      const sectionEl = screen.getByTestId("quotation-section");
      const selector = within(sectionEl).getByRole("combobox", {
        name: "crm.quotation.select_section_template",
      });

      await userEvent.selectOptions(selector, "t-rental-top");

      const next = spy.mock.calls.at(-1)[0];
      expect(next[0]).toMatchObject({
        id: "sec-1",
        title: "Term of Payment",
        content: "1. Regularly monthly payment.",
        content_json: templates[0].content_json,
      });
    });
  });

  describe("Simpan editan inline sebagai template baru (AC3.1–AC3.6)", () => {
    it("menampilkan pilihan simpan sebagai template baru setelah selesai mengedit (blur) dan dapat diabaikan", async () => {
      render(
        <Harness
          type="rental"
          initial={[
            {
              id: "sec-1",
              title: "Owner Obligation",
              content: "1. Klausul awal",
              order: 0,
            },
          ]}
        />,
      );

      expect(
        screen.queryByTestId("save-template-prompt"),
      ).not.toBeInTheDocument();

      const editor = screen.getByDisplayValue("1. Klausul awal");
      await userEvent.type(editor, " ditambah");
      fireEvent.blur(editor);

      const prompt = screen.getByTestId("save-template-prompt");
      expect(prompt).toBeInTheDocument();
      expect(
        within(prompt).getByText("crm.quotation.save_section_template_prompt"),
      ).toBeInTheDocument();

      // Pilih "Tidak" (dismiss)
      await userEvent.click(
        within(prompt).getByRole("button", {
          name: "crm.quotation.dismiss_save_template",
        }),
      );

      expect(
        screen.queryByTestId("save-template-prompt"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByDisplayValue("1. Klausul awal ditambah"),
      ).toBeInTheDocument();
    });

    it("menyimpan blok editan sebagai template baru lewat useForm Inertia", async () => {
      inertiaFormMocks.post.mockImplementation((_url, options) => {
        options.onSuccess();
      });

      render(
        <Harness
          type="rental"
          initial={[
            {
              id: "sec-tenant",
              title: "Tenant Obligation",
              content: "1. Menjaga keamanan",
              order: 0,
            },
          ]}
        />,
      );

      const editor = screen.getByDisplayValue("1. Menjaga keamanan");
      await userEvent.type(editor, " alat");
      fireEvent.blur(editor);

      const prompt = screen.getByTestId("save-template-prompt");
      await userEvent.click(
        within(prompt).getByRole("button", {
          name: "crm.quotation.save_as_template",
        }),
      );

      const dialog = screen.getByRole("dialog");
      const nameInput = within(dialog).getByLabelText(
        /crm\.quotation\.template_name/,
      );
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Tenant Obligation - Khusus Depo");

      await userEvent.click(
        within(dialog).getByRole("button", {
          name: "crm.quotation.save_as_template",
        }),
      );

      await waitFor(() => {
        expect(inertiaFormMocks.post).toHaveBeenCalledTimes(1);
      });

      expect(inertiaFormMocks.post).toHaveBeenCalledWith(
        "quotation-section-templates.store",
        expect.objectContaining({
          preserveScroll: true,
          onSuccess: expect.any(Function),
        }),
        expect.objectContaining({
          name: "Tenant Obligation - Khusus Depo",
          title: "Tenant Obligation",
          quotation_type: "rental",
          content: "1. Menjaga keamanan alat",
        }),
      );
      expect(inertiaFormMocks.clearErrors).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "crm.quotation.section_template_saved",
      );
    });
  });

  describe("readOnly", () => {
    it("tombol tambah, template, hapus, dan urut tidak dirender", () => {
      render(
        <Harness
          readOnly
          initial={[{ id: "a", title: "A", content: "a", order: 0 }]}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /add_section/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /load_section_templates/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /remove_section/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /move_section/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /save_as_template/ }),
      ).not.toBeInTheDocument();
    });

    it("isi blok tidak dapat diedit", () => {
      render(
        <Harness
          readOnly
          initial={[{ id: "a", title: "A", content: "isi a", order: 0 }]}
        />,
      );

      expect(screen.getByDisplayValue("isi a")).toHaveAttribute("readonly");
    });
  });
});
