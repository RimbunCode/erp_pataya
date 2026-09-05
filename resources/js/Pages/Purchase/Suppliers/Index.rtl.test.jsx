import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
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

describe("Purchase/Suppliers Index", () => {
  it("meneruskan classNameDialog dan form (elemen <Form/>) ke DataTable2", () => {
    render(<Index />);

    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-lg)!");
    expect(isValidElement(capturedProps.form)).toBe(true);
    expect(capturedProps.form.type).toBe(Form);
  });

  it("tidak meneruskan templateItem -- DataTable2 pakai default tampilan mobile-nya sendiri", () => {
    render(<Index />);

    expect(capturedProps.templateItem).toBeUndefined();
  });
});
