import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

let capturedProps = null;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    return null; // detail internal DataTable2 di luar cakupan test ini
  },
}));

vi.mock("./Form", () => ({
  default: () => null,
}));

import Index from "./Index";

describe("Finances PaymentTermTemplate Index", () => {
  it("merender tanpa error dan meneruskan classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(capturedProps).not.toBeNull();
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
  });

  it("meneruskan prop form berupa elemen React dari komponen Form", async () => {
    const { default: Form } = await import("./Form");
    render(<Index />);
    expect(capturedProps.form).toBeTruthy();
    expect(capturedProps.form.type).toBe(Form);
  });

  it("tidak meneruskan templateItem (page ini bukan pola card list mobile custom)", () => {
    render(<Index />);
    expect(capturedProps.templateItem).toBeUndefined();
  });
});
