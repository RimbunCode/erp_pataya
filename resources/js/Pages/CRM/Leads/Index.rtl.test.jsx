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

describe("CRM/Leads Index", () => {
  it("meneruskan classNameDialog dan form (elemen <Form/>) ke DataTable2", () => {
    render(<Index />);

    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-lg)!");
    expect(isValidElement(capturedProps.form)).toBe(true);
    expect(capturedProps.form.type).toBe(Form);
  });

  // Tanpa `templateItem`, `mobileItem()` (DataTable2.jsx) SELALU `null` --
  // kartu mobile kosong sama sekali (bukan "default tampilan mobile"), lihat
  // komentar identik di CRM/Opportunities/Index.rtl.test.jsx.
  it("meneruskan templateItem -- kartu mobile render templateLink penuh, contact, status, & tombol hapus", () => {
    render(<Index />);

    const deleteItem = vi.fn();
    const card = capturedProps.templateItem({
      dataRow: {
        id: "lead-1",
        company_name: "PT ZZ",
        templateLink: ":company_name",
        contact_name: "Budi",
        status: "new",
      },
      deleteItem,
    });
    render(card);

    expect(screen.getByText("PT ZZ")).toBeInTheDocument();
    expect(screen.getByText("Budi")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    buttons.at(-1).click();
    expect(deleteItem).toHaveBeenCalledTimes(1);
  });
});
