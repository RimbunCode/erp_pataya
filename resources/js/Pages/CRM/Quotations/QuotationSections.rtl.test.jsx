import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// Blok teks Quotation (AC5.2, AC5.4): tambah, hapus, urutkan, dan salin dari
// template. Template dikirim controller sebagai prop Inertia `sectionTemplates`.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
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
    expect(templatesForType(templates, "spare_part").map((t) => t.title)).toEqual(
      ["Penutup"],
    );
  });

  it("copyTemplatesToSections menyalin judul dan isi tanpa membawa id template", () => {
    const result = copyTemplatesToSections([], [templates[1]]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Note",
      content: "- Rental time minimum for 1 (one) month",
      order: 0,
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

  it("mengedit judul dan isi memperbarui blok yang bersangkutan saja", async () => {
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

    const textarea = screen.getByDisplayValue("isi b");
    await userEvent.type(textarea, "!");

    const next = spy.mock.calls.at(-1)[0];
    expect(next[0].content).toBe("isi a");
    expect(next[1].content).toBe("isi b!");
  });

  it("isi multi-baris dipertahankan apa adanya", () => {
    render(
      <Harness
        initial={[
          { id: "a", title: "Terms", content: "1. satu\n2. dua", order: 0 },
        ]}
      />,
    );

    const textarea = screen.getByDisplayValue((value) =>
      value.includes("1. satu"),
    );
    expect(textarea.value).toBe("1. satu\n2. dua");
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

  describe("Ambil dari template (AC5.4)", () => {
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
      const textarea = screen.getByDisplayValue("1. Terms of payment");
      await userEvent.type(textarea, " DIUBAH");

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
