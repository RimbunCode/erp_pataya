import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { isValidElement } from "react";

let capturedProps = null;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    return null; // detail lain DataTable2 di luar cakupan test ini
  },
}));

import Index from "./Index";
import Form from "./Form";

window.route = (name, param) => (param != null ? `${name}/${param}` : name);

describe("CRM/Opportunities Index", () => {
  it("meneruskan classNameDialog dan form (elemen <Form/>) ke DataTable2", () => {
    render(<Index />);

    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-lg)!");
    expect(isValidElement(capturedProps.form)).toBe(true);
    expect(capturedProps.form.type).toBe(Form);
  });

  // Tanpa `templateItem`, `mobileItem()` (DataTable2.jsx) SELALU `null` --
  // kartu mobile grup MAUPUN flat kosong sama sekali (bukan "default tampilan
  // mobile", itu asumsi salah di versi lama test ini -- lihat komentar
  // Requirement 24 di project memory, ketahuan lewat verifikasi browser data
  // 1163 baris: pagination "1-100/1163" tampil tapi kartu di bawahnya kosong).
  it("meneruskan templateItem -- kartu mobile render templateLink penuh, customer, tahap, & tombol hapus", () => {
    render(<Index />);

    const deleteItem = vi.fn();
    // `templateLink` di sini persis field yg dikirim backend per baris
    // (lihat Opportunity::templateLink() = `:title`) -- convertTemplateLink()
    // butuh field ini di objek row itu sendiri, BUKAN nama model statis.
    const card = capturedProps.templateItem({
      dataRow: {
        id: "opp-1",
        title: "Kontrak ZZ",
        templateLink: ":title",
        customer: { name: "Pelanggan ZZ" },
        stage: "identified",
      },
      deleteItem,
    });
    render(card);

    expect(screen.getByText("Kontrak ZZ")).toBeInTheDocument();
    expect(screen.getByText("Pelanggan ZZ")).toBeInTheDocument();
    expect(screen.getByText("identified")).toBeInTheDocument();

    // Link (dari @/Components/Link) `as="button"` -- 2 tombol: judul (visit)
    // & hapus. Tombol hapus TERAKHIR (urutan render), pemicu `deleteItem`.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    buttons.at(-1).click();
    expect(deleteItem).toHaveBeenCalledTimes(1);
  });
});
