import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

let capturedProps = null;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    return null; // detail lain DataTable2 di luar cakupan test ini
  },
}));

import Index from "./Index";
import Form from "./Form";

describe("Finances/PaymentEntries Index", () => {
  it("meneruskan form (elemen Form) ke DataTable2", () => {
    render(<Index />);
    expect(capturedProps.form).toBeTruthy();
    expect(capturedProps.form.type).toBe(Form);
  });

  it("meneruskan classNameDialog='max-w-screen-2xl' ke DataTable2", () => {
    render(<Index />);
    expect(capturedProps.classNameDialog).toBe("max-w-screen-2xl");
  });

  it("tidak meneruskan templateItem ke DataTable2 -- seluruh blok template mobile di-comment total di source", () => {
    render(<Index />);
    // BUG (lihat bugFindings): blok templateItem di Index.jsx (baris ~10-32)
    // di-comment total (bukan diimplementasikan), jadi prop templateItem
    // TIDAK dikirim sama sekali (undefined) ke DataTable2 -- berbeda dgn
    // pola Finances lain yg templateItem-nya aktif (mis. Finances/Taxes juga
    // punya blok comment identik/copy-paste yg sama, referensi "categories.show"
    // dan "finances.taxes.types" yg bahkan tidak relevan dgn domain
    // PaymentEntries). Test ini meng-assert perilaku saat ini apa adanya,
    // bukan perilaku yg diharapkan.
    expect(capturedProps.templateItem).toBeUndefined();
  });
});
