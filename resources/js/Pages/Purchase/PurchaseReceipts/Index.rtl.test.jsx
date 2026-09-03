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

describe("Purchase/PurchaseReceipts Index", () => {
  it("meneruskan form (elemen Form) ke DataTable2", () => {
    render(<Index />);
    expect(capturedProps.form).toBeTruthy();
    expect(capturedProps.form.type).toBe(Form);
  });

  it("meneruskan classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
  });

  it("tidak meneruskan templateItem ke DataTable2 -- source tidak mendefinisikan render mobile card list", () => {
    render(<Index />);
    expect(capturedProps.templateItem).toBeUndefined();
  });
});
